/**
 * Branches not reached by the other suites: argument validation, rarely used
 * CLI flags, lexicon bookkeeping and the upstream Latin converters.
 */
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PassThrough, Writable } from 'stream'
import {
  Lexicon,
  LexiconValidationError,
  baseArabic,
  convert,
  detect,
  normalizeText,
  resolveOptions,
  segment,
  toArabic,
  transliterate,
} from '../src/index'
import { EXIT, main } from '../src/cli/cli'
import { convertUnits } from '../src/rules/engine'
import type { Unit } from '../src/tokenization/units'

async function run(args: string[], stdin = ''): Promise<{ code: number; out: string; err: string }> {
  const input = new PassThrough()
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  let out = ''
  let err = ''
  stdout.on('data', (d) => (out += d.toString()))
  stderr.on('data', (d) => (err += d.toString()))
  input.end(stdin)
  const code = await main(args, { stdin: input, stdout, stderr })
  return { code, out, err }
}

describe('public API argument handling', () => {
  test('convert() requires options.to', () => {
    expect(() => convert('ⴰ', undefined as never)).toThrow(/options\.to is required/)
    expect(() => convert('ⴰ', {} as never)).toThrow(/options\.to is required/)
  })

  test('an unknown script name is rejected', () => {
    expect(() => convert('ⴰ', { from: 'klingon' as never, to: 'latin' })).toThrow(/Unsupported conversion/)
  })

  test('detect() on whitespace-only text reports zero confidence', () => {
    expect(detect('   ')).toEqual({ script: 'latin', confidence: 0 })
  })

  test('baseArabic() returns null for characters without a correspondence', () => {
    const o = resolveOptions('readable')
    expect(baseArabic('x', o)).toBeNull()
    expect(baseArabic('ⴻ', o)).toBeNull()
    expect(baseArabic('ⵝ', o)).toEqual({ text: 'ث', rule: 'base.extended.albane2025' })
  })

  test('normalizeText supports "none" and is the identity then', () => {
    const s = 'Café ⴰⵣⵓⵍ'
    expect(normalizeText(s, 'none')).toBe(s)
    expect(normalizeText(s)).toBe(s.normalize('NFC'))
  })

  test('engine keeps the source text of a letter it cannot map (defensive path)', () => {
    const fake: Unit = {
      kind: 'letter',
      letter: { char: 'ⵦ', codePoint: 'U+2D66', unicodeName: 'YE', ircamName: '', latin: 'ẹ', cls: 'consonant', standard: 'extended', sources: ['UNICODE'] },
      cls: 'consonant',
      labialized: false,
      length: 1,
      source: 'ⵦ',
      start: 0,
      end: 1,
      extraMarks: '',
    }
    const r = convertUnits([fake], resolveOptions('readable'))
    expect(r.output).toBe('ⵦ')
    expect(r.trace[0].rules).toContain('passthrough.no-correspondence')
  })

  test('segment: "www." inside a longer token is not a URL, a later one is', () => {
    const segs = segment('awww.x www.ⴰ.ma', { protectUrls: true, protectCode: true })
    expect(segs.filter((s) => s.kind === 'protected').map((s) => s.text)).toEqual(['www.ⴰ.ma'])
    expect(toArabic('abcwww.ⴰ')).toBe('abcwww.أ') // ⴰ after '.' starts a word
  })

  test('a supplementary-plane combining mark after a Tifinagh letter is kept', () => {
    const r = transliterate('ⴰ\u{1D167}ⴱ')
    expect(r.output).toBe('أ\u{1D167}ب')
    expect(r.warnings.map((w) => w.code)).toEqual(['COMBINING_MARK_ON_TIFINAGH'])
  })
})

describe('lexicon bookkeeping', () => {
  const e = { tifinagh: 'ⴰⵎⴰⵏ', arabic: 'أمان', status: 'verified' as const, source: 'test' }
  test('identical entries are stored once; entries() lists them', () => {
    const lex = new Lexicon([e, { ...e }, { ...e, profiles: ['readable', 'ircam', 'phonetic'] }])
    expect(lex.entries()).toHaveLength(1)
    expect(lex.size).toBe(1)
  })
  test('over-long Tifinagh is rejected', () => {
    expect(() => new Lexicon([{ ...e, tifinagh: 'ⴰ'.repeat(201) }])).toThrow(LexiconValidationError)
  })
  test('a non-string note is rejected', () => {
    expect(() => new Lexicon([{ ...e, note: 5 as never }])).toThrow(/note/)
  })
})

describe('CLI flags and branches', () => {
  test('--flag=value syntax', async () => {
    const r = await run(['--profile=ircam', '--option=gemination=shadda', '--text=ⵉⴼⴰⵙⵙⵏ'])
    expect(r).toEqual({ code: EXIT.OK, out: 'ئفاسّن\n', err: '' })
  })

  test('--text with --jsonl prints one JSON record', async () => {
    const r = await run(['--jsonl', '--text', 'ⴰⵣⵓⵍ'])
    expect(JSON.parse(r.out).output).toBe('أزول')
  })

  test('--text --diagnostics writes warnings to stderr', async () => {
    const r = await run(['--diagnostics', '--text', 'ⵯ'])
    expect(r.out).toBe('ⵯ\n')
    expect(JSON.parse(r.err).code).toBe('ORPHAN_LABIALIZATION')
  })

  test('--allow-provisional and a lexicon with conflicts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amz-'))
    const lex = join(dir, 'lex.json')
    writeFileSync(
      lex,
      JSON.stringify([
        { tifinagh: 'ⴰⴳⴰⴷⵉⵔ', arabic: 'أكادير', status: 'provisional', source: 'a' },
        { tifinagh: 'ⴰⵎⴰⵏ', arabic: 'أمان', status: 'verified', source: 'a' },
        { tifinagh: 'ⴰⵎⴰⵏ', arabic: 'امان', status: 'verified', source: 'b' },
      ]),
    )
    const r = await run(['--lexicon', lex, '--allow-provisional', '--text', 'ⴰⴳⴰⴷⵉⵔ ⴰⵎⴰⵏ'])
    expect(r.out).toBe('أكادير أمان\n')
    expect(r.err).toMatch(/conflicting spellings for 1 word;/)
    const strict = await run(['--lexicon', lex, '--text', 'ⴰⴳⴰⴷⵉⵔ'])
    expect(strict.out).toBe('أگادير\n') // provisional ignored without the flag
  })

  test('a lexicon file that is not JSON is an I/O error', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amz-'))
    const lex = join(dir, 'bad.json')
    writeFileSync(lex, '{not json')
    const r = await run(['--lexicon', lex, '--text', 'ⴰ'])
    expect(r.code).toBe(EXIT.IO)
  })

  test('a directory given as input is an I/O error', async () => {
    const r = await run([tmpdir()])
    expect(r.code).toBe(EXIT.IO)
    expect(r.err).toMatch(/it is a directory/)
  })

  test('JSONL records that are not objects are reported per line', async () => {
    const r = await run(['--jsonl'], '[1,2]\n"x"\nnull\n')
    const lines = r.out.trim().split('\n').map((l) => JSON.parse(l))
    expect(lines).toHaveLength(3)
    expect(lines.every((l) => /string 'text'/.test(l.error))).toBe(true)
  })

  test('upstream directions through the CLI stream line by line', async () => {
    const r = await run(['--to', 'latin'], 'ⵜⴰⵎⵓⵔⵜ\nⴰⵣⵓⵍ')
    expect(r.out).toBe('tamurt\nazul')
  })

  test('--json reads several input files as one document', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amz-'))
    writeFileSync(join(dir, 'a.txt'), 'ⴰⵣⵓⵍ\n')
    writeFileSync(join(dir, 'b.txt'), 'ⴰⵎⴰⵏ')
    const r = await run(['--json', join(dir, 'a.txt'), join(dir, 'b.txt')])
    expect(JSON.parse(r.out).output).toBe('أزول\nأمان')
  })
})

describe('upstream Latin converters', () => {
  test('Latin → Tifinagh keeps whitespace and handles the middle-dot separator', () => {
    expect(convert('a z\tu', { from: 'latin', to: 'tifinagh' }).output).toBe('ⴰ ⵣ\tⵓ')
    expect(convert('k·h', { from: 'latin', to: 'tifinagh' }).output).toBe('ⴽⵀ')
  })

  test('Tifinagh → Latin reports an isolated labialization mark', () => {
    const r = convert('ⵯⴰ', { from: 'tifinagh', to: 'latin' })
    expect(r.output).toBe('a')
    expect(r.warnings[0].code).toBe('UNKNOWN_CHAR')
  })

  test('Latin → Tifinagh standard digraphs and emphatics', () => {
    expect(convert('ḍṛṣṭẓ', { from: 'latin', to: 'tifinagh' }).output).toBe('ⴹⵕⵚⵟⵥ')
    expect(convert('gʷ', { from: 'latin', to: 'tifinagh' }).output).toBe('ⴳⵯ')
  })
})

describe('CLI when the reader goes away (e.g. piped into head)', () => {
  const epipe = (): Writable =>
    new Writable({
      write(_chunk, _enc, cb) {
        cb(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))
      },
    })
  test.each([[[] as string[]], [['--jsonl']], [['--json']], [['--text', 'ⴰⵣⵓⵍ']]])('%j exits quietly with code 0', async (args) => {
    const input = new PassThrough()
    const stderr = new PassThrough()
    let err = ''
    stderr.on('data', (d) => (err += d.toString()))
    input.end(args[0] === '--jsonl' ? '{"text":"ⴰ"}\n'.repeat(1000) : 'ⴰⵣⵓⵍ\n'.repeat(1000))
    const code = await main(args, { stdin: input, stdout: epipe(), stderr })
    expect(code).toBe(EXIT.OK)
    expect(err).toBe('')
  })
})
