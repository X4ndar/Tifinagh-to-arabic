/**
 * Round trip on the explicitly reversible subset.
 *
 * The `ircam` profile is designed to be letter-by-letter: semivowels and ṛ keep
 * a mark, geminates are written as repeated letters, word-initial vowels use
 * hamza seats. Only the schwa ⴻ is dropped (IRCAM Table I has no Arabic letter
 * for it), so words without ⴻ must decode back to exactly the same Tifinagh.
 * The decoder below is written independently of the engine.
 */
import fc from 'fast-check'
import { IRCAM_LETTERS, toArabic } from '../src/index'

const RUNS = { numRuns: Number(process.env.FC_RUNS ?? 1000) }

const LETTER: Record<string, string> = {
  'ا': 'ⴰ', 'ب': 'ⴱ', 'ڭ': 'ⴳ', 'د': 'ⴷ', 'ض': 'ⴹ', 'ف': 'ⴼ', 'ك': 'ⴽ', 'ه': 'ⵀ', 'ح': 'ⵃ', 'ع': 'ⵄ',
  'خ': 'ⵅ', 'ق': 'ⵇ', 'ي': 'ⵉ', 'ج': 'ⵊ', 'ل': 'ⵍ', 'م': 'ⵎ', 'ن': 'ⵏ', 'و': 'ⵓ', 'ر': 'ⵔ', 'ڔ': 'ⵕ',
  'غ': 'ⵖ', 'س': 'ⵙ', 'ص': 'ⵚ', 'ش': 'ⵛ', 'ت': 'ⵜ', 'ط': 'ⵟ', 'ز': 'ⵣ', 'ژ': 'ⵥ',
}
const DAMMA = 'ُ'
const SEMIVOWEL_MARK = 'ٛ'

/** Decode one word written in the ircam profile back to Tifinagh. */
function decodeWord(ar: string): string {
  const chars = [...ar]
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const initial = i === 0
    let t: string
    if (initial && c === 'ئ') t = 'ⵉ'
    else if (initial && c === 'ؤ') t = 'ⵓ'
    else if (initial && c === 'ي' && chars[i + 1] !== SEMIVOWEL_MARK) t = 'ⵢ'
    else if (c in LETTER) t = LETTER[c]
    else throw new Error(`unexpected character U+${c.codePointAt(0)!.toString(16)} in '${ar}'`)
    // trailing marks
    while (chars[i + 1] === SEMIVOWEL_MARK || chars[i + 1] === DAMMA) {
      const m = chars[++i]
      if (m === SEMIVOWEL_MARK) {
        if (t === 'ⵓ') t = 'ⵡ'
        else if (t === 'ⵉ') t = 'ⵢ'
        else throw new Error(`semivowel mark on '${c}' in '${ar}'`)
      } else t += 'ⵯ'
    }
    out += t
  }
  return out
}
const decode = (ar: string): string => ar.split(' ').map(decodeWord).join(' ')

const unit = fc.oneof(
  { weight: 10, arbitrary: fc.constantFrom(...IRCAM_LETTERS.filter((l) => l.cls !== 'schwa').map((l) => l.char)) },
  { weight: 1, arbitrary: fc.constantFrom('ⴳⵯ', 'ⴽⵯ') },
)
const word = fc.array(unit, { minLength: 1, maxLength: 10 }).map((a) => a.join(''))

describe('ircam profile is reversible on schwa-free words', () => {
  test.each([
    'ⴰⵣⵓⵍ', 'ⵜⴰⵎⴰⵣⵉⵖⵜ', 'ⵉⴼⴰⵙⵙⵏ', 'ⵓⴽⵙⵓⵎ', 'ⴱⵔⴰⵢⵔ', 'ⴰⴳⴳⵯⴰ', 'ⵢⴰⵏ', 'ⵢⵢⴰ', 'ⵡⵡⴰⵙ', 'ⴰⵡⴰⵍ', 'ⵉⵓⵙⵔ', 'ⵜⴰⵇⵕⵕⵓⴹⵜ', 'ⴰⵎⵎⵎⴰ', 'ⴳⵯⴳ', 'ⴳⵯⴳⵯ',
  ])('%s', (w) => {
    expect(decode(toArabic(w, { profile: 'ircam' }))).toBe(w)
  })

  test('random words (property)', () => {
    fc.assert(
      fc.property(fc.array(word, { minLength: 1, maxLength: 4 }), (ws) => {
        const text = ws.join(' ')
        return decode(toArabic(text, { profile: 'ircam' })) === text
      }),
      RUNS,
    )
  })

  test('the only information ircam drops is the schwa', () => {
    expect(decode(toArabic('ⵜⴰⵎⴻⵣⴳⵉⴷⴰ', { profile: 'ircam' }))).toBe('ⵜⴰⵎⵣⴳⵉⴷⴰ')
  })
})
