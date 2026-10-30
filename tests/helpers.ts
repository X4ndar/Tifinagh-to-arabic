import { CORRESPONDENCES, IRCAM_LETTERS, toArabic, type ProfileId } from '../src/index'

export const PROFILE_IDS: ProfileId[] = ['ircam', 'readable', 'phonetic']

/** Arabic code point ranges (letters, marks, punctuation). */
export const ARABIC_RE = /^[؀-ۿݐ-ݿࡰ-ࣿ]*$/u
export const TIFINAGH_RE = /[ⴰ-⵿]/u
export const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/
export const BIDI_CONTROLS_RE = /[‎‏؜‪-‮⁦-⁩]/

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
  return s.replace(/[ً-ٰٟ̀-ְͯ-ׇ]/gu, '')
}

export { toArabic }
