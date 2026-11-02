/**
 * Arabic-script Amazigh → Tifinagh (src/reverse/arabicToTifinagh.ts).
 *
 * Arabic script under-specifies Tifinagh (ي/و vowel or semivowel, ر plain or
 * emphatic, unwritten ⴻ), so exact recovery is only guaranteed where the input
 * carries the information: the `ircam` and `phonetic` spellings of this
 * library. For everyday (`readable`) spelling the tests check the documented
 * rules, gold words and a metamorphic property instead.
 */
import fc from 'fast-check'
import {
  ArabicToTifinaghConverter,
  IRCAM_LETTERS,
  isArabicWordChar,
  Lexicon,
  REVERSE_PROFILES,
  REVERSE_RULES,
  TransliterationError,
  arabicToTifinagh,
  convert,
  fromArabic,
  resolveReverseOptions,
  toArabic,
  type ProfileId,
} from '../src/index'
import { LONE_SURROGATE_RE, PROFILE_IDS } from './helpers'

const RUNS = { numRuns: Number(process.env.FC_RUNS ?? 400) }
const rev = (text: string, profile: ProfileId = 'readable', options = {}) => arabicToTifinagh(text, { profile, options }).output

describe('documented rules: every example runs', () => {
  const cases = REVERSE_RULES.flatMap((r) => r.examples.map((e) => [r.id, e.profile, e.input, e.output] as const))
  test.each(cases)('%s (%s): %s → %s', (_id, profile, input, output) => {
    expect(rev(input, profile)).toBe(output)
  })

  test('every rule has an id, sources and a status; ids are unique', () => {
    const ids = REVERSE_RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of REVERSE_RULES) {
      expect(r.sources.length).toBeGreaterThan(0)
      expect(['documented', 'derived', 'heuristic']).toContain(r.status)
    }
  })

  test('every rule id the engine emits is documented', () => {
    const words = REVERSE_RULES.flatMap((r) => r.examples.map((e) => [e.input, e.profile] as const))
    const known = new Set([...REVERSE_RULES.map((r) => r.id), 'passthrough.unsupported', 'lexicon.override'])
    for (const [w, profile] of [...words, ['ثذپچڤة ء', 'readable'] as const, ['ڢ', 'readable'] as const]) {
      const r = arabicToTifinagh(w, { profile, trace: true })
      for (const t of r.trace!) for (const id of t.rules) expect(known).toContain(id)
    }
  })
})

describe('gold words (readable input)', () => {
  test.each([
    // plain and hamza spellings of the same words
    ['ازول', 'ⴰⵣⵓⵍ'],
    ['أزول', 'ⴰⵣⵓⵍ'],
    ['تامازيغت', 'ⵜⴰⵎⴰⵣⵉⵖⵜ'],
    ['امغار', 'ⴰⵎⵖⴰⵔ'],
    ['أمغار', 'ⴰⵎⵖⴰⵔ'],
    ['افوس', 'ⴰⴼⵓⵙ'],
    ['ئفاسّن', 'ⵉⴼⴰⵙⵙⵏ'],
    ['ؤكسوم', 'ⵓⴽⵙⵓⵎ'],
    ['براير', 'ⴱⵔⴰⵢⵔ'],
    ['تيفيناغ', 'ⵜⵉⴼⵉⵏⴰⵖ'],
    ['أسگّاس', 'ⴰⵙⴳⴳⴰⵙ'],
    ['أسگُّاس', 'ⴰⵙⴳⴳⵯⴰⵙ'],
    ['أسكُّاس', 'ⴰⵙⴽⴽⵯⴰⵙ'],
    ['تاوريرت', 'ⵜⴰⵡⵔⵉⵔⵜ'],
    ['أيّور', 'ⴰⵢⵢⵓⵔ'],
    ['والو', 'ⵡⴰⵍⵓ'],
    ['يان', 'ⵢⴰⵏ'],
    // IRCAM Arabic → Tifinagh rule: ر is ⵕ in a word with an emphatic letter
    ['أنژار', 'ⴰⵏⵥⴰⵕ'],
    ['أضار', 'ⴰⴹⴰⵕ'],
    ['أدرار', 'ⴰⴷⵔⴰⵔ'],
    // presentation forms and decomposed hamza are normalized
    ['\uFE83\uFEAF\uFEED\uFEDD', 'ⴰⵣⵓⵍ'], // presentation forms of أزول
    ['أزول', 'ⴰⵣⵓⵍ'],
  ])('%s → %s', (ar, tf) => {
    expect(rev(ar)).toBe(tf)
  })

  test('IRCAM rule examples: ي after a vowel is ⵢ, و after ا is ⵡ, shadda doubles', () => {
    expect(rev('تايري')).toBe('ⵜⴰⵢⵔⵉ')
    expect(rev('تاوادا')).toBe('ⵜⴰⵡⴰⴷⴰ')
    expect(rev('ئمّا')).toBe('ⵉⵎⵎⴰ')
  })

  test('sukun or the semivowel mark makes ي / و a consonant in any profile', () => {
    for (const p of PROFILE_IDS) {
      expect(rev('أسيْلّال', p)).toBe('ⴰⵙⵢⵍⵍⴰⵍ')
      expect(rev('أزوْل', p)).toBe('ⴰⵣⵡⵍ')
      expect(rev('أزوٛل', p)).toBe('ⴰⵣⵡⵍ')
    }
  })
})

describe('profiles as input conventions', () => {
  test('ircam: only marked letters are semivowels / ṛ', () => {
    expect(rev('اوال', 'ircam')).toBe('ⴰⵓⴰⵍ')
    expect(rev('اوٛال', 'ircam')).toBe('ⴰⵡⴰⵍ')
    expect(rev('اضار', 'ircam')).toBe('ⴰⴹⴰⵔ')
    expect(rev('اضاڔ', 'ircam')).toBe('ⴰⴹⴰⵕ')
    expect(rev('يان', 'ircam')).toBe('ⵢⴰⵏ') // Table II: a word-initial plain ي is ⵢ
  })

  test('phonetic: kasra is the neutral vowel ⴻ; readable ignores it (info)', () => {
    expect(rev('تامِزڭيدا', 'phonetic')).toBe('ⵜⴰⵎⴻⵣⴳⵉⴷⴰ')
    const r = arabicToTifinagh('تامِزگيدا')
    expect(r.output).toBe('ⵜⴰⵎⵣⴳⵉⴷⴰ')
    expect(r.warnings.map((w) => [w.code, w.severity])).toEqual([['VOWEL_SIGN_IGNORED', 'info']])
  })

  test('options override the profile; invalid ones throw', () => {
    expect(rev('أضار', 'readable', { emphaticR: 'as-written' })).toBe('ⴰⴹⴰⵔ')
    expect(rev('أوال', 'readable', { semivowels: 'marked' })).toBe('ⴰⵓⴰⵍ')
    expect(rev('أگُا', 'readable', { labialization: 'ignore' })).toBe('ⴰⴳⴰ')
    expect(() => resolveReverseOptions('readable', { semivowels: 'x' as never })).toThrow(/Invalid value "x" for option 'semivowels'/)
    expect(() => resolveReverseOptions('readable', { g: 'ng' } as never)).toThrow(/Unknown Arabic → Tifinagh option 'g'/)
    expect(() => resolveReverseOptions('nope' as ProfileId)).toThrow(/Unknown profile/)
    expect(Object.keys(REVERSE_PROFILES).sort()).toEqual([...PROFILE_IDS].sort())
  })
})

describe('mixed text, punctuation, digits, protection', () => {
  test('non-Arabic text is preserved; Arabic punctuation and digits become international by default', () => {
    expect(rev('Azul — أزول! ⵜⴰⵎⴰⵣⵉⵖⵜ، ١٢٣ ۴۵؟')).toBe('Azul — ⴰⵣⵓⵍ! ⵜⴰⵎⴰⵣⵉⵖⵜ, 123 45?')
    expect(rev('أزول، ١٢', 'readable', { punctuation: 'preserve', digits: 'preserve' })).toBe('ⴰⵣⵓⵍ، ١٢')
  })

  test('URLs, e-mails and code are untouched', () => {
    const t = 'أزول https://ar.wikipedia.org/wiki/أمازيغ `كود` mail@مثال.com'
    expect(rev(t)).toBe('ⴰⵣⵓⵍ https://ar.wikipedia.org/wiki/أمازيغ `كود` mail@مثال.com')
  })

  test('tatweel and formatting characters inside a word are dropped', () => {
    const r = arabicToTifinagh('أزـــول أ\u200Cزول')
    expect(r.output).toBe('ⴰⵣⵓⵍ ⴰⵣⵓⵍ')
    expect(r.warnings.map((w) => w.code)).toEqual(['FORMAT_CHAR_REMOVED'])
  })

  test('letters foreign to Amazigh are approximated with a warning; strict mode throws', () => {
    const r = arabicToTifinagh('ثلاثة ذهب ء')
    expect(r.output).toBe('ⵜⵍⴰⵜⴰ ⴷⵀⴱ ء')
    expect(r.warnings.filter((w) => w.severity === 'warning').map((w) => w.code)).toEqual([
      'APPROXIMATED_CHAR', 'APPROXIMATED_CHAR', 'APPROXIMATED_CHAR', 'APPROXIMATED_CHAR', 'APPROXIMATED_CHAR', 'EMPTY_WORD',
    ])
    expect(() => arabicToTifinagh('ثلاثة', { strict: true })).toThrow(TransliterationError)
    expect(() => arabicToTifinagh('أزول', { strict: true })).not.toThrow()
  })

  test('unknown Arabic letters and marks are kept and reported', () => {
    const r = arabicToTifinagh('أڢ')
    expect(r.output).toBe('ⴰڢ')
    expect(r.warnings[0].code).toBe('UNKNOWN_CHAR')
  })
})

describe('diagnostics and trace', () => {
  test('warning positions point at the source text', () => {
    const t = 'Azul أثَر ـ ثّ'
    for (const w of arabicToTifinagh(t).warnings) expect(t.slice(w.position, w.position + (w.length ?? 0))).toBe(w.source)
  })

  test('trace has one entry per letter with its rules', () => {
    const r = arabicToTifinagh('أژيضر', { trace: true })
    expect(r.trace!.map((t) => [t.source, t.output])).toEqual([['أ', 'ⴰ'], ['ژ', 'ⵥ'], ['ي', 'ⵉ'], ['ض', 'ⴹ'], ['ر', 'ⵕ']])
    expect(r.trace![4].rules).toEqual(['rev.r.emphatic-word'])
  })

  test('streaming chunks give the same output and positions as one call', () => {
    const lines = ['أزول ثلاث', '```', 'كود', '```', 'ئفاسّن ـ']
    const c = new ArabicToTifinaghConverter()
    const whole = c.convert(lines.join('\n'))
    const state = { fence: null }
    let offset = 0
    const outs: string[] = []
    const warnings = []
    for (const l of lines) {
      const r = c.convertChunk(l, state, offset)
      outs.push(r.output)
      warnings.push(...r.warnings)
      offset += l.length + 1
    }
    expect(outs.join('\n')).toBe(whole.output)
    expect(warnings).toEqual(whole.warnings)
  })
})

describe('lexicon in reverse', () => {
  const lex = new Lexicon([
    { tifinagh: 'ⴰⴳⴰⴷⵉⵔ', arabic: 'أكادير', status: 'verified', source: 'official name' },
    { tifinagh: 'ⵜⵉⵣⵏⵉⵜ', arabic: 'تيزنيت', status: 'provisional', source: 'test' },
    { tifinagh: 'ⴰⵙⴰⴼⵓ', arabic: 'أسافو', status: 'verified', source: 'a' },
    { tifinagh: 'ⴰⵙⴰⴼⵡ', arabic: 'أسافو', status: 'verified', source: 'b' },
  ])

  test('a verified entry overrides the rules, vowel signs ignored', () => {
    const r = arabicToTifinagh('أكادير أَكادِير', { lexicon: lex, trace: true })
    expect(r.output).toBe('ⴰⴳⴰⴷⵉⵔ ⴰⴳⴰⴷⵉⵔ')
    expect(r.warnings.map((w) => w.code)).toEqual(['LEXICON_OVERRIDE', 'LEXICON_OVERRIDE'])
    expect(r.trace![0].rules).toEqual(['lexicon.override'])
  })

  test('provisional entries need allowProvisional; conflicts keep the rules', () => {
    expect(rev('تيزنيت')).toBe('ⵜⵉⵣⵏⵉⵜ')
    expect(arabicToTifinagh('تيزنيت', { lexicon: lex }).warnings).toEqual([])
    const r = arabicToTifinagh('أسافو', { lexicon: lex })
    expect(r.output).toBe('ⴰⵙⴰⴼⵓ')
    expect(r.warnings.map((w) => w.code)).toEqual(['LEXICON_CONFLICT'])
    expect(lex.lookupArabic('أكادير', 'ircam')).toEqual({ kind: 'hit', tifinagh: 'ⴰⴳⴰⴷⵉⵔ', source: 'official name', status: 'verified' })
  })
})

describe('convert() and helpers', () => {
  test('from: arabic to tifinagh / latin; detection when from is omitted', () => {
    expect(convert('أزول', { from: 'arabic', to: 'tifinagh' })).toMatchObject({ output: 'ⴰⵣⵓⵍ', from: 'arabic', to: 'tifinagh', detected: false, profile: 'readable' })
    expect(convert('تامازيغت', { from: 'arabic', to: 'latin' }).output).toBe('tamaziɣt')
    expect(convert('Azul أزول', { to: 'tifinagh' })).toMatchObject({ output: 'Azul ⴰⵣⵓⵍ', from: 'arabic', detected: true })
    expect(convert('ⴰⵣⵓⵍ أزول', { to: 'latin' })).toMatchObject({ from: 'tifinagh' })
    expect(convert('', { from: 'arabic', to: 'tifinagh' })).toMatchObject({ output: '', profile: 'readable' })
    expect(convert('أوال', { from: 'arabic', to: 'tifinagh', profile: 'ircam', reverse: { semivowels: 'context' } }).output).toBe('ⴰⵡⴰⵍ')
    expect(convert('أزول', { from: 'arabic', to: 'tifinagh', trace: true }).trace).toHaveLength(4)
    expect(() => convert('ثاء', { from: 'arabic', to: 'tifinagh', strict: true })).toThrow(TransliterationError)
    expect(() => convert('أزول', { from: 'arabic', to: 'arabic' })).toThrow(/cannot be the same/)
  })

  test('fromArabic()', () => {
    expect(fromArabic('أزول فلّاون')).toBe('ⴰⵣⵓⵍ ⴼⵍⵍⴰⵡⵏ')
    expect(fromArabic('اوٛال', { profile: 'ircam' })).toBe('ⴰⵡⴰⵍ')
  })
})

// ── Properties ────────────────────────────────────────────────────────────────

/** A well-formed IRCAM word: letters, ⵯ only after ⴳ/ⴽ. */
const unit = fc.oneof({ weight: 8, arbitrary: fc.constantFrom(...IRCAM_LETTERS.map((l) => l.char)) }, { weight: 1, arbitrary: fc.constantFrom('ⴳⵯ', 'ⴽⵯ') })
const word = (noSchwa: boolean) =>
  fc
    .array(unit, { minLength: 1, maxLength: 10 })
    .map((a) => a.join(''))
    .filter((w) => (noSchwa ? !w.includes('ⴻ') : /[^ⴻ]/.test(w)))
/** Vowels next to each other are spelled the same as some other word (hiatus), so they are excluded where exactness is claimed. */
const noVowelPairs = (w: string) => !/[ⴰⵉⵓⴻ]{2}/.test(w)

describe('properties', () => {
  test('ircam: Arabic written by this library reads back exactly (words without ⴻ)', () => {
    fc.assert(
      fc.property(fc.array(word(true).filter(noVowelPairs), { minLength: 1, maxLength: 5 }), (ws) => {
        const t = ws.join(' ')
        expect(rev(toArabic(t, { profile: 'ircam' }), 'ircam')).toBe(t)
      }),
      RUNS,
    )
  })

  test('phonetic: Arabic written by this library reads back exactly, ⴻ included', () => {
    fc.assert(
      fc.property(fc.array(word(false).filter(noVowelPairs), { minLength: 1, maxLength: 5 }), (ws) => {
        const t = ws.join(' ')
        expect(rev(toArabic(t, { profile: 'phonetic' }), 'phonetic')).toBe(t)
      }),
      RUNS,
    )
  })

  test('readable (metamorphic): the Tifinagh read back is spelled exactly like the original', () => {
    // Documented limitations of everyday spelling: ⵔⵕ / ⵕⵔ is written رر, which reads as a geminate;
    // a word-initial ئي / ؤو is read as one vowel (Tawalt practice), so initial ⵉⵢ / ⵓⵡ do not come back.
    const plainR = (w: string) => !/ⵔⵕ|ⵕⵔ/.test(w) && !/^(ⵉⵢ|ⵓⵡ)/.test(w)
    fc.assert(
      fc.property(fc.array(word(false).filter((w) => noVowelPairs(w) && plainR(w)), { minLength: 1, maxLength: 5 }), (ws) => {
        const ar = toArabic(ws.join(' '))
        expect(toArabic(rev(ar))).toBe(ar)
      }),
      RUNS,
    )
  })

  test('any input: never throws (non-strict), keeps text without Arabic letters, positions are exact, no lone surrogates', () => {
    const chars = fc.oneof(
      fc.integer({ min: 0x0600, max: 0x06ff }).map((c) => String.fromCodePoint(c)),
      fc.constantFrom(' ', '\n', '\u200D', 'ـ', 'a', 'ⴰ', '`', 'https://x.ma/أ ', '\uFEFB', '\u0654', '😀'),
      fc.fullUnicode(),
    )
    fc.assert(
      fc.property(fc.array(chars, { maxLength: 40 }).map((a) => a.join('')), fc.constantFrom(...PROFILE_IDS), (t, p) => {
        const r = arabicToTifinagh(t, { profile: p })
        for (const w of r.warnings) expect(t.slice(w.position, w.position + (w.length ?? 0))).toBe(w.source)
        expect(LONE_SURROGATE_RE.test(r.output)).toBe(LONE_SURROGATE_RE.test(t))
        const convertible = [...t].some((c) => isArabicWordChar(c.codePointAt(0)!)) || /[٠-٩۰-۹،؛؟٪-٬]/.test(t)
        if (!convertible) expect(r.output).toBe(t)
        // idempotent: the output has no Arabic word left to convert, except kept unknowns
        if (!r.warnings.some((w) => w.code === 'UNKNOWN_CHAR' || w.code === 'EMPTY_WORD')) expect(rev(r.output, p)).toBe(r.output)
      }),
      RUNS,
    )
  })
})
