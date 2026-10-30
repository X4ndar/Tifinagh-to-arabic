/**
 * Gold-standard regression: only spellings that come from outside this
 * project (see data/gold/*.json and docs/evaluation.md). No expected value
 * here was produced by the converter.
 */
import spec from '../data/gold/specification-examples.json'
import lexemes from '../data/gold/wikidata-lexemes.json'
import { toArabic } from '../src/index'

describe('gold: maintainer-confirmed specification examples (readable)', () => {
  test.each(spec.entries.map((e) => [e.tifinagh, e.arabic]))('%s → %s', (t, a) => {
    expect(toArabic(t, { profile: 'readable' })).toBe(a)
  })
})

describe('gold: Wikidata Tachelhit lexemes in Arabic script (readable)', () => {
  test.each(lexemes.entries.map((e) => [e.tifinagh, e.arabic, e.lexeme]))('%s → %s (%s)', (t, a) => {
    expect(toArabic(t, { profile: 'readable' })).toBe(a)
  })
})
