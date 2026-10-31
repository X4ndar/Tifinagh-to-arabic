/**
 * Metamorphic tests: relations that must hold between related runs of the
 * converter. They need no reference spellings, so they can run on random input.
 */
import fc from 'fast-check'
import { PassThrough } from 'stream'
import {
  ALTERNATIVE_VARIANTS,
  ArabicConverter,
  IRCAM_LETTERS,
  PROFILES,
  convert,
  createConverter,
  toArabic,
  transliterate,
  type ProfileId,
} from '../src/index'
import { main } from '../src/cli/cli'
import { PROFILE_IDS, TIFINAGH_RE, lettersOnly } from './helpers'

const RUNS = { numRuns: Number(process.env.FC_RUNS ?? 400) }
const ASYNC_RUNS = { numRuns: Math.min(Number(process.env.FC_RUNS ?? 150), 300) }

const unit = fc.oneof(
  { weight: 12, arbitrary: fc.constantFrom(...IRCAM_LETTERS.map((l) => l.char)) },
  { weight: 1, arbitrary: fc.constantFrom('ⴳⵯ', 'ⴽⵯ') },
)
const word = fc.array(unit, { minLength: 1, maxLength: 10 }).map((a) => a.join(''))
/** Words with at least one letter that is written in Arabic (not only ⴻ). */
const writtenWord = word.filter((w) => /[^ⴻ]/.test(w))
const profileArb = fc.constantFrom<ProfileId>(...PROFILE_IDS)

/** Realistic messy text: Tifinagh words mixed with punctuation, other scripts, URLs, code and line breaks. */
const piece = fc.oneof(
  { weight: 6, arbitrary: word },
  { weight: 1, arbitrary: fc.constantFrom(' ', '  ', '\t', ', ', '. ', '! ', '-', '(', ')', '«', '»') },
  { weight: 1, arbitrary: fc.constantFrom('bonjour', 'مرحبا', '2026', '😀', 'ⵯ', 'ⵗ', 'ⵝ', '‍', '́', 'ʷ') },
  { weight: 1, arbitrary: fc.constantFrom('https://ⵜⴰ.ma/ⴰ', 'www.x.ma', 'a@b.ma', '`ⴰⵣⵓⵍ`', '``', '`') },
)
const line = fc.array(piece, { maxLength: 12 }).map((a) => a.join(''))
const text = fc
  .array(fc.oneof({ weight: 8, arbitrary: line }, { weight: 1, arbitrary: fc.constantFrom('```', '~~~', '```js', '') }), { maxLength: 8 })
  .chain((lines) => fc.constantFrom('\n', '\r\n').map((eol) => lines.join(eol)))

describe('metamorphic relations', () => {
  test('converting the output again changes nothing (idempotence)', () => {
    fc.assert(
      fc.property(fc.oneof(text, fc.fullUnicodeString({ maxLength: 40 })), profileArb, (s, profile) => {
        const once = toArabic(s, { profile })
        return toArabic(once, { profile }) === once
      }),
      RUNS,
    )
  })

  test('ircam: one Arabic letter per non-schwa Tifinagh letter, exactly', () => {
    fc.assert(
      fc.property(writtenWord, (w) => {
        const out = toArabic(w, { profile: 'ircam' })
        const expected = [...w].filter((c) => c !== 'ⴻ' && c !== 'ⵯ').length
        return [...lettersOnly(out)].length === expected && !TIFINAGH_RE.test(out)
      }),
      RUNS,
    )
  })

  test('streaming line by line equals converting the whole text', () => {
    fc.assert(
      fc.property(text, profileArb, (s, profile) => {
        const c = new ArabicConverter({ profile })
        const whole = c.convert(s)
        const state = { fence: null }
        let offset = 0
        const parts: string[] = []
        const positions: number[] = []
        for (const l of s.split('\n')) {
          const r = c.convertChunk(l, state, offset)
          parts.push(r.output)
          positions.push(...r.warnings.map((w) => w.position))
          offset += l.length + 1
        }
        return parts.join('\n') === whole.output && JSON.stringify(positions) === JSON.stringify(whole.warnings.map((w) => w.position))
      }),
      RUNS,
    )
  })

  test('the CLI gives the same text as the library', async () => {
    await fc.assert(
      fc.asyncProperty(text, profileArb, async (s, profile) => {
        const stdin = new PassThrough()
        const stdout = new PassThrough()
        const stderr = new PassThrough()
        let out = ''
        stdout.on('data', (d) => (out += d.toString()))
        stdin.end(s)
        const code = await main(['--profile', profile], { stdin, stdout, stderr })
        return code === 0 && out === toArabic(s, { profile })
      }),
      ASYNC_RUNS,
    )
  })

  test('every listed alternative is exactly the output of its documented option set', () => {
    const byLabel = new Map(ALTERNATIVE_VARIANTS.map((v) => [v.label, v.options]))
    fc.assert(
      fc.property(word, profileArb, (w, profile) => {
        const r = transliterate(w, { profile, alternatives: true })
        if (!r.alternatives || r.alternatives.length !== 1) return false
        const entry = r.alternatives[0]
        const outs = entry.alternatives.map((a) => a.output)
        if (outs.includes(entry.output) || new Set(outs).size !== outs.length) return false
        return entry.alternatives.every((a) => toArabic(w, { profile, arabic: byLabel.get(a.label) }) === a.output)
      }),
      RUNS,
    )
  })

  test('a profile is fully described by its options (no hidden behaviour)', () => {
    fc.assert(
      fc.property(text, profileArb, (s, profile) => toArabic(s, { profile }) === toArabic(s, { profile: 'readable', arabic: PROFILES[profile].options })),
      RUNS,
    )
  })

  test('convert(), toArabic() and transliterate() agree', () => {
    fc.assert(
      fc.property(text, profileArb, (s, profile) => {
        const a = toArabic(s, { profile })
        const hasTif = /[ⴰ-ⵯ]/.test(s)
        const b = hasTif ? convert(s, { to: 'arabic', profile }).output : a
        return a === b && transliterate(s, { profile }).output === a
      }),
      RUNS,
    )
  })

  test('a word converts the same way whatever surrounds it', () => {
    const surround = fc.constantFrom('', ' ', 'abc ', '«', '2026 ', 'مرحبا ', '\n', '(', '😀')
    fc.assert(
      fc.property(word, surround, surround, profileArb, (w, before, after, profile) => {
        const alone = toArabic(w, { profile })
        return toArabic(before + w + after, { profile }) === toArabic(before, { profile }) + alone + toArabic(after, { profile })
      }),
      RUNS,
    )
  })

  test('a long-lived converter gives the same results as fresh ones (rule cache)', () => {
    const shared = Object.fromEntries(PROFILE_IDS.map((p) => [p, createConverter({ profile: p })])) as Record<ProfileId, ArabicConverter>
    fc.assert(
      fc.property(fc.array(fc.tuple(profileArb, word), { minLength: 1, maxLength: 20 }), (calls) =>
        calls.every(([p, w]) => shared[p].convert(w).output === createConverter({ profile: p }).convert(w).output),
      ),
      RUNS,
    )
  })
})
