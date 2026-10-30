import type { ArabicOptions, ProfileId } from '../types/index'
import type { SourceId } from '../alphabet/sources'

export interface ProfileDefinition {
  id: ProfileId
  title: string
  description: string
  options: ArabicOptions
  /** Why each option has the value it has. */
  rationale: Partial<Record<keyof ArabicOptions, { sources: SourceId[]; note: string }>>
}

const COMMON = {
  k: 'kaf',
  h: 'heh',
  hiatus: 'plain',
  punctuation: 'preserve',
  protectUrls: true,
  protectCode: true,
  reportSchwaOmission: false,
} as const

/**
 * `ircam` — reference correspondence.
 * Letter-by-letter IRCAM Table I as amended by Table II, rendered with
 * standard Arabic-block code points. Gemination is spelled by repeating the
 * letter (Table I is a per-letter correspondence; no Tifinagh → Arabic shadda
 * rule is stated). Predictable, auditable, close to reversible.
 */
export const IRCAM_PROFILE: ProfileDefinition = {
  id: 'ircam',
  title: 'IRCAM reference correspondence',
  description:
    'IRCAM Table I amended by Table II (ڭ, damma for labialization, word-initial ئ ؤ ي). Semivowel and ṛ marks kept; geminates written as doubled letters; schwa not written.',
  options: {
    ...COMMON,
    g: 'ng',
    emphaticR: 'dot-below',
    emphaticZ: 'jeh',
    semivowelMark: 'arabic',
    plainInitialY: true,
    labialization: 'damma',
    gemination: 'double',
    schwa: 'omit',
    initialVowels: 'hamza-seat',
  },
  rationale: {
    g: { sources: ['IRCAM-T2'], note: 'ڭ replaces گ in Table II.' },
    emphaticR: { sources: ['IRCAM-T1', 'PROJECT'], note: 'Table I marks ṛ; ڔ is the Arabic-block substitute for its non-Arabic mark.' },
    emphaticZ: { sources: ['IRCAM-T1'], note: 'Table I: ژ.' },
    semivowelMark: { sources: ['IRCAM-T1', 'PROJECT'], note: 'Table I marks ⵡ ⵢ with "^"; rendered with U+065B.' },
    plainInitialY: { sources: ['IRCAM-T2'], note: 'Table II: plain ي word-initially.' },
    labialization: { sources: ['IRCAM-T2'], note: 'Table II: damma.' },
    gemination: { sources: ['IRCAM-T1'], note: 'Per-letter correspondence; no shadda rule for this direction.' },
    schwa: { sources: ['IRCAM-T1'], note: 'Arabic cell for ⴻ is empty.' },
    initialVowels: { sources: ['IRCAM-T2'], note: 'ئ / ؤ word-initially.' },
  },
}

/**
 * `readable` — default. Natural Arabic-script spelling of Moroccan Amazigh:
 * IRCAM letters, Table II initial vowels, shadda for gemination, no extra
 * marks on ⵡ ⵢ ⵕ. Matches every independently sourced Moroccan example
 * available (see docs/evaluation.md).
 */
export const READABLE_PROFILE: ProfileDefinition = {
  id: 'readable',
  title: 'Readable (default)',
  description:
    'IRCAM letters with Table II conventions; shadda for gemination; no diacritics on semivowels or ṛ; schwa not written.',
  options: {
    ...COMMON,
    g: 'ng',
    emphaticR: 'plain',
    emphaticZ: 'jeh',
    semivowelMark: 'none',
    plainInitialY: true,
    labialization: 'damma',
    gemination: 'shadda',
    schwa: 'omit',
    initialVowels: 'hamza-seat',
  },
  rationale: {
    gemination: {
      sources: ['WIKIDATA-SHI', 'IRCAM-RULES', 'ALBANE-2025'],
      note: 'ⵉⴼⴰⵙⵙⵏ → ئفاسّن (Wikidata); IRCAM treats shadda as the Arabic-script mark of gemination; Albane R2.',
    },
    semivowelMark: { sources: ['WIKIDATA-SHI'], note: 'ⴱⵔⴰⵢⵔ → براير: semivowels written plainly.' },
    initialVowels: { sources: ['IRCAM-T2', 'WIKIDATA-SHI'], note: 'ⵓⴽⵙⵓⵎ → ؤكسوم; ⵉⴼⴰⵙⵙⵏ → ئفاسّن.' },
    emphaticR: { sources: ['ALBANE-2025', 'PROJECT'], note: 'Plain ر keeps text free of rare letters; ṛ distinction is lost (documented).' },
  },
}

/**
 * `phonetic` — keeps as many contrasts as Arabic script allows: semivowel
 * marks, ṛ marked, shadda, and the schwa written as kasra.
 */
export const PHONETIC_PROFILE: ProfileDefinition = {
  id: 'phonetic',
  title: 'Phonetic',
  description: 'Like ircam, but shadda for gemination, schwa written as kasra, and the semivowel mark also word-initially.',
  options: {
    ...COMMON,
    g: 'ng',
    emphaticR: 'dot-below',
    emphaticZ: 'jeh',
    semivowelMark: 'arabic',
    plainInitialY: false,
    labialization: 'damma',
    gemination: 'shadda',
    schwa: 'kasra',
    initialVowels: 'hamza-seat',
  },
  rationale: {
    schwa: { sources: ['PROJECT'], note: 'Kasra as the closest short-vowel sign; proposed heuristic, needs validation.' },
  },
}

export const PROFILES: Readonly<Record<ProfileId, ProfileDefinition>> = {
  ircam: IRCAM_PROFILE,
  readable: READABLE_PROFILE,
  phonetic: PHONETIC_PROFILE,
}

export const DEFAULT_PROFILE: ProfileId = 'readable'

const ALLOWED: { [K in keyof ArabicOptions]: readonly ArabicOptions[K][] } = {
  g: ['ng', 'gaf', 'kaf', 'qaf3'],
  k: ['kaf', 'keheh'],
  emphaticR: ['plain', 'dot-below', 'ircam-literal'],
  emphaticZ: ['jeh', 'zah', 'zain'],
  semivowelMark: ['none', 'arabic', 'ircam-literal'],
  plainInitialY: [true, false],
  labialization: ['damma', 'ircam-table1', 'omit'],
  gemination: ['shadda', 'double', 'single'],
  schwa: ['omit', 'kasra', 'fatha'],
  initialVowels: ['hamza-seat', 'hamza-all', 'alef', 'hamza-alef'],
  hiatus: ['plain', 'hamza-seat'],
  h: ['heh', 'heh-doachashmee'],
  punctuation: ['preserve', 'arabic'],
  protectUrls: [true, false],
  protectCode: [true, false],
  reportSchwaOmission: [true, false],
}

/** Resolve a profile plus overrides into a complete, validated option set. */
export function resolveOptions(profile: ProfileId = DEFAULT_PROFILE, overrides: Partial<ArabicOptions> = {}): ArabicOptions {
  const def = PROFILES[profile]
  if (!def) {
    throw new Error(`Unknown profile '${String(profile)}'. Expected one of: ${Object.keys(PROFILES).join(', ')}.`)
  }
  const out: ArabicOptions = { ...def.options }
  for (const key of Object.keys(overrides) as (keyof ArabicOptions)[]) {
    const value = overrides[key]
    if (value === undefined) continue
    const allowed = ALLOWED[key] as readonly unknown[] | undefined
    if (!allowed) throw new Error(`Unknown Arabic option '${String(key)}'.`)
    if (!allowed.includes(value)) {
      throw new Error(`Invalid value ${JSON.stringify(value)} for option '${key}'. Allowed: ${allowed.map((v) => JSON.stringify(v)).join(', ')}.`)
    }
    ;(out as unknown as Record<string, unknown>)[key] = value
  }
  return out
}

export const OPTION_VALUES = ALLOWED
