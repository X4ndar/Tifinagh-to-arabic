import type { ConversionWarning, Severity, WarningCode } from '../types/index'

/** Default severity of each diagnostic code produced by the Arabic engine. */
export const SEVERITY: Readonly<Record<WarningCode, Severity>> = {
  AMBIGUOUS_DIGRAPH: 'warning',
  UNKNOWN_CHAR: 'warning',
  APPROXIMATED_CHAR: 'warning',
  UNSUPPORTED_TIFINAGH: 'warning',
  NONSTANDARD_LETTER: 'warning',
  ORPHAN_LABIALIZATION: 'warning',
  NONSTANDARD_LABIALIZATION: 'warning',
  COMBINING_MARK_ON_TIFINAGH: 'warning',
  LONG_CONSONANT_RUN: 'warning',
  LEXICON_CONFLICT: 'warning',
  FORMAT_CHAR_REMOVED: 'info',
  MODIFIER_NORMALIZED: 'info',
  SCHWA_OMITTED: 'info',
  SCHWA_BETWEEN_IDENTICAL: 'info',
  VOWEL_HIATUS: 'info',
  LEXICON_OVERRIDE: 'info',
}

export function hex(ch: string): string {
  return [...ch].map((c) => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' ')
}

export function diag(code: WarningCode, message: string, position: number, source: string): ConversionWarning {
  return { code, severity: SEVERITY[code], message, position, length: source.length, source }
}

/** Error thrown in strict mode. Carries every warning that caused it. */
export class TransliterationError extends Error {
  readonly warnings: ConversionWarning[]
  constructor(message: string, warnings: ConversionWarning[]) {
    super(message)
    this.name = 'TransliterationError'
    this.warnings = warnings
  }
}
