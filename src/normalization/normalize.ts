import { CONSONANT_JOINER } from '../alphabet/inventory'

const FORMAT_RE = /^\p{Cf}$/u
const COMBINING_RE = /^[\p{Mn}\p{Me}]$/u

/**
 * Formatting characters that may appear *inside* a Tifinagh word and carry
 * no phonological content: Unicode Cf (ZWSP, ZWJ, ZWNJ, soft hyphen, bidi
 * marks/embeddings/isolates, BOM, …) plus U+2D7F TIFINAGH CONSONANT JOINER
 * (category Mn, but purely a ligature request).
 */
export function isFormatChar(ch: string): boolean {
  return ch === CONSONANT_JOINER || FORMAT_RE.test(ch)
}

/** Nonspacing / enclosing combining marks (excluding the Tifinagh joiner). */
export function isCombiningMark(ch: string): boolean {
  return ch !== CONSONANT_JOINER && COMBINING_RE.test(ch)
}

/**
 * Optional whole-text Unicode normalization. The converter itself never
 * normalizes non-Tifinagh text (so Arabic/Latin passages are preserved
 * byte-for-byte); callers may opt in with `normalizeText(text, 'NFC')`.
 * Tifinagh has no canonical decompositions, so NFC/NFD do not change it.
 */
export function normalizeText(text: string, form: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | 'none' = 'NFC'): string {
  return form === 'none' ? text : text.normalize(form)
}

/**
 * Put a sequence of Arabic combining marks into canonical (NFC/NFD) order
 * without decomposing anything else: the marks are reordered behind a
 * non-decomposable carrier (alef, U+0627) and the carrier is then removed.
 */
export function canonicalMarkOrder(marks: string): string {
  if (marks.length < 2) return marks
  return ('ا' + marks).normalize('NFD').slice(1)
}
