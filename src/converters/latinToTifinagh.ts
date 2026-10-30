import type { ConversionWarning, Region } from '../types/index'
import { LATIN_TO_TIFINAGH } from '../data/mapping'

/** Middle dot U+00B7 — used to disambiguate digraphs */
const MIDDLE_DOT = '\u00B7'

/**
 * Informal / alternate input aliases → direct Tifinagh output.
 * These are common ways people type Amazigh online when they
 * don't have the proper diacritics. Checked before the standard map.
 * Longer sequences must come first.
 */
const ALIASES: [string, string][] = [
  // 2-char sequences first
  ['kh', '\u2D45'], // kh → ⵅ
  ['sh', '\u2D5B'], // sh → ⵛ (same as ch)
  ['ch', '\u2D5B'], // sh → ⵛ (same as ch)
  ['gh', '\u2D56'], // gh → ⵖ


  // single char aliases
  ['v',  '\u2D56'], // v  → ⵖ (gh sound)
  ['\u0263', '\u2D56'], // ɣ → ⵖ (IPA gamma)
  ['x',  '\u2D45'], // x  → ⵅ
  ['o',  '\u2D53'], // o  → ⵓ (same as u)
  ['c',  '\u2D5B'], // c  → ⵛ
  ['3',  '\u2D44'], // 3  → ⵄ (ayin)
  ['\u025B', '\u2D44'], // ɛ → ⵄ (ayin, IPA epsilon)
  ['T',  '\u2D5F'], // T (uppercase) → ⵟ
  ['\u1E6D', '\u2D5F'], // ṭ → ⵟ
  ['D',  '\u2D39'], // D (uppercase) → ⴹ
  ['\u1E0D', '\u2D39'], // ḍ → ⴹ
  ['H',  '\u2D43'], // H (uppercase) → ⵃ
  ['\u1E25', '\u2D43'], // ḥ → ⵃ
  ['R',  '\u2D55'], // R (uppercase) → ⵕ
  ['\u1E5B', '\u2D55'], // ṛ → ⵕ
  ['\u1E5A', '\u2D55'], // Ṛ → ⵕ
  ['S',  '\u2D5A'], // S (uppercase) → ⵚ
  ['\u1E63', '\u2D5A'], // ṣ → ⵚ
  ['\u1E62', '\u2D5A'], // Ṣ → ⵚ
]

interface Result {
  output: string
  warnings: ConversionWarning[]
}

/**
 * Convert Latin text to Tifinagh script.
 * Accepts both standard ALA-LC romanization and common informal
 * typing conventions (kh, sh, 3, capital letters for emphatics…).
 */
export function latinToTifinagh(text: string, _region: Region = 'morocco'): Result {
  const output: string[]              = []
  const warnings: ConversionWarning[] = []
  let i = 0

  while (i < text.length) {
    // Pass whitespace through unchanged
    if (/\s/.test(text[i])) {
      output.push(text[i])
      i++
      continue
    }

    // Middle dot is a disambiguation marker — skip it
    if (text[i] === MIDDLE_DOT) {
      i++
      continue
    }

    // ── Check aliases first (longest match) ───────────────────────────────
    let aliasMatched = false

    // Try 2-char aliases
    if (i + 1 < text.length) {
      const pair = text[i] + text[i + 1]
      const alias2 = ALIASES.find(([k]) => k === pair)
      if (alias2) {
        output.push(alias2[1])
        i += 2
        aliasMatched = true
      }
    }

    if (!aliasMatched) {
      const alias1 = ALIASES.find(([k]) => k === text[i])
      if (alias1) {
        output.push(alias1[1])
        i++
        aliasMatched = true
      }
    }

    if (aliasMatched) continue

    // ── Standard mapping (digraphs first) ────────────────────────────────
    if (i + 1 < text.length && text[i + 1] !== MIDDLE_DOT) {
      const pair = text[i] + text[i + 1]
      if (LATIN_TO_TIFINAGH.has(pair)) {
        if (pair === 'gh' || pair === 'ch') {
          warnings.push({
            code: 'AMBIGUOUS_DIGRAPH',
            message: `'${pair}' at position ${i} was read as a single letter. Use '${pair[0]}\u00B7${pair[1]}' (middle dot) to mean ${pair[0]} then ${pair[1]}.`,
            position: i,
          })
        }
        output.push(LATIN_TO_TIFINAGH.get(pair)!)
        i += 2
        continue
      }
    }

    // Single-character standard match
    const lower = text[i].toLowerCase()
    if (LATIN_TO_TIFINAGH.has(lower)) {
      output.push(LATIN_TO_TIFINAGH.get(lower)!)
      i++
      continue
    }

    if (LATIN_TO_TIFINAGH.has(text[i])) {
      output.push(LATIN_TO_TIFINAGH.get(text[i])!)
      i++
      continue
    }

    // No match
    warnings.push({
      code: 'UNKNOWN_CHAR',
      message: `Unknown character '${text[i]}' at position ${i}. Passed through unchanged.`,
      position: i,
    })
    output.push(text[i])
    i++
  }

  return { output: output.join(''), warnings }
}