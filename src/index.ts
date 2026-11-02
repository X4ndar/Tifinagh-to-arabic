import { detect as detectScript } from './converters/detect'
import { tifinaghToLatin } from './converters/tifinaghToLatin'
import { latinToTifinagh } from './converters/latinToTifinagh'
import { MAPPING } from './data/mapping'
import { ArabicConverter, type ArabicConverterConfig, type ArabicResult } from './core/arabic'
import { ArabicToTifinaghConverter, type ReverseConverterConfig, type ReverseResult } from './reverse/arabicToTifinagh'

import type { ConvertOptions, ConvertResult, CharEntry, Region, Script } from './types/index'

// ─── Re-export all public types ───────────────────────────────────────────────
export type {
  Script,
  Region,
  ConvertOptions,
  ConvertResult,
  DetectResult,
  ConversionWarning,
  CharEntry,
  WarningCode,
  Severity,
  ProfileId,
  ArabicOptions,
  TraceEntry,
  WordAlternatives,
  LexiconLike,
  LexiconLookup,
  LexiconStatus,
  ReverseLexiconLookup,
  GStyle,
  KStyle,
  EmphaticRStyle,
  EmphaticZStyle,
  SemivowelMarkStyle,
  LabializationStyle,
  GeminationStyle,
  SchwaStyle,
  InitialVowelStyle,
  HiatusStyle,
  HStyle,
  PunctuationStyle,
} from './types/index'

// ─── Arabic engine: classes, data and helpers ────────────────────────────────
export { ArabicConverter, ALTERNATIVE_VARIANTS, tifinaghToArabic } from './core/arabic'
export type { ArabicConverterConfig, ArabicResult } from './core/arabic'
export { PROFILES, DEFAULT_PROFILE, resolveOptions, OPTION_VALUES } from './profiles/profiles'
export type { ProfileDefinition } from './profiles/profiles'
export { CORRESPONDENCES, EXTENDED_CORRESPONDENCES, AR, baseArabic } from './alphabet/arabic'
export type { Correspondence, ArabicAlternative } from './alphabet/arabic'
export { IRCAM_LETTERS, EXTENDED_LETTERS, IRCAM_LABIALIZED, LABIALIZATION_MARK } from './alphabet/inventory'
export type { TifinaghLetter, LetterClass } from './alphabet/inventory'
export { SOURCES } from './alphabet/sources'
export type { SourceId, SourceRef } from './alphabet/sources'
export { LETTER_RULES, MODIFIER_RULES } from './rules/rules'
export type { Rule, ModifierRule, Condition, Action } from './rules/rules'
export { Lexicon, validateEntry, LexiconValidationError, arabicLexiconKey } from './lexicon/lexicon'
export type { LexiconEntry, LexiconOptions, LexiconConflict } from './lexicon/lexicon'
export { TransliterationError, SEVERITY } from './diagnostics/diagnostics'
export { normalizeText } from './normalization/normalize'
export { tokenizeWord } from './tokenization/units'
export type { Unit, TokenizedWord } from './tokenization/units'
export { segment } from './tokenization/segment'
export type { Segment, SegmentState } from './tokenization/segment'

// ─── Arabic → Tifinagh ───────────────────────────────────────────────────────
export {
  ArabicToTifinaghConverter,
  arabicToTifinagh,
  REVERSE_PROFILES,
  REVERSE_RULES,
  REVERSE_OPTION_VALUES,
  resolveReverseOptions,
  isArabicWordChar,
} from './reverse/arabicToTifinagh'
export type { ReverseOptions, ReverseRule, ReverseConverterConfig, ReverseResult } from './reverse/arabicToTifinagh'

// ─── detect() ────────────────────────────────────────────────────────────────
export { detectScript as detect }

const HAS_TIFINAGH = /[ⴰ-ⵯ]/
const HAS_ARABIC_LETTER = /[\u0621-\u064A\u0671-\u06D3\uFB50-\uFDFB\uFE70-\uFEFC]/

function reverseConfig(options: Omit<ConvertOptions, 'to' | 'from' | 'region'>): ReverseConverterConfig {
  return {
    profile: options.profile,
    options: options.reverse,
    strict: options.strict,
    trace: options.trace,
    lexicon: options.lexicon ?? null,
  }
}

function arabicConfig(options: Omit<ConvertOptions, 'to' | 'from' | 'region'>): ArabicConverterConfig {
  return {
    profile: options.profile,
    arabic: options.arabic,
    strict: options.strict,
    alternatives: options.alternatives,
    trace: options.trace,
    lexicon: options.lexicon ?? null,
  }
}

// ─── convert() ───────────────────────────────────────────────────────────────

/**
 * Convert text between Tifinagh, Latin, and Arabic scripts.
 *
 * Supported directions: tifinagh → latin, latin → tifinagh,
 * tifinagh → arabic (direct, rule-based), latin → arabic (via Tifinagh),
 * arabic → tifinagh (rule-based), arabic → latin (via Tifinagh).
 *
 * @example
 * convert('ⵜⴰⵎⴰⵣⵉⵖⵜ', { from: 'tifinagh', to: 'arabic', profile: 'readable' }).output
 * // → 'تامازيغت'
 *
 * @example
 * convert('أزول', { from: 'arabic', to: 'tifinagh' }).output  // → 'ⴰⵣⵓⵍ'
 *
 * @example
 * convert('ⵎⵓⵔ', { to: 'latin' }).output  // → 'mur'
 */
export function convert(text: string, options: ConvertOptions): ConvertResult {
  if (typeof text !== 'string') {
    throw new TypeError('convert(): text must be a string.')
  }
  if (!options || !options.to) {
    throw new Error("convert(): options.to is required ('tifinagh', 'latin' or 'arabic').")
  }

  const region: Region = options.region ?? 'morocco'
  const to: Script = options.to

  let from = options.from
  let detected = false
  if (!from) {
    // For Arabic output, any Tifinagh in the input means "convert the Tifinagh parts";
    // for Tifinagh/Latin output, Arabic letters (and no Tifinagh) mean "convert the Arabic parts".
    if (to === 'arabic' && HAS_TIFINAGH.test(text)) from = 'tifinagh'
    else if (to !== 'arabic' && !HAS_TIFINAGH.test(text) && HAS_ARABIC_LETTER.test(text)) from = 'arabic'
    else from = detectScript(text).script
    detected = true
  }

  if (from === to) {
    throw new Error(`convert(): 'from' and 'to' cannot be the same script ('${from}').`)
  }

  // Empty input is valid and yields empty output (upstream threw; see docs/architecture.md §Compatibility).
  if (text === '') {
    const base: ConvertResult = { output: '', from, to, region, detected, warnings: [] }
    if (to === 'arabic' || from === 'arabic') base.profile = options.profile ?? 'readable'
    return base
  }

  if (from === 'tifinagh' && to === 'latin') {
    const { output, warnings } = tifinaghToLatin(text, region)
    return { output, from, to, region, detected, warnings }
  }

  if (from === 'latin' && to === 'tifinagh') {
    const { output, warnings } = latinToTifinagh(text, region)
    return { output, from, to, region, detected, warnings }
  }

  if (to === 'arabic' && (from === 'tifinagh' || from === 'latin')) {
    let source = text
    const preWarnings = []
    if (from === 'latin') {
      const t = latinToTifinagh(text, region)
      source = t.output
      preWarnings.push(...t.warnings)
    }
    const r: ArabicResult = new ArabicConverter(arabicConfig(options)).convert(source)
    const result: ConvertResult = {
      output: r.output,
      from,
      to,
      region,
      detected,
      warnings: [...preWarnings, ...r.warnings],
      profile: r.profile,
    }
    if (r.alternatives) result.alternatives = r.alternatives
    if (r.trace) result.trace = r.trace
    return result
  }

  if (from === 'arabic' && (to === 'tifinagh' || to === 'latin')) {
    const r: ReverseResult = new ArabicToTifinaghConverter(reverseConfig(options)).convert(text)
    let output = r.output
    const warnings = [...r.warnings]
    if (to === 'latin') {
      const l = tifinaghToLatin(r.output, region)
      output = l.output
      warnings.push(...l.warnings)
    }
    const result: ConvertResult = { output, from, to, region, detected, warnings, profile: r.profile }
    if (r.trace) result.trace = r.trace
    return result
  }

  throw new Error(`Unsupported conversion: ${from} → ${to}`)
}

// ─── Arabic convenience API ──────────────────────────────────────────────────

export type ToArabicOptions = ArabicConverterConfig

/**
 * Transliterate the Tifinagh parts of `text` into Arabic script and return
 * the string. Non-Tifinagh content is preserved.
 *
 * @example toArabic('ⴰⵣⵓⵍ')  // → 'ازول'
 */
export function toArabic(text: string, options: ToArabicOptions = {}): string {
  return new ArabicConverter(options).convert(text).output
}

/**
 * Rich Tifinagh → Arabic transliteration: output plus diagnostics, and
 * optionally alternatives and a rule trace.
 */
export function transliterate(text: string, options: ToArabicOptions = {}): ArabicResult {
  return new ArabicConverter(options).convert(text)
}

/**
 * Arabic-script Amazigh → Tifinagh. Text in other scripts is preserved.
 *
 * @example fromArabic('أزول')  // → 'ⴰⵣⵓⵍ'
 */
export function fromArabic(text: string, options: ReverseConverterConfig = {}): string {
  return new ArabicToTifinaghConverter(options).convert(text).output
}

/** Create a reusable converter (options validated once; use for batches). */
export function createConverter(options: ToArabicOptions = {}): ArabicConverter {
  return new ArabicConverter(options)
}

// ─── alphabet() ──────────────────────────────────────────────────────────────

/**
 * Return the Amazigh alphabet as a structured list (upstream API).
 *
 * @param options.type   - Filter by 'vowel', 'consonant', or 'modifier'
 * @param options.region - 'morocco' excludes Algeria-only letters (default)
 */
export function alphabet(options?: { type?: 'vowel' | 'consonant' | 'modifier'; region?: Region }): CharEntry[] {
  let entries = [...MAPPING]
  const region = options?.region ?? 'morocco'

  if (region === 'morocco') {
    entries = entries.filter((e) => e.region !== 'algeria')
  }

  if (options?.type) {
    entries = entries.filter((e) => e.type === options.type)
  }

  // Exclude multi-codepoint labialized entries from flat list
  entries = entries.filter((e) => !e.tifinagh.includes('ⵯ') || e.type === 'modifier')

  return entries
}
