import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { PassThrough } from 'stream'
import { EXIT, main } from '../src/cli/cli'

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

describe('CLI', () => {
  test('--text', async () => {
    const r = await run(['--from', 'tifinagh', '--to', 'arabic', '--profile', 'readable', '--text', 'ⴰⵣⵓⵍ'])
    expect(r).toEqual({ code: 0, out: 'أزول\n', err: '' })
  })

  test('stdin streaming preserves every line ending, blank lines and a missing final newline', async () => {
    const r = await run([], 'ⴰⵣⵓⵍ\r\n\n\nⵜⴰⵎⴰⵣⵉⵖⵜ text\n```\nⴰ\n```\nⵓ')
    expect(r.out).toBe('أزول\r\n\n\nتامازيغت text\n```\nⴰ\n```\nؤ')
  })

  test('files in, file out', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amz-'))
    writeFileSync(join(dir, 'a.txt'), 'ⴰⵎⵖⴰⵔ\n')
    writeFileSync(join(dir, 'b.txt'), 'ⵉⴼⴰⵙⵙⵏ\n')
    const r = await run([join(dir, 'a.txt'), join(dir, 'b.txt'), '-o', join(dir, 'out.txt')])
    expect(r.code).toBe(0)
    expect(readFileSync(join(dir, 'out.txt'), 'utf8')).toBe('أمغار\nئفاسّن\n')
  })

  test('--json with options, alternatives and trace', async () => {
    const r = await run(['--json', '--profile', 'ircam', '--option', 'gemination=shadda', '--alternatives', '--trace'], 'ⵉⴼⴰⵙⵙⵏ')
    const j = JSON.parse(r.out)
    expect(j.output).toBe('ئفاسّن')
    expect(j.profile).toBe('ircam')
    expect(j.alternatives[0].alternatives.length).toBeGreaterThan(0)
    expect(j.trace.length).toBe(5)
  })

  test('--jsonl batch with ids, errors per record and strict failures', async () => {
    const input = ['{"id":"a","text":"ⴰⵣⵓⵍ"}', 'not json', '{"text":5}', '', '{"id":7,"text":"ⵯ"}'].join('\n') + '\n'
    const r = await run(['--jsonl'], input)
    const lines = r.out.trim().split('\n').map((l) => JSON.parse(l))
    expect(lines[0]).toEqual({ id: 'a', output: 'أزول', warnings: [] })
    expect(lines[1]).toEqual({ line: 2, error: 'invalid JSON' })
    expect(lines[2].error).toMatch(/string 'text'/)
    expect(lines[3].id).toBe(7)
    expect(lines[3].warnings[0].code).toBe('ORPHAN_LABIALIZATION')
    const s = await run(['--jsonl', '--strict'], input)
    expect(s.code).toBe(EXIT.STRICT)
    expect(s.out.trim().split('\n')).toHaveLength(4) // processing continued after the failure
  })

  test('--strict on plain text exits with code 3', async () => {
    const r = await run(['--strict'], 'ⴰⵗ')
    expect(r.code).toBe(EXIT.STRICT)
    expect(r.err).toMatch(/UNSUPPORTED_TIFINAGH/)
  })

  test('--diagnostics writes JSON warnings to stderr', async () => {
    const r = await run(['--diagnostics'], 'ⴰⵯ\n')
    expect(r.out).toBe('أⵯ\n')
    expect(JSON.parse(r.err.trim()).code).toBe('ORPHAN_LABIALIZATION')
  })

  test('latin directions', async () => {
    expect((await run(['--to', 'latin', '--text', 'ⵜⴰⵎⵓⵔⵜ'])).out).toBe('tamurt\n')
    expect((await run(['--from', 'latin', '--to', 'tifinagh', '--text', 'tamurt'])).out).toBe('ⵜⴰⵎⵓⵔⵜ\n')
    expect((await run(['--from', 'latin', '--text', 'azul'])).out).toBe('أزول\n')
  })

  test('lexicon file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amz-'))
    const lex = join(dir, 'lex.json')
    writeFileSync(lex, JSON.stringify([{ tifinagh: 'ⴰⴳⴰⴷⵉⵔ', arabic: 'أكادير', status: 'verified', source: 'test' }]))
    expect((await run(['--lexicon', lex, '--text', 'ⴰⴳⴰⴷⵉⵔ'])).out).toBe('أكادير\n')
    writeFileSync(lex, '[{"tifinagh":"x"}]')
    const bad = await run(['--lexicon', lex, '--text', 'ⴰ'])
    expect(bad.code).toBe(EXIT.IO)
    expect(bad.err).toMatch(/cannot load lexicon/)
  })

  test('usage errors', async () => {
    for (const args of [['--profile', 'x'], ['--option', 'g=zz'], ['--option', 'nope=1'], ['--bogus'], ['--from', 'arabic'], ['--json', '--jsonl'], ['--to', 'latin', '--trace'], ['--max-bytes', '-1']]) {
      const r = await run(args)
      expect(r.code).toBe(EXIT.USAGE)
      expect(r.err).toMatch(/^error:/)
    }
  })

  test('missing input file is an I/O error', async () => {
    const r = await run(['/nonexistent/file.txt'])
    expect(r.code).toBe(EXIT.IO)
  })

  test('--max-bytes is enforced', async () => {
    const r = await run(['--max-bytes', '5'], 'ⴰⵣⵓⵍ ⴰⵣⵓⵍ')
    expect(r.code).toBe(EXIT.USAGE)
    expect(r.err).toMatch(/max-bytes/)
  })

  test('help, version, list-profiles', async () => {
    expect((await run(['--help'])).out).toMatch(/Usage:/)
    expect((await run(['--version'])).out).toMatch(/^\d+\.\d+\.\d+\n$/)
    expect(Object.keys(JSON.parse((await run(['--list-profiles'])).out))).toEqual(['ircam', 'readable', 'phonetic'])
  })
})
