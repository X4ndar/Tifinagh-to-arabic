import type { DetectResult, Script } from '../types/index'

const isArabic = (char: string): boolean => {
  const cp = char.codePointAt(0) ?? 0
  return (cp >= 0x0600 && cp <= 0x06FF) ||
         (cp >= 0x0750 && cp <= 0x077F) ||
         (cp >= 0xFB50 && cp <= 0xFDFF) ||
         (cp >= 0xFE70 && cp <= 0xFEFF)
}

const isTifinagh = (char: string): boolean => {
  const cp = char.codePointAt(0) ?? 0
  return cp >= 0x2D30 && cp <= 0x2D7F
}

const isLatin = (char: string): boolean => {
  const cp = char.codePointAt(0) ?? 0
  return (cp >= 0x0041 && cp <= 0x007A) ||
         (cp >= 0x00C0 && cp <= 0x024F) ||
         (cp >= 0x1E00 && cp <= 0x1EFF)
}

/**
 * Detect which script a string is written in.
 *
 * @example
 * detect('ⵎⵓⵔ')  // { script: 'tifinagh', confidence: 1 }
 * detect('mur')   // { script: 'latin',    confidence: 1 }
 */
export function detect(text: string): DetectResult {
  let tifinaghCount = 0
  let latinCount    = 0
  let arabicCount   = 0
  let total         = 0

  for (const char of text) {
    if (/\s/.test(char)) continue
    total++
    if (isTifinagh(char))    tifinaghCount++
    else if (isArabic(char)) arabicCount++
    else if (isLatin(char))  latinCount++
  }

  if (total === 0) return { script: 'latin', confidence: 0 }

  const scores: [Script, number][] = [
    ['tifinagh', tifinaghCount / total],
    ['arabic',   arabicCount   / total],
    ['latin',    latinCount    / total],
  ]

  scores.sort((a, b) => b[1] - a[1])
  const [script, confidence] = scores[0]
  return { script, confidence: Math.round(confidence * 100) / 100 }
}
