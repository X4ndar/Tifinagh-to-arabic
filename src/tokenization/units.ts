import {
  LABIALIZATION_MARK,
  LATIN_SMALL_W,
  LETTER_BY_CHAR,
  type LetterClass,
  type TifinaghLetter,
} from '../alphabet/inventory'
import { diag, hex } from '../diagnostics/diagnostics'
import { isCombiningMark, isFormatChar } from '../normalization/normalize'
import type { ConversionWarning } from '../types/index'

/**
 * A linguistic unit of a Tifinagh word: a letter (possibly labialized and/or
 * geminated), an unsupported Tifinagh code point, or an orphan modifier.
 */
export interface Unit {
  kind: 'letter' | 'unknown' | 'orphan'
  letter?: TifinaghLetter
  cls?: LetterClass
  labialized: boolean
  /** Number of identical letters merged into this unit (2 = geminate). */
  length: number
  /** Normalized Tifinagh source of the unit (format characters removed). */
  source: string
  /** UTF-16 offsets in the original input. */
  start: number
  end: number
  /** Combining marks found after the letter, preserved verbatim. */
  extraMarks: string
}

export interface TokenizedWord {
  units: Unit[]
  /** Normalized word (format chars removed, ʷ → ⵯ); used as lexicon key. */
  normalized: string
  warnings: ConversionWarning[]
}

const isConsonantal = (u: Unit | undefined): boolean =>
  !!u && u.kind === 'letter' && (u.cls === 'consonant' || u.cls === 'semivowel')

/**
 * Tokenize one Tifinagh word (as produced by `segment`) into units.
 * Longest match: a consonant followed by ⵯ (U+2D6F) is one unit.
 * Linear time; never drops a code point without a diagnostic.
 */
export function tokenizeWord(word: string, offset: number): TokenizedWord {
  const units: Unit[] = []
  const warnings: ConversionWarning[] = []
  let normalized = ''
  let i = 0
  while (i < word.length) {
    const code = word.charCodeAt(i)
    const ch = code >= 0xd800 && code <= 0xdbff ? String.fromCodePoint(word.codePointAt(i)!) : word[i]
    const pos = offset + i
    const next = i + ch.length

    // fast path: an ordinary IRCAM letter (by far the most frequent case)
    const fast = LETTER_BY_CHAR.get(ch)
    if (fast !== undefined && fast.standard === 'ircam') {
      units.push({ kind: 'letter', letter: fast, cls: fast.cls, labialized: false, length: 1, source: ch, start: pos, end: offset + next, extraMarks: '' })
      normalized += ch
      i = next
      continue
    }
    const prev = units[units.length - 1]

    if (isFormatChar(ch)) {
      warnings.push(diag('FORMAT_CHAR_REMOVED', `Formatting character ${hex(ch)} inside a Tifinagh word was removed before conversion.`, pos, ch))
      i = next
      continue
    }

    if (ch === LABIALIZATION_MARK || (ch === LATIN_SMALL_W && isConsonantal(prev) && !prev!.labialized)) {
      if (ch === LATIN_SMALL_W) {
        warnings.push(diag('MODIFIER_NORMALIZED', `U+02B7 after a Tifinagh consonant was read as the labialization mark ⵯ (U+2D6F).`, pos, ch))
      }
      if (isConsonantal(prev) && !prev!.labialized && prev!.extraMarks === '') {
        prev!.labialized = true
        prev!.source += LABIALIZATION_MARK
        prev!.end = offset + next
        normalized += LABIALIZATION_MARK
        if (!prev!.letter!.labializable) {
          warnings.push(
            diag(
              'NONSTANDARD_LABIALIZATION',
              `Labialization of '${prev!.letter!.char}' (${prev!.letter!.latin}ʷ) is not part of the IRCAM standard (only ⴳⵯ and ⴽⵯ); converted anyway.`,
              prev!.start,
              word.slice(prev!.start - offset, prev!.end - offset),
            ),
          )
        }
      } else {
        units.push({ kind: 'orphan', labialized: false, length: 1, source: ch, start: pos, end: offset + next, extraMarks: '' })
        normalized += ch
        warnings.push(
          diag('ORPHAN_LABIALIZATION', `Labialization mark ${hex(ch)} is not attached to a consonant; it was kept unchanged.`, pos, ch),
        )
      }
      i = next
      continue
    }

    if (isCombiningMark(ch)) {
      if (prev) {
        prev.extraMarks += ch
        prev.end = offset + next
      } else {
        units.push({ kind: 'unknown', labialized: false, length: 1, source: ch, start: pos, end: offset + next, extraMarks: '' })
      }
      normalized += ch
      warnings.push(
        diag('COMBINING_MARK_ON_TIFINAGH', `Combining mark ${hex(ch)} on a Tifinagh letter has no defined Arabic equivalent; it was kept unchanged.`, pos, ch),
      )
      i = next
      continue
    }

    const letter = LETTER_BY_CHAR.get(ch)
    if (letter) {
      units.push({ kind: 'letter', letter, cls: letter.cls, labialized: false, length: 1, source: ch, start: pos, end: offset + next, extraMarks: '' })
      if (letter.standard === 'extended') {
        warnings.push(
          diag(
            'NONSTANDARD_LETTER',
            `'${ch}' (${hex(ch)} ${letter.unicodeName}, ${letter.latin}) is not in the IRCAM Moroccan standard; converted with the Albane et al. (2025) correspondence.`,
            pos,
            ch,
          ),
        )
      }
    } else {
      units.push({ kind: 'unknown', labialized: false, length: 1, source: ch, start: pos, end: offset + next, extraMarks: '' })
      warnings.push(
        diag('UNSUPPORTED_TIFINAGH', `Tifinagh character '${ch}' (${hex(ch)}) has no Arabic correspondence; it was kept unchanged.`, pos, ch),
      )
    }
    normalized += ch
    i = next
  }
  return { units: groupGeminates(units, warnings, word, offset), normalized, warnings }
}

/**
 * Merge runs of identical consonants into geminate units.
 * ⴳ + ⴳⵯ (IRCAM spelling of a labialized geminate) merges into one labialized unit.
 * Vowels are never merged (a repeated vowel is hiatus, not gemination).
 */
export function groupGeminates(units: Unit[], warnings: ConversionWarning[], word: string, offset: number): Unit[] {
  const out: Unit[] = []
  for (const u of units) {
    const prev = out[out.length - 1]
    if (
      prev &&
      isConsonantal(prev) &&
      isConsonantal(u) &&
      prev.letter!.char === u.letter!.char &&
      !prev.labialized &&
      prev.extraMarks === ''
    ) {
      prev.length += 1
      prev.labialized = u.labialized
      prev.source += u.source
      prev.end = u.end
      prev.extraMarks = u.extraMarks
      if (prev.length === 3) {
        warnings.push(
          diag('LONG_CONSONANT_RUN', `Three or more identical consonants in a row ('${prev.source}') — treated as one geminate.`, prev.start, prev.source),
        )
      }
      continue
    }
    out.push(u)
  }
  // report LONG_CONSONANT_RUN on the exact original input span (after all merging)
  for (const w of warnings) {
    if (w.code === 'LONG_CONSONANT_RUN') {
      const u = out.find((x) => x.start === w.position)
      if (u) {
        w.source = word.slice(u.start - offset, u.end - offset)
        w.length = u.end - u.start
      }
    }
  }
  return out
}
