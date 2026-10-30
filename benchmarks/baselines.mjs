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
  const cell = (c.ircamTable1 ?? '').replace(/[ֶ̂‘]/g, '')
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
