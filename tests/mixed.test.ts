import { convert, toArabic, transliterate } from '../src/index'
import { BIDI_CONTROLS_RE } from './helpers'

describe('mixed-script text', () => {
  test('specification example', () => {
    expect(toArabic('ⴰⵣⵓⵍ, bonjour! 2026 ⵜⴰⵎⴰⵣⵉⵖⵜ')).toBe('أزول, bonjour! 2026 تامازيغت')
    expect(convert('ⴰⵣⵓⵍ, bonjour! 2026 ⵜⴰⵎⴰⵣⵉⵖⵜ', { to: 'arabic' }).from).toBe('tifinagh')
  })

  test('Arabic, Latin, French, digits and emoji are preserved byte-for-byte', () => {
    const others = 'مرحبا بكم — Ça va? 3,14 % 🇲🇦 👍🏽 𝔸𝔹 ٠١٢'
    expect(toArabic(others)).toBe(others)
    expect(toArabic(`${others} ⴰⵎⴰⵏ ${others}`)).toBe(`${others} أمان ${others}`)
  })

  test('Tifinagh directly adjacent to other scripts', () => {
    expect(toArabic('(ⴰⵣⵓⵍ)')).toBe('(أزول)')
    expect(toArabic('abcⴰⵣⵓⵍ123')).toBe('abcأزول123')
    expect(toArabic('«ⵜⴰⵎⴰⵣⵉⵖⵜ»')).toBe('«تامازيغت»')
    expect(toArabic('ⴰⵣⵓⵍ😀ⴰⵣⵓⵍ')).toBe('أزول😀أزول')
  })

  test('whitespace, tabs, CRLF, blank lines and paragraphs are preserved', () => {
    const input = '  ⴰⵣⵓⵍ\t\tⴰⵎⴰⵏ  \r\n\r\n\nⵜⴰⵎⵓⵔⵜ\u00A0ⵉⵖⵔⵎ\n'
    expect(toArabic(input)).toBe('  أزول\t\tأمان  \r\n\r\n\nتامورت\u00A0ئغرم\n')
  })

  test('URLs and e-mail addresses are protected (even with Tifinagh inside)', () => {
    expect(toArabic('ⴰⵣⵓⵍ https://ⵜⴰⵎⴰ.ma/ⴰⵣⵓⵍ?q=1 ⴰⵣⵓⵍ')).toBe('أزول https://ⵜⴰⵎⴰ.ma/ⴰⵣⵓⵍ?q=1 أزول')
    expect(toArabic('www.ⴰⵣⵓⵍ.ma')).toBe('www.ⴰⵣⵓⵍ.ma')
    expect(toArabic('ⵙⵙⵓⴼⵖ:http://x.y/ⴰ')).toBe('سّوفغ:http://x.y/ⴰ')
    expect(toArabic('mail ⴰⵣⵓⵍ@ircam.ma ok')).toBe('mail ⴰⵣⵓⵍ@ircam.ma ok')
    expect(toArabic('https://ⴰ', { arabic: { protectUrls: false } })).toBe('https://أ')
  })

  test('Markdown code spans and fenced blocks are protected', () => {
    expect(toArabic('ⴰⵣⵓⵍ `ⴰⵣⵓⵍ` **ⴰⵣⵓⵍ**')).toBe('أزول `ⴰⵣⵓⵍ` **أزول**')
    expect(toArabic('a ``x ` ⴰ`` ⴰ')).toBe('a ``x ` ⴰ`` أ')
    const md = '# ⴰⵣⵓⵍ\n```js\nconst s = "ⴰⵣⵓⵍ"\n```\n- ⴰⵎⴰⵏ\n~~~\nⴰ\n~~~\nⵓ'
    expect(toArabic(md)).toBe('# أزول\n```js\nconst s = "ⴰⵣⵓⵍ"\n```\n- أمان\n~~~\nⴰ\n~~~\nؤ')
    expect(toArabic('`ⴰ', {})).toBe('`أ') // unmatched backtick is not code
    expect(toArabic('`ⴰ`', { arabic: { protectCode: false } })).toBe('`أ`')
  })

  test('Arabic punctuation option converts only punctuation following Tifinagh', () => {
    const o = { arabic: { punctuation: 'arabic' as const } }
    expect(toArabic('ⴰⵣⵓⵍ, ⵎⴰⵏⵣⴰⴽⵉⵏ? Hello, world; 3,5', o)).toBe('أزول، مانزاكين؟ Hello, world; 3,5')
    expect(toArabic('ⴰⵣⵓⵍ ; ⴰⵣⵓⵍ', o)).toBe('أزول ؛ أزول')
  })

  test('no bidi control characters are introduced', () => {
    for (const s of ['ⴰⵣⵓⵍ abc', 'abc ⴰⵣⵓⵍ 123', 'ⵜⴰⵎⴰⵣⵉⵖⵜ (2026)']) {
      expect(toArabic(s)).not.toMatch(BIDI_CONTROLS_RE)
    }
  })

  test('bidi controls outside words are preserved; inside a word they are removed with a diagnostic', () => {
    expect(toArabic('\u2067ⴰⵣⵓⵍ\u2069')).toBe('\u2067أزول\u2069')
    expect(toArabic('ⴰⵣⵓⵍ\u200F')).toBe('أزول\u200F')
    const r = transliterate('ⴰⵣ\u200Fⵓⵍ')
    expect(r.output).toBe('أزول')
    expect(r.warnings).toMatchObject([{ code: 'FORMAT_CHAR_REMOVED', position: 2, source: '\u200F' }])
  })

  test('zero-width characters and the Tifinagh joiner inside words', () => {
    expect(toArabic('ⴰ\u200Dⵣⵓⵍ')).toBe('أزول')
    expect(toArabic('ⴰⵣ⵿ⵣ')).toBe('أزّ')
    expect(toArabic('ⴰ\u00ADⵣⵓⵍ')).toBe('أزول')
  })

  test('warning positions refer to the original input', () => {
    const input = 'abc ⵜⴰⵯ 😀 ⴰⵞ'
    const r = transliterate(input)
    for (const w of r.warnings) expect(input.slice(w.position, w.position + (w.length ?? 0))).toBe(w.source)
  })
})

describe('convert() with Arabic target', () => {
  test('rich result', () => {
    const r = convert('ⵜⴰⵎⴰⵣⵉⵖⵜ', { from: 'tifinagh', to: 'arabic', profile: 'readable' })
    expect(r).toMatchObject({ output: 'تامازيغت', from: 'tifinagh', to: 'arabic', profile: 'readable', warnings: [] })
  })

  test('auto-detects Tifinagh even when other scripts dominate', () => {
    const r = convert('Hello everyone, ⴰⵣⵓⵍ', { to: 'arabic' })
    expect(r.from).toBe('tifinagh')
    expect(r.output).toBe('Hello everyone, أزول')
  })

  test('latin → arabic goes through Tifinagh', () => {
    expect(convert('tamazight', { from: 'latin', to: 'arabic' }).output).toBe('تامازيغت')
    expect(convert('ifassn', { from: 'latin', to: 'arabic' }).output).toBe('ئفاسّن')
  })

  test('alternatives and trace are passed through', () => {
    const r = convert('ⴰⴳⵔ', { to: 'arabic', alternatives: true, trace: true })
    expect(r.alternatives).toHaveLength(1)
    expect(r.trace!.length).toBe(3)
  })
})
