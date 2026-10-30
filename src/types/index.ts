export type Script = 'tifinagh' | 'latin' | 'arabic'

export type Region = 'morocco' | 'algeria'

/** Warning codes. The first three come from upstream tifinagh-convert. */
export type WarningCode =
  | 'AMBIGUOUS_DIGRAPH'
  | 'UNKNOWN_CHAR'
  | 'APPROXIMATED_CHAR'
  // Tifinagh → Arabic diagnostics
  | 'UNSUPPORTED_TIFINAGH'
  | 'NONSTANDARD_LETTER'
  | 'ORPHAN_LABIALIZATION'
  | 'NONSTANDARD_LABIALIZATION'
  | 'COMBINING_MARK_ON_TIFINAGH'
  | 'FORMAT_CHAR_REMOVED'
  | 'MODIFIER_NORMALIZED'
  | 'SCHWA_OMITTED'
  | 'SCHWA_BETWEEN_IDENTICAL'
  | 'VOWEL_HIATUS'
  | 'LONG_CONSONANT_RUN'
  | 'LEXICON_OVERRIDE'
  | 'LEXICON_CONFLICT'

export type Severity = 'info' | 'warning' | 'error'

export interface ConversionWarning {
  code: WarningCode
  message: string
  /**
   * Position in the input. For Tifinagh → Arabic this is a UTF-16 code-unit
   * offset (what `String.prototype.slice` uses). Upstream Tifinagh → Latin
   * reports a code-point index (unchanged for compatibility).
   */
  position: number
  /** Length (UTF-16 code units) of the input span concerned. Arabic output only. */
  length?: number
  severity?: Severity
  /** The offending source text, when relevant. */
  source?: string
}

export interface ConvertOptions {
  from?: Script
  to: Script
  region?: Region
  /** Arabic output only: conversion profile (default `readable`). */
  profile?: ProfileId
  /** Arabic output only: per-option overrides on top of the profile. */
  arabic?: Partial<ArabicOptions>
  /** Arabic output only: throw on unsupported / malformed Tifinagh. */
  strict?: boolean
  /** Arabic output only: include per-word alternative spellings. */
  alternatives?: boolean
  /** Arabic output only: include a rule-by-rule trace. */
  trace?: boolean
  /** Arabic output only: optional lexicon of validated overrides. */
  lexicon?: LexiconLike | null
}

export interface ConvertResult {
  output: string
  from: Script
  to: Script
  region: Region
  detected: boolean
  warnings: ConversionWarning[]
  /** Present for Arabic output. */
  profile?: ProfileId
  /** Present for Arabic output when `alternatives: true`. */
  alternatives?: WordAlternatives[]
  /** Present for Arabic output when `trace: true`. */
  trace?: TraceEntry[]
}

export interface DetectResult {
  script: Script
  confidence: number
}

export interface CharEntry {
  tifinagh: string
  unicode: string
  latin: string
  type: 'vowel' | 'consonant' | 'modifier'
  region?: Region
  note?: string
}

// ─── Arabic engine types ──────────────────────────────────────────────────────

export type ProfileId = 'ircam' | 'readable' | 'phonetic'

/** How ⴳ /g/ is written. */
export type GStyle = 'ng' | 'gaf' | 'kaf' | 'qaf3'
/** How ⴽ /k/ is written. */
export type KStyle = 'kaf' | 'keheh'
/** How ⵕ /ṛ/ is written. */
export type EmphaticRStyle = 'plain' | 'dot-below' | 'ircam-literal'
/** How ⵥ /ẓ/ is written. */
export type EmphaticZStyle = 'jeh' | 'zah' | 'zain'
/** How the semivowels ⵡ ⵢ are distinguished from the vowels ⵓ ⵉ. */
export type SemivowelMarkStyle = 'none' | 'arabic' | 'ircam-literal'
/** How labialization (ⵯ) is written. */
export type LabializationStyle = 'damma' | 'ircam-table1' | 'omit'
/** How a geminate (doubled) consonant is written. */
export type GeminationStyle = 'shadda' | 'double' | 'single'
/** How the neutral vowel ⴻ is written. */
export type SchwaStyle = 'omit' | 'kasra' | 'fatha'
/** How word-initial vowels are written. */
export type InitialVowelStyle = 'hamza-seat' | 'alef' | 'hamza-alef'
/** How a vowel directly following another vowel is written. */
export type HiatusStyle = 'hamza-seat' | 'plain'
/** How ⵀ is written. */
export type HStyle = 'heh' | 'heh-doachashmee'
/** Punctuation handling around converted text. */
export type PunctuationStyle = 'preserve' | 'arabic'

export interface ArabicOptions {
  g: GStyle
  k: KStyle
  emphaticR: EmphaticRStyle
  emphaticZ: EmphaticZStyle
  semivowelMark: SemivowelMarkStyle
  /** When true, a word-initial ⵢ is written without the semivowel mark (IRCAM Table II). */
  plainInitialY: boolean
  labialization: LabializationStyle
  gemination: GeminationStyle
  schwa: SchwaStyle
  initialVowels: InitialVowelStyle
  hiatus: HiatusStyle
  h: HStyle
  punctuation: PunctuationStyle
  /** Leave URLs and e-mail addresses untouched (default true). */
  protectUrls: boolean
  /** Leave Markdown inline code and fenced code blocks untouched (default true). */
  protectCode: boolean
  /** Report omitted schwas as `info` diagnostics (default false: too noisy). */
  reportSchwaOmission: boolean
}

export interface TraceEntry {
  /** UTF-16 offset of the source unit in the input. */
  position: number
  source: string
  output: string
  /** Rule identifiers that fired, in order. */
  rules: string[]
}

export interface WordAlternatives {
  position: number
  source: string
  output: string
  alternatives: Array<{ output: string; label: string }>
}

export interface LexiconLike {
  lookup(tifinagh: string, profile: ProfileId): LexiconLookup
}

export type LexiconLookup =
  | { kind: 'none' }
  | { kind: 'hit'; arabic: string; source: string; status: LexiconStatus }
  | { kind: 'conflict'; candidates: string[] }

export type LexiconStatus = 'verified' | 'provisional'
