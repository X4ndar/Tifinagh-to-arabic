import fc from 'fast-check'
import { CORRESPONDENCES, IRCAM_LETTERS, normalizeText, toArabic, transliterate } from '../src/index'
import { canonicalMarkOrder } from '../src/normalization/normalize'
import { ARABIC_RE, LONE_SURROGATE_RE, NON_SCHWA_CHARS, PROFILE_IDS, TIFINAGH_RE, lettersOnly } from './helpers'

const RUNS = { numRuns: Number(process.env.FC_RUNS ?? 400) }

/** Any Unicode string without Tifinagh-block code points (and without U+02B7). */
const nonTifinagh = fc.fullUnicodeString({ maxLength: 60 }).filter((s) => !TIFINAGH_RE.test(s) && !s.includes('ʷ'))

/** A well-formed IRCAM word: letters, with ⵯ only after ⴳ/ⴽ. */
const ircamUnit = fc.oneof(
  fc.constantFrom(...IRCAM_LETTERS.map((l) => l.char)),
  fc.constantFrom('ⴳⵯ', 'ⴽⵯ'),
)
const ircamWord = fc
  .array(ircamUnit, { minLength: 1, maxLength: 12 })
  .map((a) => a.join(''))
  .filter((w) => /[^ⴻ]/.test(w)) // a word of only ⴻ is kept unchanged (EMPTY_WORD), tested separately

/** Any sequence of Tifinagh-block code points plus some marks — malformed input welcome. */
const tifinaghNoise = fc
  .array(fc.oneof(fc.integer({ min: 0x2d30, max: 0x2d7f }).map((c) => String.fromCodePoint(c)), fc.constantFrom('\u200D', '\u0301', 'ʷ', ' ', '-')), {
    maxLength: 30,
  })
  .map((a) => a.join(''))

describe('property-based invariants', () => {
  test('1. text without Tifinagh is returned unchanged (all profiles)', () => {
    fc.assert(
      fc.property(nonTifinagh, fc.constantFrom(...PROFILE_IDS), (s, profile) => toArabic(s, { profile }) === s),
      RUNS,
    )
  })

  test('2. conversion is deterministic', () => {
    fc.assert(
      fc.property(fc.fullUnicodeString({ maxLength: 40 }), tifinaghNoise, (a, b) => {
        const s = a + b
        return toArabic(s) === toArabic(s) && JSON.stringify(transliterate(s)) === JSON.stringify(transliterate(s))
      }),
      RUNS,
    )
  })

  test('3. arbitrary input never throws (non-strict) and never creates lone surrogates', () => {
    fc.assert(
      fc.property(fc.fullUnicodeString({ maxLength: 50 }), tifinaghNoise, fc.constantFrom(...PROFILE_IDS), (a, b, profile) => {
        const s = b + a + b
        const out = toArabic(s, { profile })
        return !LONE_SURROGATE_RE.test(out)
      }),
      RUNS,
    )
  })

  test('4. well-formed IRCAM words: no Tifinagh left, only Arabic, and no non-schwa letter lost', () => {
    fc.assert(
      fc.property(ircamWord, (w) => {
        const out = toArabic(w, { profile: 'ircam' }) // gemination=double: one Arabic letter per Tifinagh letter at least
        if (TIFINAGH_RE.test(out) || !ARABIC_RE.test(out)) return false
        const nonSchwa = [...w].filter((c) => NON_SCHWA_CHARS.includes(c)).length
        return [...lettersOnly(out)].length >= nonSchwa
      }),
      RUNS,
    )
  })

  test('5. concatenation: converting "a b" equals converting a and b separately', () => {
    const piece = fc.oneof(ircamWord, nonTifinagh.filter((s) => !/[`~]/.test(s)))
    fc.assert(
      fc.property(piece, piece, (a, b) => toArabic(a + ' ' + b) === toArabic(a) + ' ' + toArabic(b)),
      RUNS,
    )
  })

  test('6. normalization is deterministic and idempotent; output of IRCAM words is NFC-stable', () => {
    fc.assert(
      fc.property(fc.fullUnicodeString({ maxLength: 40 }), fc.constantFrom('NFC', 'NFD', 'NFKC', 'NFKD') as fc.Arbitrary<'NFC'>, (s, form) => {
        const once = normalizeText(s, form)
        return normalizeText(once, form) === once
      }),
      RUNS,
    )
    fc.assert(
      fc.property(fc.array(fc.constantFrom('\u064E', '\u064F', '\u0650', '\u0651', '\u0652', '\u065B'), { maxLength: 6 }), (marks) => {
        const m = marks.join('')
        return canonicalMarkOrder(canonicalMarkOrder(m)) === canonicalMarkOrder(m)
      }),
      RUNS,
    )
    fc.assert(
      fc.property(ircamWord, fc.constantFrom(...PROFILE_IDS), (w, profile) => {
        const out = toArabic(w, { profile })
        return out.normalize('NFC') === out
      }),
      RUNS,
    )
  })

  test('7. unknown-character policy: every unsupported Tifinagh code point is kept and reported', () => {
    const known = new Set([...IRCAM_LETTERS.map((l) => l.char), 'ⴲ', 'ⴵ', 'ⴸ', 'ⵒ', 'ⵝ', 'ⵞ', 'ⵯ', '⵿', '⵰'])
    const unsupported = fc.integer({ min: 0x2d30, max: 0x2d6e }).map((c) => String.fromCodePoint(c)).filter((c) => !known.has(c))
    fc.assert(
      fc.property(ircamWord, unsupported, ircamWord, (a, u, b) => {
        const r = transliterate(a + u + b)
        return r.output.includes(u) && r.warnings.some((w) => w.code === 'UNSUPPORTED_TIFINAGH' && w.source === u)
      }),
      RUNS,
    )
  })

  test('8. warning spans always point at the reported source text', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 10 }), tifinaghNoise, fc.string({ maxLength: 10 }), (a, b, c) => {
        const s = a + b + c
        return transliterate(s).warnings.every((w) => s.slice(w.position, w.position + (w.length ?? 0)) === w.source)
      }),
      RUNS,
    )
  })

  test('9. every documented mapping is exercised by the generator alphabet', () => {
    const units = new Set([...IRCAM_LETTERS.map((l) => l.char), 'ⴳⵯ', 'ⴽⵯ'])
    for (const c of CORRESPONDENCES) expect(units.has(c.tifinagh)).toBe(true)
  })
})
