import { ArabicConverter, TransliterationError, convert, createConverter, toArabic, transliterate } from '../src/index'
import { IRCAM_CHARS, LONE_SURROGATE_RE, PROFILE_IDS } from './helpers'

describe('edge cases', () => {
  test('empty input', () => {
    for (const p of PROFILE_IDS) expect(toArabic('', { profile: p })).toBe('')
    expect(transliterate('')).toEqual({ output: '', profile: 'readable', warnings: [] })
  })

  test('whitespace-only and punctuation-only input', () => {
    expect(toArabic(' \t\n')).toBe(' \t\n')
    expect(toArabic('.,;:!?…')).toBe('.,;:!?…')
  })

  test('non-string input throws a TypeError', () => {
    expect(() => toArabic(null as unknown as string)).toThrow(TypeError)
    expect(() => toArabic(42 as unknown as string)).toThrow(TypeError)
  })

  test('very long input (≈ 1.2 M chars) is converted completely and in linear time', () => {
    const word = 'ⵜⴰⵎⴰⵣⵉⵖⵜ '
    const small = word.repeat(10_000)
    const big = word.repeat(120_000)
    const c = createConverter()
    let t = process.hrtime.bigint()
    const outSmall = c.convert(small).output
    const tSmall = Number(process.hrtime.bigint() - t)
    t = process.hrtime.bigint()
    const out = c.convert(big).output
    const tBig = Number(process.hrtime.bigint() - t)
    expect(out).toBe('تامازيغت '.repeat(120_000))
    expect(outSmall.length).toBe('تامازيغت '.length * 10_000)
    // 12× the input should not take more than ~40× the time (quadratic would be ~144×)
    expect(tBig / Math.max(tSmall, 1)).toBeLessThan(40)
  })

  test('a single 200k-letter word and 100k unmatched backticks do not blow up', () => {
    const longWord = IRCAM_CHARS.join('').repeat(6500)
    expect(toArabic(longWord).length).toBeGreaterThan(150_000)
    const ticks = Array.from({ length: 2000 }, (_, i) => '`'.repeat((i % 50) + 1)).join(' ⴰ ')
    expect(() => toArabic(ticks)).not.toThrow()
  })

  test('non-BMP characters and lone surrogates are preserved, never split', () => {
    const s = '𝕋 ⴰⵣⵓⵍ 🧪\uD800 ⴰ\uDC00'
    const out = toArabic(s)
    expect(out).toBe('𝕋 أزول 🧪\uD800 أ\uDC00')
    expect(toArabic('ⴰⵣⵓⵍ 🇲🇦')).not.toMatch(LONE_SURROGATE_RE)
  })

  test('combining marks on Tifinagh letters are kept and reported', () => {
    const r = transliterate('ⵣ̣ⴰ')
    expect(r.output).toBe('ز̣ا')
    expect(r.warnings.map((w) => w.code)).toEqual(['COMBINING_MARK_ON_TIFINAGH'])
  })

  test('canonically equivalent inputs give canonically equivalent outputs', () => {
    const nfc = 'Café ⴰⵣⵓⵍ'
    const nfd = nfc.normalize('NFD')
    expect(toArabic(nfd).normalize('NFC')).toBe(toArabic(nfc).normalize('NFC'))
    // non-Tifinagh text is not normalized behind the user's back
    expect(toArabic(nfd)).toBe(nfd.replace('ⴰⵣⵓⵍ', 'أزول'))
  })

  test('BOM at the start of a file is preserved', () => {
    expect(toArabic('\uFEFFⴰⵣⵓⵍ')).toBe('\uFEFFأزول')
  })

  test('paragraph of real text', () => {
    const para = 'ⴰⵙⴳⴳⵯⴰⵙ ⴰⵎⴰⵢⵏⵓ ⵉⵖⵓⴷⴰⵏ! ⵜⴰⵎⴰⵣⵉⵖⵜ ⵜⵓⵜⵍⴰⵢⵜ ⵜⴰⵏⴰⵎⵓⵔⵜ.'
    expect(toArabic(para)).toBe('أسگُّاس أماينو ئغودان! تامازيغت توتلايت تانامورت.')
  })
})

describe('strict mode', () => {
  test('clean input passes', () => {
    expect(transliterate('ⴰⵣⵓⵍ ⴰⴳⴳⵯⴰ', { strict: true }).output).toBe('أزول أگُّا')
  })

  test.each([
    ['unsupported Tifinagh', 'ⴰⵗ', 'UNSUPPORTED_TIFINAGH'],
    ['orphan labialization', 'ⵯⴰ', 'ORPHAN_LABIALIZATION'],
    ['non-standard letter', 'ⵝⴰ', 'NONSTANDARD_LETTER'],
    ['combining mark', 'ⴰ́', 'COMBINING_MARK_ON_TIFINAGH'],
  ])('%s throws TransliterationError', (_l, input, code) => {
    try {
      transliterate(input, { strict: true })
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(TransliterationError)
      expect((e as TransliterationError).warnings[0].code).toBe(code)
    }
  })

  test('info diagnostics do not fail strict mode', () => {
    expect(() => transliterate('ⵜⴰⵉ ⴰ\u200Dⴱ', { strict: true })).not.toThrow()
  })

  test('convert() supports strict', () => {
    expect(() => convert('ⵯ', { to: 'arabic', strict: true })).toThrow(TransliterationError)
  })
})

describe('streaming API', () => {
  test('convertChunk carries fenced-code state and offsets across chunks', () => {
    const c = new ArabicConverter()
    const state = { fence: null }
    const a = c.convertChunk('```', state, 0)
    const b = c.convertChunk('ⴰⵣⵓⵍ', state, 4)
    const d = c.convertChunk('```', state, 9)
    const e = c.convertChunk('ⴰⵣⵓⵍ ⵯ', state, 13)
    expect([a.output, b.output, d.output, e.output]).toEqual(['```', 'ⴰⵣⵓⵍ', '```', 'أزول ⵯ'])
    expect(e.warnings[0].position).toBe(13 + 5)
  })
})

describe('words with nothing to write in Arabic', () => {
  test.each([['ⴻ'], ['ⴻⴻ'], ['\u2D7F'], ['ⴻ\u200Dⴻ']])('%j is kept unchanged with EMPTY_WORD instead of vanishing', (w) => {
    for (const profile of ['ircam', 'readable'] as const) {
      const r = transliterate(`a ${w} b`, { profile })
      expect(r.output).toBe(`a ${w} b`)
      expect(r.warnings.some((x) => x.code === 'EMPTY_WORD' && x.source === w)).toBe(true)
    }
  })

  test('phonetic writes the schwa, so such a word is not empty there', () => {
    expect(toArabic('ⴻ', { profile: 'phonetic' })).toBe('اِ')
  })

  test('regression: removing a schwa-only word must not merge Markdown backticks (found by fast-check)', () => {
    const s = '»``ⴻ`ⴰⵣⵓⵍ`'
    const once = toArabic(s, { profile: 'ircam' })
    expect(once).toBe(s)
    expect(toArabic(once, { profile: 'ircam' })).toBe(once)
  })
})

