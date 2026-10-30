import { Lexicon, LexiconValidationError, toArabic, transliterate } from '../src/index'

const verified = { tifinagh: 'ⴰⴳⴰⴷⵉⵔ', arabic: 'أكادير', status: 'verified' as const, source: 'official Arabic toponym (example)' }

describe('lexicon', () => {
  test('is optional and empty by default: rules apply', () => {
    expect(toArabic('ⴰⴳⴰⴷⵉⵔ')).toBe('أگادير')
  })

  test('verified entries override rule output, with a diagnostic and the rule output as alternative', () => {
    const lexicon = new Lexicon([verified])
    const r = transliterate('ⴰⴳⴰⴷⵉⵔ ⴰⵣⵓⵍ', { lexicon, alternatives: true, trace: true })
    expect(r.output).toBe('أكادير أزول')
    expect(r.warnings.map((w) => w.code)).toEqual(['LEXICON_OVERRIDE'])
    expect(r.alternatives![0].alternatives[0]).toEqual({ output: 'أگادير', label: 'rule-based spelling (lexicon overridden)' })
    expect(r.trace![0].rules).toEqual(['lexicon.override'])
  })

  test('provisional entries never override unless explicitly allowed', () => {
    const e = { ...verified, status: 'provisional' as const }
    expect(toArabic('ⴰⴳⴰⴷⵉⵔ', { lexicon: new Lexicon([e]) })).toBe('أگادير')
    expect(toArabic('ⴰⴳⴰⴷⵉⵔ', { lexicon: new Lexicon([e], { allowProvisional: true }) })).toBe('أكادير')
  })

  test('verified entries win over provisional ones', () => {
    const lex = new Lexicon([verified, { ...verified, arabic: 'اكادير', status: 'provisional' }], { allowProvisional: true })
    expect(toArabic('ⴰⴳⴰⴷⵉⵔ', { lexicon: lex })).toBe('أكادير')
    expect(lex.conflicts()).toEqual([])
  })

  test('conflicts are detected and do not silently pick a spelling', () => {
    const lex = new Lexicon([verified, { ...verified, arabic: 'اڭادير', source: 'other' }])
    expect(lex.conflicts()).toHaveLength(3) // one per profile
    const r = transliterate('ⴰⴳⴰⴷⵉⵔ', { lexicon: lex })
    expect(r.output).toBe('أگادير')
    expect(r.warnings.map((w) => w.code)).toEqual(['LEXICON_CONFLICT'])
  })

  test('profile-restricted entries', () => {
    const lex = new Lexicon([{ ...verified, profiles: ['readable'] }])
    expect(toArabic('ⴰⴳⴰⴷⵉⵔ', { lexicon: lex })).toBe('أكادير')
    expect(toArabic('ⴰⴳⴰⴷⵉⵔ', { lexicon: lex, profile: 'ircam' })).toBe('اڭادير')
  })

  test('lookup uses the normalized word (format characters removed)', () => {
    expect(toArabic('ⴰⴳⴰ\u200Dⴷⵉⵔ', { lexicon: new Lexicon([verified]) })).toBe('أكادير')
  })

  test.each([
    [{ ...verified, tifinagh: 'agadir' }, /non-Tifinagh-letter/],
    [{ ...verified, arabic: 'agadir' }, /single Arabic-script word/],
    [{ ...verified, arabic: 'أكا دير' }, /single Arabic-script word/],
    [{ ...verified, source: ' ' }, /provenance/],
    [{ ...verified, status: 'gold' }, /status/],
    [{ ...verified, profiles: ['x'] }, /profiles/],
    [{ ...verified, extra: 1 }, /unknown field/],
    ['nope', /must be an object/],
  ])('rejects invalid entry %#', (entry, msg) => {
    expect(() => new Lexicon([entry as never])).toThrow(LexiconValidationError)
    expect(() => new Lexicon([entry as never])).toThrow(msg)
  })

  test('fromJSON accepts an array or {entries}, enforces maxEntries', () => {
    expect(Lexicon.fromJSON(JSON.stringify([verified])).size).toBe(1)
    expect(Lexicon.fromJSON({ entries: [verified] }).size).toBe(1)
    expect(() => Lexicon.fromJSON('{"x":1}')).toThrow(/entries/)
    expect(() => Lexicon.fromJSON([verified, { ...verified, tifinagh: 'ⴰ' }], { maxEntries: 1 })).toThrow(/maxEntries/)
  })
})
