import type { ConversionWarning, Region } from '../types/index'
import { TIFINAGH_TO_LATIN } from '../data/mapping'

const LABIALIZATION_MARK = '\u2D6F'

interface Result {
  output: string
  warnings: ConversionWarning[]
}

/**
 * Convert Tifinagh text to Latin script.
 * Uses greedy longest-match: tries 2-codepoint sequences first (labialized consonants),
 * then falls back to single codepoints.
 */
export function tifinaghToLatin(text: string, _region: Region = 'morocco'): Result {
  const chars    = [...text]
  const output: string[]              = []
  const warnings: ConversionWarning[] = []
  let i = 0

  while (i < chars.length) {
    // Pass whitespace through unchanged
    if (/\s/.test(chars[i])) {
      output.push(chars[i])
      i++
      continue
    }

    // Try 2-codepoint match first (labialized consonants: base + tamatart)
    if (i + 1 < chars.length) {
      const pair = chars[i] + chars[i + 1]
      if (TIFINAGH_TO_LATIN.has(pair)) {
        output.push(TIFINAGH_TO_LATIN.get(pair)!)
        i += 2
        continue
      }
    }

    // Guard against isolated tamatart
    if (chars[i] === LABIALIZATION_MARK) {
      warnings.push({
        code: 'UNKNOWN_CHAR',
        message: `Isolated tamatart (U+2D6F) at position ${i} — expected after a consonant.`,
        position: i,
      })
      i++
      continue
    }

    // Single-codepoint match
    if (TIFINAGH_TO_LATIN.has(chars[i])) {
      output.push(TIFINAGH_TO_LATIN.get(chars[i])!)
      i++
      continue
    }

    // No match — pass through and warn
    const hex = chars[i].codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')
    warnings.push({
      code: 'UNKNOWN_CHAR',
      message: `Unknown Tifinagh character '${chars[i]}' (U+${hex}) at position ${i}. Passed through unchanged.`,
      position: i,
    })
    output.push(chars[i])
    i++
  }

  return { output: output.join(''), warnings }
}
