// Baseline converters used by the evaluation. They are deliberately simple and
// independent of the engine's rule code.
import lib from '../dist/index.js'

const { CORRESPONDENCES } = lib

/**
 * Naive one-to-one baseline: each Tifinagh code point → the Arabic *letter*
 * of IRCAM Table I (font-specific marks stripped), schwa → nothing,
 * ⵯ → Table I quote mark. No context, no gemination handling.
 */
const TABLE1 = new Map()
for (const c of CORRESPONDENCES) {
  if ([...c.tifinagh].length !== 1) continue
  const cell = (c.ircamTable1 ?? '').replace(/[\u0302\u05B6‘]/g, '')
  TABLE1.set(c.tifinagh, cell)
}
TABLE1.set('ⵯ', '‘')

export function naiveTable1(text) {
  let out = ''
  for (const ch of text) out += TABLE1.has(ch) ? TABLE1.get(ch) : ch
  return out
}

/**
 * Character map reverse-engineered from mustapharajaa/tamazight-Transliterating-en-ar
 * (all 178,057 unique entries are strict 1:1 substitutions with exactly this map;
 * see docs/research.md). Only the 33 character pairs are reproduced here — none of
 * that repository's data is redistributed.
 */
const DICT_MAP = new Map(
  Object.entries({
    'ⴰ': 'ا', 'ⴱ': 'ب', 'ⴳ': 'ڭ', 'ⴷ': 'د', 'ⴹ': 'ض', 'ⴻ': 'ى', 'ⴼ': 'ف', 'ⴽ': 'ك', 'ⵀ': 'ه', 'ⵃ': 'ح', 'ⵄ': 'ع',
    'ⵅ': 'خ', 'ⵇ': 'ق', 'ⵉ': 'ي', 'ⵊ': 'ج', 'ⵍ': 'ل', 'ⵎ': 'م', 'ⵏ': 'ن', 'ⵓ': 'و', 'ⵔ': 'ر', 'ⵕ': 'ر', 'ⵖ': 'غ',
    'ⵙ': 'س', 'ⵚ': 'ص', 'ⵛ': 'ش', 'ⵜ': 'ت', 'ⵟ': 'ط', 'ⵡ': 'و', 'ⵢ': 'ي', 'ⵣ': 'ز', 'ⵥ': 'ظ', 'ⵯ': 'ڤ',
  }),
)
export function dictionaryStyle(text) {
  let out = ''
  for (const ch of text) out += DICT_MAP.has(ch) ? DICT_MAP.get(ch) : ch
  return out
}

/**
 * Naive Arabic → Tifinagh baseline: one Arabic letter → one Tifinagh letter,
 * ي always ⵉ, و always ⵓ, ر always ⵔ, shadda doubles, other marks dropped.
 * Independent of the engine's reverse rules.
 */
const REV = {
  'ا': 'ⴰ', 'أ': 'ⴰ', 'إ': 'ⵉ', 'آ': 'ⴰ', 'ى': 'ⴰ', 'ئ': 'ⵉ', 'ؤ': 'ⵓ', 'ي': 'ⵉ', 'و': 'ⵓ', 'ب': 'ⴱ', 'ت': 'ⵜ', 'ج': 'ⵊ',
  'ح': 'ⵃ', 'خ': 'ⵅ', 'د': 'ⴷ', 'ر': 'ⵔ', 'ڔ': 'ⵕ', 'ز': 'ⵣ', 'ژ': 'ⵥ', 'ظ': 'ⵥ', 'س': 'ⵙ', 'ش': 'ⵛ', 'ص': 'ⵚ', 'ض': 'ⴹ',
  'ط': 'ⵟ', 'ع': 'ⵄ', 'غ': 'ⵖ', 'ف': 'ⴼ', 'ق': 'ⵇ', 'ك': 'ⴽ', 'ک': 'ⴽ', 'گ': 'ⴳ', 'ڭ': 'ⴳ', 'ل': 'ⵍ', 'م': 'ⵎ', 'ن': 'ⵏ',
  'ه': 'ⵀ',
}
export function naiveReverse(text) {
  let out = ''
  for (const ch of text.normalize('NFC')) {
    if (ch === '\u0651') out += out.slice(-1)
    else if (/[\u064B-\u065F\u0670]/.test(ch)) continue
    else out += REV[ch] ?? ch
  }
  return out
}
