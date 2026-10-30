import { CORRESPONDENCES, IRCAM_LETTERS, toArabic, type ProfileId } from '../src/index'

export const PROFILE_IDS: ProfileId[] = ['ircam', 'readable', 'phonetic']

/** Arabic code point ranges (letters, marks, punctuation). */
export const ARABIC_RE = /^[\u0600-ۿݐ-ݿࡰ-\u08FF]*$/u
export const TIFINAGH_RE = /[ⴰ-⵿]/u
export const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
export const BIDI_CONTROLS_RE = /[\u200E\u200F\u061C\u202A-\u202E\u2066-\u2069]/

export const IRCAM_CHARS = IRCAM_LETTERS.map((l) => l.char)
export const NON_SCHWA_CHARS = IRCAM_LETTERS.filter((l) => l.cls !== 'schwa').map((l) => l.char)

/** Profile column of the correspondence table for a single Tifinagh unit. */
export function column(tifinagh: string, profile: ProfileId): string {
  const row = CORRESPONDENCES.find((c) => c.tifinagh === tifinagh)
  if (!row) throw new Error('no row for ' + tifinagh)
  return row.profiles[profile]
}

/** Arabic letters only (combining marks removed). */
export function lettersOnly(s: string): string {
  return s.replace(/[\u064B-\u065F\u0670\u0300-\u036F\u05B0-\u05C7]/gu, '')
}

export { toArabic }
