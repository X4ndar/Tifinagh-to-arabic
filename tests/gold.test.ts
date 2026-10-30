/**
 * Gold-standard regression: only spellings that come from outside this
 * project (see data/gold/*.json and docs/evaluation.md). No expected value
 * here was produced by the converter.
 *
 * These references write a word-initial ⴰ as bare ا (ازول, افوس), i.e. the
 * IRCAM Table II initial-vowel convention. The default `readable` profile
 * follows the Tawalt dictionary instead (أزول), so the references are checked
 * with `initialVowels: 'hamza-seat'`; everything else is the readable default.
 */
import spec from '../data/gold/specification-examples.json'
import lexemes from '../data/gold/wikidata-lexemes.json'
import { toArabic } from '../src/index'

const TABLE_II = { profile: 'readable' as const, arabic: { initialVowels: 'hamza-seat' as const } }

describe('gold: maintainer-confirmed specification examples (readable + Table II initial vowels)', () => {
  test.each(spec.entries.map((e) => [e.tifinagh, e.arabic]))('%s → %s', (t, a) => {
    expect(toArabic(t, TABLE_II)).toBe(a)
  })
  test('the readable default writes the Tawalt-style initial hamza instead', () => {
    expect(spec.entries.map((e) => toArabic(e.tifinagh))).toEqual(['أزول', 'تامازيغت', 'أمغار'])
  })
})

describe('gold: Wikidata Tachelhit lexemes in Arabic script (readable + Table II initial vowels)', () => {
  test.each(lexemes.entries.map((e) => [e.tifinagh, e.arabic, e.lexeme]))('%s → %s (%s)', (t, a) => {
    expect(toArabic(t, TABLE_II)).toBe(a)
  })
})
