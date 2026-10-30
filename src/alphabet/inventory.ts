import type { SourceId } from './sources'

/**
 * Phonological class of a Tifinagh letter, as used by the rule engine.
 *  - vowel:     full vowels ⴰ ⵉ ⵓ
 *  - schwa:     neutral vowel ⴻ
 *  - semivowel: ⵡ ⵢ (IRCAM "semi-consonants")
 *  - consonant: everything else
 */
export type LetterClass = 'vowel' | 'schwa' | 'semivowel' | 'consonant'

export interface TifinaghLetter {
  /** The Tifinagh code point. */
  char: string
  /** "U+2D30" style code point label. */
  codePoint: string
  /** Unicode character name (without the "TIFINAGH LETTER " prefix). */
  unicodeName: string
  /** IRCAM English appellation (Table I). */
  ircamName: string
  /** IRCAM Latin correspondence (Table I). */
  latin: string
  cls: LetterClass
  /** Pharyngealized ("emphatic") consonant. */
  emphatic?: boolean
  /** Whether IRCAM standard orthography allows the labialization mark after it. */
  labializable?: boolean
  /** 'ircam' = IRCAM basic set; 'extended' = Neo-Tifinagh letter outside the Moroccan standard. */
  standard: 'ircam' | 'extended'
  sources: SourceId[]
}

const L = (
  cp: number,
  unicodeName: string,
  ircamName: string,
  latin: string,
  cls: LetterClass,
  extra: Partial<TifinaghLetter> = {},
): TifinaghLetter => ({
  char: String.fromCodePoint(cp),
  codePoint: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
  unicodeName,
  ircamName,
  latin,
  cls,
  standard: 'ircam',
  sources: ['IRCAM-T1', 'IRCAM-INVENTORY', 'UNICODE'],
  ...extra,
})

/**
 * The IRCAM basic Tifinagh set (31 letters; together with the two labialized
 * consonants ⴳⵯ ⴽⵯ this gives the 33 "letters" of the IRCAM alphabet).
 * Order follows Table I of the IRCAM paper.
 */
export const IRCAM_LETTERS: readonly TifinaghLetter[] = [
  L(0x2d30, 'YA', 'ya', 'a', 'vowel'),
  L(0x2d31, 'YAB', 'yab', 'b', 'consonant'),
  L(0x2d33, 'YAG', 'yag', 'g', 'consonant', { labializable: true }),
  L(0x2d37, 'YAD', 'yad', 'd', 'consonant'),
  L(0x2d39, 'YADD', 'yadd', 'ḍ', 'consonant', { emphatic: true }),
  L(0x2d3b, 'YEY', 'yey', 'e', 'schwa'),
  L(0x2d3c, 'YAF', 'yaf', 'f', 'consonant'),
  L(0x2d3d, 'YAK', 'yak', 'k', 'consonant', { labializable: true }),
  L(0x2d40, 'YAH', 'yah', 'h', 'consonant'),
  L(0x2d43, 'YAHH', 'yahh', 'ḥ', 'consonant'),
  L(0x2d44, 'YAA', 'yaa', 'ɛ', 'consonant'),
  L(0x2d45, 'YAKH', 'yakh', 'x', 'consonant'),
  L(0x2d47, 'YAQ', 'yaq', 'q', 'consonant'),
  L(0x2d49, 'YI', 'yi', 'i', 'vowel'),
  L(0x2d4a, 'YAZH', 'yazh', 'j', 'consonant'),
  L(0x2d4d, 'YAL', 'yal', 'l', 'consonant'),
  L(0x2d4e, 'YAM', 'yam', 'm', 'consonant'),
  L(0x2d4f, 'YAN', 'yan', 'n', 'consonant'),
  L(0x2d53, 'YU', 'you', 'u', 'vowel'),
  L(0x2d54, 'YAR', 'yar', 'r', 'consonant'),
  L(0x2d55, 'YARR', 'yarr', 'ṛ', 'consonant', { emphatic: true }),
  L(0x2d56, 'YAGH', 'yagh', 'ɣ', 'consonant'),
  L(0x2d59, 'YAS', 'yas', 's', 'consonant'),
  L(0x2d5a, 'YASS', 'yass', 'ṣ', 'consonant', { emphatic: true }),
  L(0x2d5b, 'YASH', 'yash', 'c', 'consonant'),
  L(0x2d5c, 'YAT', 'yat', 't', 'consonant'),
  L(0x2d5f, 'YATT', 'yatt', 'ṭ', 'consonant', { emphatic: true }),
  L(0x2d61, 'YAW', 'yaw', 'w', 'semivowel'),
  L(0x2d62, 'YAY', 'yay', 'y', 'semivowel'),
  L(0x2d63, 'YAZ', 'yaz', 'z', 'consonant'),
  L(0x2d65, 'YAZZ', 'yazz', 'ẓ', 'consonant', { emphatic: true }),
]

/**
 * Neo-Tifinagh letters outside the IRCAM basic set that appear in Algerian
 * (mainly Kabyle) usage and have an Arabic correspondence in Albane et al.
 * (2025), Figure 2. They are converted, but always with a NONSTANDARD_LETTER
 * warning, because they are not part of standard Moroccan orthography.
 */
export const EXTENDED_LETTERS: readonly TifinaghLetter[] = [
  L(0x2d32, 'YABH', '', 'ḇ', 'consonant', { standard: 'extended', sources: ['ALBANE-2025', 'UNICODE'] }),
  L(0x2d35, 'BERBER ACADEMY YAJ', '', 'ǧ', 'consonant', { standard: 'extended', sources: ['ALBANE-2025', 'UNICODE'] }),
  L(0x2d38, 'YADH', '', 'ḏ', 'consonant', { standard: 'extended', sources: ['ALBANE-2025', 'UNICODE'] }),
  L(0x2d52, 'YAP', '', 'p', 'consonant', { standard: 'extended', sources: ['ALBANE-2025', 'UNICODE'] }),
  L(0x2d5d, 'YATH', '', 'ṯ', 'consonant', { standard: 'extended', sources: ['ALBANE-2025', 'UNICODE'] }),
  L(0x2d5e, 'YACH', '', 'č', 'consonant', { standard: 'extended', sources: ['ALBANE-2025', 'UNICODE'] }),
]

/** U+2D6F TIFINAGH MODIFIER LETTER LABIALIZATION MARK (ⵯ, "tamatart"). */
export const LABIALIZATION_MARK = 'ⵯ'
/** U+2D7F TIFINAGH CONSONANT JOINER (formatting; requests a ligature). */
export const CONSONANT_JOINER = '⵿'
/** U+2D70 TIFINAGH SEPARATOR MARK (punctuation). */
export const SEPARATOR_MARK = '⵰'
/** U+02B7 MODIFIER LETTER SMALL W, sometimes typed instead of U+2D6F. */
export const LATIN_SMALL_W = 'ʷ'

/** IRCAM labialized consonants (standard). */
export const IRCAM_LABIALIZED: readonly string[] = ['ⴳⵯ', 'ⴽⵯ']

const ALL = [...IRCAM_LETTERS, ...EXTENDED_LETTERS]
export const LETTER_BY_CHAR: ReadonlyMap<string, TifinaghLetter> = new Map(ALL.map((l) => [l.char, l]))

/** True for any assigned or unassigned code point of the Tifinagh block. */
export function isTifinaghBlock(cp: number): boolean {
  return cp >= 0x2d30 && cp <= 0x2d7f
}

/** True for code points that can belong to a Tifinagh *word* (letters, ⵯ, joiner). */
export function isTifinaghWordChar(cp: number): boolean {
  return (cp >= 0x2d30 && cp <= 0x2d6f) || cp === 0x2d7f
}
