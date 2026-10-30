import {
  AR,
  CORRESPONDENCES,
  EXTENDED_LETTERS,
  IRCAM_LETTERS,
  SOURCES,
  toArabic,
  transliterate,
} from '../src/index'
import { ARABIC_RE, PROFILE_IDS, TIFINAGH_RE, column } from './helpers'

describe('IRCAM inventory', () => {
  test('31 basic letters + 2 labialized = 33 IRCAM units', () => {
    expect(IRCAM_LETTERS).toHaveLength(31)
    expect(new Set(IRCAM_LETTERS.map((l) => l.char)).size).toBe(31)
    const by = (c: string) => IRCAM_LETTERS.filter((l) => l.cls === c).length
    // IRCAM: 27 consonants including the 2 labialized ones, 2 semi-consonants, 3 full vowels + schwa
    expect(by('consonant')).toBe(25)
    expect(by('semivowel')).toBe(2)
    expect(by('vowel')).toBe(3)
    expect(by('schwa')).toBe(1)
    expect(CORRESPONDENCES).toHaveLength(33)
  })

  test('code points are in the IRCAM range U+2D30…U+2D65 and labels match', () => {
    for (const l of IRCAM_LETTERS) {
      const cp = l.char.codePointAt(0)!
      expect(cp).toBeGreaterThanOrEqual(0x2d30)
      expect(cp).toBeLessThanOrEqual(0x2d65)
      expect(l.codePoint).toBe('U+' + cp.toString(16).toUpperCase())
    }
  })

  test('every IRCAM letter and labialized unit has exactly one correspondence row', () => {
    for (const l of IRCAM_LETTERS) expect(CORRESPONDENCES.filter((c) => c.tifinagh === l.char)).toHaveLength(1)
    expect(CORRESPONDENCES.filter((c) => c.tifinagh === 'ⴳⵯ')).toHaveLength(1)
    expect(CORRESPONDENCES.filter((c) => c.tifinagh === 'ⴽⵯ')).toHaveLength(1)
  })

  test('every row and letter cites known sources', () => {
    for (const c of CORRESPONDENCES) {
      expect(c.sources.length).toBeGreaterThan(0)
      for (const s of c.sources) expect(SOURCES[s]).toBeDefined()
      for (const a of c.alternatives) for (const s of a.sources) expect(SOURCES[s]).toBeDefined()
    }
    for (const l of [...IRCAM_LETTERS, ...EXTENDED_LETTERS]) for (const s of l.sources) expect(SOURCES[s]).toBeDefined()
  })
})

describe('IRCAM Table I / Table II transcription (visually verified values)', () => {
  const t1 = (t: string) => CORRESPONDENCES.find((c) => c.tifinagh === t)!.ircamTable1
  const t2 = (t: string) => CORRESPONDENCES.find((c) => c.tifinagh === t)!.ircamTable2
  test('Table I', () => {
    expect(t1('ⴳ')).toBe('گ') // گ
    expect(t1('ⵥ')).toBe('ژ') // ژ
    expect(t1('ⴻ')).toBeNull() // empty cell
    expect(t1('ⵢ')).toBe('ي̂') // ي + circumflex (text layer)
    expect(t1('ⵕ')).toBe('رֶ') // ر + Hebrew segol (text layer)
    expect(t1('ⵛ')).toBe('ش')
    expect(t1('ⵄ')).toBe('ع')
  })
  test('Table II', () => {
    expect(t2('ⴳ')).toEqual({ arabic: 'ڭ', context: 'everywhere' })
    expect(t2('ⴳⵯ')).toEqual({ arabic: 'ڭُ', context: 'everywhere' })
    expect(t2('ⴽⵯ')).toEqual({ arabic: 'كُ', context: 'everywhere' })
    expect(t2('ⵉ')).toEqual({ arabic: 'ئ', context: 'word-initial' })
    expect(t2('ⵓ')).toEqual({ arabic: 'ؤ', context: 'word-initial' })
    expect(t2('ⵢ')).toEqual({ arabic: 'ي', context: 'word-initial' })
  })
})

/** Put a unit between two neutral consonants that differ from it. */
function frame(unit: string): [string, string, string] {
  const pool = ['ⴱ', 'ⴷ', 'ⵏ', 'ⵎ']
  const [p, s] = pool.filter((c) => c !== unit[0])
  return [p, unit, s]
}

describe('every correspondence, every profile (word-medial context)', () => {
  for (const profile of PROFILE_IDS) {
    for (const row of CORRESPONDENCES) {
      test(`${profile}: ${row.tifinagh} (${row.latin}) → ${JSON.stringify(row.profiles[profile])}`, () => {
        const [p, u, s] = frame(row.tifinagh)
        const out = toArabic(p + u + s, { profile })
        expect(out).toBe(column(p, profile) + row.profiles[profile] + column(s, profile))
        expect(out).toMatch(ARABIC_RE)
      })
    }
  }

  test('isolated single letters convert without Tifinagh remaining', () => {
    for (const profile of PROFILE_IDS) {
      for (const l of IRCAM_LETTERS) {
        const out = toArabic(l.char, { profile })
        expect(out).not.toMatch(TIFINAGH_RE)
        expect(out).toMatch(ARABIC_RE)
      }
    }
  })
})

describe('labialization (U+2D6F)', () => {
  test('ⴳⵯ and ⴽⵯ are single units (longest match)', () => {
    const r = transliterate('ⴰⴳⵯⵎⵎⴰⵔ', { trace: true })
    expect(r.trace!.map((t) => t.source)).toEqual(['ⴰ', 'ⴳⵯ', 'ⵎⵎ', 'ⴰ', 'ⵔ'])
    expect(r.output).toBe('اڭُمّار')
    expect(toArabic('ⴰⴽⵯⴰⵎ')).toBe('اكُام')
  })

  test('the Table I quote-mark style is available and documented', () => {
    expect(toArabic('ⴰⴳⵯⴰ', { arabic: { labialization: 'ircam-table1', g: 'gaf' } })).toBe('اگ' + AR.LEFT_SINGLE_QUOTE + 'ا')
  })

  test('labialization on other consonants is converted but flagged', () => {
    const r = transliterate('ⵅⵯⴰ')
    expect(r.output).toBe('خُا')
    expect(r.warnings.map((w) => w.code)).toEqual(['NONSTANDARD_LABIALIZATION'])
  })

  test.each([
    ['word-initial', 'ⵯⴰⵏ', 'ⵯان'],
    ['after a vowel', 'ⴰⵯⵏ', 'اⵯن'],
    ['after schwa', 'ⴷⴻⵯ', 'دⵯ'],
    ['doubled mark', 'ⴳⵯⵯ', 'ڭُⵯ'],
    ['alone', 'ⵯ', 'ⵯ'],
  ])('invalid placement (%s) keeps the mark and warns', (_label, input, expected) => {
    const r = transliterate(input)
    expect(r.output).toBe(expected)
    expect(r.warnings.some((w) => w.code === 'ORPHAN_LABIALIZATION')).toBe(true)
  })

  test('U+02B7 (ʷ) after a Tifinagh consonant is normalized to ⵯ', () => {
    const r = transliterate('ⴰⴳʷⴰ')
    expect(r.output).toBe('اڭُا')
    expect(r.warnings.map((w) => w.code)).toEqual(['MODIFIER_NORMALIZED'])
  })
})

describe('non-IRCAM Tifinagh', () => {
  test.each(EXTENDED_LETTERS.map((l) => [l.char, l.latin]))('extended letter %s (%s) converts with NONSTANDARD_LETTER', (ch) => {
    const r = transliterate('ⴰ' + ch + 'ⴰ')
    expect(r.output).not.toMatch(TIFINAGH_RE)
    expect(r.warnings.map((w) => w.code)).toEqual(['NONSTANDARD_LETTER'])
  })

  test('every other Tifinagh-block code point is preserved with UNSUPPORTED_TIFINAGH', () => {
    const known = new Set([...IRCAM_LETTERS, ...EXTENDED_LETTERS].map((l) => l.char))
    for (let cp = 0x2d30; cp <= 0x2d6e; cp++) {
      const ch = String.fromCodePoint(cp)
      if (known.has(ch)) continue
      const r = transliterate('ⴰ' + ch)
      expect(r.output).toBe('ا' + ch)
      expect(r.warnings.map((w) => w.code)).toEqual(['UNSUPPORTED_TIFINAGH'])
    }
  })

  test('U+2D70 separator mark is punctuation and is preserved', () => {
    const r = transliterate('ⴰⵣⵓⵍ⵰')
    expect(r.output).toBe('ازول⵰')
    expect(r.warnings).toHaveLength(0)
  })
})
