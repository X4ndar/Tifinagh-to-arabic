import {
  AR,
  LETTER_RULES,
  MODIFIER_RULES,
  IRCAM_LETTERS,
  SOURCES,
  resolveOptions,
  toArabic,
  transliterate,
  type ArabicOptions,
} from '../src/index'
import { selectRule } from '../src/rules/engine'
import { tokenizeWord } from '../src/tokenization/units'
import { PROFILE_IDS } from './helpers'

describe('rule metadata', () => {
  const all = [...LETTER_RULES, ...MODIFIER_RULES]
  test('ids are unique and every rule cites known sources', () => {
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length)
    for (const r of all) {
      expect(r.sources.length).toBeGreaterThan(0)
      for (const s of r.sources) expect(SOURCES[s]).toBeDefined()
      expect(r.description.length).toBeGreaterThan(10)
    }
  })

  describe('every executable rule example holds', () => {
    for (const r of LETTER_RULES) {
      for (const ex of r.examples) {
        test(`${r.id}: ${ex.profile} ${ex.input} → ${ex.output}`, () => {
          expect(toArabic(ex.input, { profile: ex.profile })).toBe(ex.output)
        })
      }
    }
    for (const r of MODIFIER_RULES) {
      for (const ex of r.examples) {
        test(`${r.id}: ${ex.profile} ${ex.input} → ${ex.output}`, () => {
          expect(toArabic(ex.input, { profile: ex.profile, arabic: ex.options })).toBe(ex.output)
        })
      }
    }
  })

  test('deterministic precedence: for every letter, context and relevant option set, exactly one top-priority rule matches', () => {
    const prevs = ['boundary', 'vowel', 'schwa', 'consonant', 'semivowel', 'other'] as const
    const combos: Partial<ArabicOptions>[] = []
    for (const initialVowels of ['hamza-seat', 'alef', 'hamza-alef'] as const)
      for (const hiatus of ['hamza-seat', 'plain'] as const)
        for (const plainInitialY of [true, false]) combos.push({ initialVowels, hiatus, plainInitialY })
    for (const l of IRCAM_LETTERS) {
      const unit = tokenizeWord(l.char, 0).units[0]
      for (const prev of prevs) {
        for (const c of combos) {
          const o = resolveOptions('readable', c)
          const chosen = selectRule(unit, prev, o)
          expect(chosen).toBeDefined()
          const same = LETTER_RULES.filter((r) => r.priority === chosen!.priority).filter((r) => {
            const w = r.when
            if (w.letters && !w.letters.includes(l.char)) return false
            if (w.classes && !w.classes.includes(l.cls)) return false
            if (w.prev && !w.prev.includes(prev)) return false
            if (w.options) for (const k of Object.keys(w.options) as (keyof ArabicOptions)[]) if (w.options[k] !== o[k]) return false
            return true
          })
          expect(same).toHaveLength(1)
        }
      }
    }
  })
})

describe('word-initial vowels', () => {
  test.each([
    ['hamza-seat', 'ⴰⵔⴳⴰⵣ', 'ارڭاز'],
    ['hamza-seat', 'ⵉⵎⵉ', 'ئمي'],
    ['hamza-seat', 'ⵓⵙⵎⵎⴰⵏ', 'ؤسمّان'],
    ['alef', 'ⵉⵎⵉ', 'ايمي'],
    ['alef', 'ⵓⵙⵎⵎⴰⵏ', 'اوسمّان'],
    ['hamza-alef', 'ⴰⵔⴳⴰⵣ', 'أرڭاز'],
    ['hamza-alef', 'ⵉⵎⵉ', 'إيمي'],
    ['hamza-alef', 'ⵓⵙⵎⵎⴰⵏ', 'أوسمّان'],
  ] as const)('initialVowels=%s: %s → %s', (style, input, expected) => {
    expect(toArabic(input, { arabic: { initialVowels: style } })).toBe(expected)
  })

  test('medial and final vowels use plain letters', () => {
    expect(toArabic('ⵜⵉⴼⵉⵏⴰⵖ')).toBe('تيفيناغ')
    expect(toArabic('ⵜⴰⵎⵓⵔⵜ')).toBe('تامورت')
    expect(toArabic('ⴰⵎⴰⵏ')).toBe('امان')
    expect(toArabic('ⵉⵍⵍⵉ')).toBe('ئلّي')
  })

  test('each hyphen-separated part is a word (clitics)', () => {
    expect(toArabic('ⵢⴰⵏ-ⵓⵔⵜⵜⵓ')).toBe('يان-ؤرتّو')
  })

  test('word-initial ⵢ is plain ي in ircam (Table II) but marked in phonetic', () => {
    expect(toArabic('ⵢⴰⵢⵢⴰ', { profile: 'ircam' })).toBe('يايٛيٛا')
    expect(toArabic('ⵢⴰⵢⵢⴰ', { profile: 'phonetic' })).toBe('يٛايّٛا')
    expect(toArabic('ⵢⴰⵢⵢⴰ', { profile: 'readable' })).toBe('ايّا'.replace('ا', 'يا'))
  })
})

describe('vowel hiatus', () => {
  test('default: plain letters (Tawalt writes all 87 hiatus words this way), with a diagnostic', () => {
    const r = transliterate('ⵉⵓⵙⵔ')
    expect(r.output).toBe('ئوسر')
    expect(r.warnings.map((w) => w.code)).toEqual(['VOWEL_HIATUS'])
    expect(toArabic('ⵓⵉⵡⵔ')).toBe('ؤيور')
  })
  test('option hiatus=hamza-seat', () => {
    expect(toArabic('ⵜⴰⵉⵔⵉ', { arabic: { hiatus: 'hamza-seat' } })).toBe('تائري')
    expect(toArabic('ⵉⵓⵙⵔ', { arabic: { hiatus: 'hamza-seat' } })).toBe('ئؤسر')
  })
})

describe('initialVowels=hamza-all (Tawalt convention)', () => {
  test('أ / ئ / ؤ', () => {
    const o = { arabic: { initialVowels: 'hamza-all' as const, g: 'gaf' as const } }
    expect(toArabic('ⴰⵙⴰⴳⴳⴰⵍ ⵉⵙⵏⴱⴰⵔ ⵓⵎⴰⵙ', o)).toBe('أساگّال ئسنبار ؤماس')
  })
})

describe('gemination', () => {
  test.each([
    ['shadda', 'ⴰⴽⴽⴰ', 'اكّا'],
    ['double', 'ⴰⴽⴽⴰ', 'اككا'],
    ['single', 'ⴰⴽⴽⴰ', 'اكا'],
  ] as const)('gemination=%s', (style, input, expected) => {
    expect(toArabic(input, { arabic: { gemination: style } })).toBe(expected)
  })

  test('geminate semivowels and emphatics', () => {
    expect(toArabic('ⵜⴰⵡⵡⵓⵔⵜ')).toBe('تاوّورت')
    expect(toArabic('ⵜⴰⴼⵉⵥⵥⴰ')).toBe('تافيژّا')
  })

  test('labialized geminate ⴳⴳⵯ is one unit; marks in canonical order (damma before shadda)', () => {
    const out = toArabic('ⴰⴳⴳⵯⴰ')
    expect(out).toBe('ا' + AR.NG + AR.DAMMA + AR.SHADDA + 'ا')
    expect(out.normalize('NFC')).toBe(out)
    expect(toArabic('ⴰⴳⴳⵯⴰ', { profile: 'ircam' })).toBe('ا' + AR.NG + AR.NG + AR.DAMMA + 'ا')
  })

  test('semivowel mark and shadda are canonically ordered', () => {
    const out = toArabic('ⴰⵡⵡⴰ', { profile: 'phonetic' })
    expect(out).toBe('ا' + AR.WAW + AR.SHADDA + AR.INVERTED_SMALL_V_ABOVE + 'ا')
    expect(out.normalize('NFC')).toBe(out)
  })

  test('three identical consonants: plain letter + geminate, and flagged', () => {
    const r = transliterate('ⴰⵎⵎⵎⴰ')
    expect(r.output).toBe('اممّا')
    expect(r.warnings.map((w) => w.code)).toEqual(['LONG_CONSONANT_RUN'])
    expect(r.warnings[0].source).toBe('ⵎⵎⵎ')
  })

  test('vowels never geminate: repeated vowels are hiatus', () => {
    expect(toArabic('ⵜⴰⴰ')).toBe('تاا')
  })
})

describe('schwa', () => {
  test('omitted in ircam/readable, kasra in phonetic, fatha on request', () => {
    expect(toArabic('ⵜⴰⵎⴻⵣⴳⵉⴷⴰ', { profile: 'ircam' })).toBe('تامزڭيدا')
    expect(toArabic('ⵜⴰⵎⴻⵣⴳⵉⴷⴰ', { profile: 'readable' })).toBe('تامزڭيدا')
    expect(toArabic('ⵜⴰⵎⴻⵣⴳⵉⴷⴰ', { profile: 'phonetic' })).toBe('تامِزڭيدا')
    expect(toArabic('ⵜⴰⵎⴻⵣⴳⵉⴷⴰ', { arabic: { schwa: 'fatha' } })).toBe('تامَزڭيدا')
  })

  test('schwa between identical consonants blocks gemination (IRCAM spelling CeC)', () => {
    expect(toArabic('ⴱⴽⴽⴻⴽ')).toBe('بكّك')
    expect(toArabic('ⴱⴽⴽⴻⴽ', { profile: 'phonetic' })).toBe('بكِّك')
    const r = transliterate('ⴰⵣⴻⵣ', { profile: 'ircam' })
    expect(r.output).toBe('ازز')
    expect(r.warnings.map((w) => w.code)).toEqual(['SCHWA_BETWEEN_IDENTICAL'])
    expect(transliterate('ⴰⵣⴻⵣ', { profile: 'readable' }).warnings).toHaveLength(0)
  })

  test('word-initial schwa with a mark uses an alef carrier', () => {
    expect(toArabic('ⴻⵏ', { profile: 'phonetic' })).toBe('اِن')
    expect(toArabic('ⴻⵏ')).toBe('ن')
  })

  test('schwa omission can be reported', () => {
    const r = transliterate('ⴷⴻⴼ', { arabic: { reportSchwaOmission: true } })
    expect(r.warnings.map((w) => w.code)).toEqual(['SCHWA_OMITTED'])
  })
})

describe('emphatics and option letters', () => {
  test('profiles', () => {
    const w = 'ⴹⵕⵚⵟⵥ'
    expect(toArabic(w, { profile: 'readable' })).toBe('ضرصطژ')
    expect(toArabic(w, { profile: 'ircam' })).toBe('ض' + AR.REH_DOT_BELOW + 'صطژ')
    expect(toArabic(w, { profile: 'phonetic' })).toBe('ض' + AR.REH_DOT_BELOW + 'صطژ')
  })

  test('options', () => {
    expect(toArabic('ⴰⴳ', { arabic: { g: 'gaf' } })).toBe('اگ')
    expect(toArabic('ⴰⴳ', { arabic: { g: 'kaf' } })).toBe('اك')
    expect(toArabic('ⴰⴳ', { arabic: { g: 'qaf3' } })).toBe('اڨ')
    expect(toArabic('ⴰⴽ', { arabic: { k: 'keheh' } })).toBe('اک')
    expect(toArabic('ⴰⵀ', { arabic: { h: 'heh-doachashmee' } })).toBe('اھ')
    expect(toArabic('ⴰⵥ', { arabic: { emphaticZ: 'zah' } })).toBe('اظ')
    expect(toArabic('ⴰⵥ', { arabic: { emphaticZ: 'zain' } })).toBe('از')
    expect(toArabic('ⴰⵕ', { arabic: { emphaticR: 'ircam-literal' } })).toBe('ار' + AR.HEBREW_SEGOL)
    expect(toArabic('ⴰⵡ', { arabic: { semivowelMark: 'ircam-literal' } })).toBe('او' + AR.LATIN_COMBINING_CIRCUMFLEX)
  })

  test('invalid option values are rejected with a clear message', () => {
    expect(() => toArabic('ⴰ', { arabic: { g: 'x' as never } })).toThrow(/Invalid value "x" for option 'g'/)
    expect(() => toArabic('ⴰ', { profile: 'nope' as never })).toThrow(/Unknown profile/)
    expect(() => toArabic('ⴰ', { arabic: { nope: 1 } as never })).toThrow(/Unknown Arabic option/)
  })
})

describe('orthographic invariants', () => {
  const words = ['ⵜⴰⵎⵓⵔⵜ', 'ⵜⴰⵙⴰⴽⵯⵎⵜ', 'ⵜⴰⵎⴰⵣⵉⵖⵜ', 'ⵜⵉⴼⵍⵓⵜ', 'ⴰⵔⴳⴰⵣ', 'ⵜⴰⵔⴳⴰⵣⵜ', 'ⵉⵖⵔⵎ', 'ⵜⵉⵖⵔⵎⵉⵏ', 'ⵜⴰⴷⴷⴰⵔⵜ', 'ⴰⵎⴰⵢⵏⵓ']
  test('never ta marbuta (ة) or alef maqsura (ى)', () => {
    for (const p of PROFILE_IDS) for (const w of words) expect(toArabic(w, { profile: p })).not.toMatch(/[ةى]/)
  })
  test('converted text is NFC-stable in every profile', () => {
    for (const p of PROFILE_IDS) {
      for (const w of [...words, 'ⴰⴳⴳⵯⴰ', 'ⴰⵡⵡⴰ', 'ⴱⴽⴽⴻⴽ', 'ⵢⴰⵢⵢⴰ']) {
        const out = toArabic(w, { profile: p })
        expect(out.normalize('NFC')).toBe(out)
      }
    }
  })
})

describe('trace and alternatives', () => {
  test('trace lists the rules applied per unit', () => {
    const r = transliterate('ⵉⴼⴰⵙⵙⵏ', { trace: true })
    expect(r.trace!.map((t) => [t.source, t.output, t.rules[0]])).toEqual([
      ['ⵉ', 'ئ', 'vowel.initial.hamza-seat.i'],
      ['ⴼ', 'ف', 'letter.base'],
      ['ⴰ', 'ا', 'letter.base'],
      ['ⵙⵙ', 'سّ', 'letter.base'],
      ['ⵏ', 'ن', 'letter.base'],
    ])
    expect(r.trace![3].rules).toContain('gemination.shadda')
  })

  test('alternatives contain documented variants and never the main output', () => {
    const r = transliterate('ⵉⴳⵔ ⵓⵍ', { alternatives: true })
    const first = r.alternatives![0]
    expect(first.output).toBe('ئڭر')
    const outs = first.alternatives.map((a) => a.output)
    expect(outs).toEqual(expect.arrayContaining(['ايڭر', 'إيڭر', 'ئكر', 'ئگر']))
    expect(outs).not.toContain('ئڭر')
    expect(new Set(outs).size).toBe(outs.length)
  })
})

describe('letter-by-letter doubling keeps every letter', () => {
  test('ircam writes a run of three as three letters', () => {
    expect(toArabic('ⴰⵎⵎⵎⴰ', { profile: 'ircam' })).toBe('اممما')
  })
})
