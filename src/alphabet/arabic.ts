import type { ArabicOptions } from '../types/index'
import type { SourceId } from './sources'

/** Arabic code points used by the engine, named for auditability. */
export const AR = {
  ALEF: 'ا', // ا
  ALEF_HAMZA_ABOVE: 'أ', // أ
  ALEF_HAMZA_BELOW: 'إ', // إ
  BEH: 'ب', // ب
  TEH: 'ت', // ت
  THEH: 'ث', // ث
  JEEM: 'ج', // ج
  HAH: 'ح', // ح
  KHAH: 'خ', // خ
  DAL: 'د', // د
  THAL: 'ذ', // ذ
  REH: 'ر', // ر
  ZAIN: 'ز', // ز
  SEEN: 'س', // س
  SHEEN: 'ش', // ش
  SAD: 'ص', // ص
  DAD: 'ض', // ض
  TAH: 'ط', // ط
  ZAH: 'ظ', // ظ
  AIN: 'ع', // ع
  GHAIN: 'غ', // غ
  FEH: 'ف', // ف
  QAF: 'ق', // ق
  KAF: 'ك', // ك
  LAM: 'ل', // ل
  MEEM: 'م', // م
  NOON: 'ن', // ن
  HEH: 'ه', // ه
  WAW: 'و', // و
  YEH: 'ي', // ي
  WAW_HAMZA: 'ؤ', // ؤ
  YEH_HAMZA: 'ئ', // ئ
  PEH: 'پ', // پ
  TCHEH: 'چ', // چ
  REH_DOT_BELOW: 'ڔ', // ڔ
  JEH: 'ژ', // ژ
  QAF_THREE_DOTS: 'ڨ', // ڨ
  KEHEH: 'ک', // ک
  NG: 'ڭ', // ڭ
  GAF: 'گ', // گ
  HEH_DOACHASHMEE: 'ھ', // ھ
  // combining marks
  FATHA: '\u064E',
  DAMMA: '\u064F',
  KASRA: '\u0650',
  SHADDA: '\u0651',
  SUKUN: '\u0652',
  INVERTED_SMALL_V_ABOVE: '\u065B', // ◌\u065B  Arabic-block equivalent of IRCAM's "^" mark
  // non-Arabic marks found literally in the IRCAM PDF text layer
  LATIN_COMBINING_CIRCUMFLEX: '\u0302',
  HEBREW_SEGOL: '\u05B6',
  LEFT_SINGLE_QUOTE: '‘',
  // punctuation
  COMMA: '،',
  SEMICOLON: '؛',
  QUESTION: '؟',
} as const

export interface ArabicAlternative {
  arabic: string
  label: string
  sources: SourceId[]
}

/**
 * One row of the machine-readable Tifinagh → Arabic correspondence table.
 * `ircamTable1` is the cell as printed in IRCAM Table I (visually verified).
 * `ircamTable1TextLayer` records the code points actually present in the PDF
 * text layer when they differ from what is visible (font tricks), so that the
 * discrepancy is auditable.
 */
export interface Correspondence {
  tifinagh: string
  codePoints: string
  latin: string
  ircamTable1: string | null
  ircamTable1TextLayer?: string | null
  ircamTable2?: { arabic: string; context: 'everywhere' | 'word-initial' }
  /** What each built-in profile emits for the letter in a neutral (word-medial, single) context. */
  profiles: { ircam: string; readable: string; phonetic: string }
  alternatives: ArabicAlternative[]
  sources: SourceId[]
  notes?: string
}

const cp = (s: string): string =>
  [...s].map((c) => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' ')

const row = (
  tifinagh: string,
  latin: string,
  t1: string | null,
  profiles: [string, string, string],
  extra: Partial<Correspondence> = {},
): Correspondence => ({
  tifinagh,
  codePoints: cp(tifinagh),
  latin,
  ircamTable1: t1,
  profiles: { ircam: profiles[0], readable: profiles[1], phonetic: profiles[2] },
  alternatives: [],
  sources: ['IRCAM-T1'],
  ...extra,
})

const V = AR.INVERTED_SMALL_V_ABOVE

/**
 * Verified correspondence table for the 33 IRCAM units.
 * See docs/research.md §2 for the visual verification of each cell.
 */
export const CORRESPONDENCES: readonly Correspondence[] = [
  row('ⴰ', 'a', AR.ALEF, [AR.ALEF, AR.ALEF, AR.ALEF], {
    sources: ['IRCAM-T1', 'TAWALT'],
    alternatives: [
      { arabic: AR.ALEF_HAMZA_ABOVE, label: 'word-initial أ (Tawalt; readable default)', sources: ['TAWALT', 'ALBANE-2025'] },
      { arabic: AR.ALEF, label: 'word-initial bare ا (ircam/phonetic; specification examples, Wikidata)', sources: ['IRCAM-T1', 'WIKIDATA-SHI'] },
    ],
  }),
  row('ⴱ', 'b', AR.BEH, [AR.BEH, AR.BEH, AR.BEH]),
  row('ⴳ', 'g', AR.GAF, [AR.NG, AR.GAF, AR.NG], {
    ircamTable1TextLayer: null,
    ircamTable2: { arabic: AR.NG, context: 'everywhere' },
    sources: ['IRCAM-T1', 'IRCAM-T2', 'TAWALT'],
    alternatives: [
      { arabic: AR.GAF, label: 'gaf گ (IRCAM Table I; Tawalt; readable default)', sources: ['IRCAM-T1', 'TAWALT'] },
      { arabic: AR.NG, label: 'ڭ (IRCAM Table II; ircam/phonetic default)', sources: ['IRCAM-T2'] },
      { arabic: AR.KAF, label: 'kaf ك (official Arabic toponyms, e.g. أكادير)', sources: ['PROJECT'] },
      { arabic: AR.QAF_THREE_DOTS, label: 'ڨ (Algerian convention)', sources: ['ALBANE-2025'] },
    ],
    notes: 'Table II replaces Table I gaf by ڭ "to help the reader to correctly pronounce" ⴳ; Tawalt keeps گ (99 % of 4,172 occurrences), which readable follows.',
  }),
  row('ⴳⵯ', 'gʷ', AR.GAF + AR.LEFT_SINGLE_QUOTE, [AR.NG + AR.DAMMA, AR.GAF + AR.DAMMA, AR.NG + AR.DAMMA], {
    ircamTable1TextLayer: AR.LEFT_SINGLE_QUOTE,
    ircamTable2: { arabic: AR.NG + AR.DAMMA, context: 'everywhere' },
    sources: ['IRCAM-T1', 'IRCAM-T2'],
    alternatives: [{ arabic: AR.NG, label: 'labialization not written', sources: ['PROJECT'] }],
    notes: 'Table II uses damma instead of Table I’s quote mark "to ensure the Arabic writing cursivity".',
  }),
  row('ⴷ', 'd', AR.DAL, [AR.DAL, AR.DAL, AR.DAL]),
  row('ⴹ', 'ḍ', AR.DAD, [AR.DAD, AR.DAD, AR.DAD]),
  row('ⴻ', 'e', null, ['', '', AR.KASRA], {
    notes:
      'Table I leaves the Arabic cell empty: the neutral vowel has no Arabic letter. Omitted by ircam/readable; phonetic writes kasra on the preceding consonant (project heuristic).',
    alternatives: [{ arabic: AR.FATHA, label: 'fatha on preceding consonant', sources: ['PROJECT'] }],
  }),
  row('ⴼ', 'f', AR.FEH, [AR.FEH, AR.FEH, AR.FEH]),
  row('ⴽ', 'k', AR.KEHEH, [AR.KAF, AR.KAF, AR.KAF], {
    ircamTable1TextLayer: null,
    sources: ['IRCAM-T1', 'IRCAM-T2'],
    alternatives: [{ arabic: AR.KEHEH, label: 'keheh ک (glyph shape printed in Table I)', sources: ['IRCAM-T1'] }],
    notes: 'Table I prints a keheh-shaped glyph without text-layer code point; Table II uses ك (U+0643) for ⴽⵯ. ك is the standard Arabic kaf.',
  }),
  row('ⴽⵯ', 'kʷ', AR.KEHEH + AR.LEFT_SINGLE_QUOTE, [AR.KAF + AR.DAMMA, AR.KAF + AR.DAMMA, AR.KAF + AR.DAMMA], {
    ircamTable1TextLayer: AR.LEFT_SINGLE_QUOTE,
    ircamTable2: { arabic: AR.KAF + AR.DAMMA, context: 'everywhere' },
    sources: ['IRCAM-T1', 'IRCAM-T2'],
    alternatives: [{ arabic: AR.KAF, label: 'labialization not written', sources: ['PROJECT'] }],
  }),
  row('ⵀ', 'h', AR.HEH, [AR.HEH, AR.HEH, AR.HEH], {
    ircamTable1TextLayer: AR.HEH_DOACHASHMEE,
    notes: 'Visible glyph is heh; the text layer encodes U+06BE. U+0647 is used by default (option h: "heh-doachashmee" for the literal code point).',
  }),
  row('ⵃ', 'ḥ', AR.HAH, [AR.HAH, AR.HAH, AR.HAH]),
  row('ⵄ', 'ɛ', AR.AIN, [AR.AIN, AR.AIN, AR.AIN]),
  row('ⵅ', 'x', AR.KHAH, [AR.KHAH, AR.KHAH, AR.KHAH]),
  row('ⵇ', 'q', AR.QAF, [AR.QAF, AR.QAF, AR.QAF]),
  row('ⵉ', 'i', AR.YEH, [AR.YEH, AR.YEH, AR.YEH], {
    ircamTable2: { arabic: AR.YEH_HAMZA, context: 'word-initial' },
    sources: ['IRCAM-T1', 'IRCAM-T2', 'WIKIDATA-SHI'],
    alternatives: [
      { arabic: AR.ALEF + AR.YEH, label: 'word-initial اي', sources: ['PROJECT'] },
      { arabic: AR.ALEF_HAMZA_BELOW + AR.YEH, label: 'word-initial إي (Arabic-orthography convention)', sources: ['ALBANE-2025'] },
    ],
  }),
  row('ⵊ', 'j', AR.JEEM, [AR.JEEM, AR.JEEM, AR.JEEM]),
  row('ⵍ', 'l', AR.LAM, [AR.LAM, AR.LAM, AR.LAM]),
  row('ⵎ', 'm', AR.MEEM, [AR.MEEM, AR.MEEM, AR.MEEM]),
  row('ⵏ', 'n', AR.NOON, [AR.NOON, AR.NOON, AR.NOON]),
  row('ⵓ', 'u', AR.WAW, [AR.WAW, AR.WAW, AR.WAW], {
    ircamTable2: { arabic: AR.WAW_HAMZA, context: 'word-initial' },
    sources: ['IRCAM-T1', 'IRCAM-T2', 'WIKIDATA-SHI'],
    alternatives: [
      { arabic: AR.ALEF + AR.WAW, label: 'word-initial او', sources: ['PROJECT'] },
      { arabic: AR.ALEF_HAMZA_ABOVE + AR.WAW, label: 'word-initial أو (Arabic-orthography convention)', sources: ['ALBANE-2025'] },
    ],
  }),
  row('ⵔ', 'r', AR.REH, [AR.REH, AR.REH, AR.REH]),
  row('ⵕ', 'ṛ', AR.REH + AR.HEBREW_SEGOL, [AR.REH_DOT_BELOW, AR.REH, AR.REH_DOT_BELOW], {
    ircamTable1TextLayer: AR.HEBREW_SEGOL,
    alternatives: [{ arabic: AR.REH, label: 'plain reh (emphasis not written)', sources: ['ALBANE-2025'] }],
    notes:
      'Table I prints reh with a three-dots-below sign that the text layer encodes as Hebrew segol (U+05B6) on U+25CC. ' +
      'No Arabic code point is reh-with-three-dots-below; ircam/phonetic use ڔ U+0694 (reh with dot below) as the Arabic-block substitute (project decision).',
  }),
  row('ⵖ', 'ɣ', AR.GHAIN, [AR.GHAIN, AR.GHAIN, AR.GHAIN]),
  row('ⵙ', 's', AR.SEEN, [AR.SEEN, AR.SEEN, AR.SEEN]),
  row('ⵚ', 'ṣ', AR.SAD, [AR.SAD, AR.SAD, AR.SAD]),
  row('ⵛ', 'c', AR.SHEEN, [AR.SHEEN, AR.SHEEN, AR.SHEEN]),
  row('ⵜ', 't', AR.TEH, [AR.TEH, AR.TEH, AR.TEH], {
    notes: 'Always ت, including word-finally: ة (ta marbuta) would wrongly import Arabic morphology.',
  }),
  row('ⵟ', 'ṭ', AR.TAH, [AR.TAH, AR.TAH, AR.TAH]),
  row('ⵡ', 'w', AR.WAW + AR.LATIN_COMBINING_CIRCUMFLEX, [AR.WAW + V, AR.WAW, AR.WAW + V], {
    ircamTable1TextLayer: null,
    alternatives: [{ arabic: AR.WAW, label: 'plain waw', sources: ['WIKIDATA-SHI'] }],
    notes: 'Table I prints و with a "^" mark (no text-layer code point). ircam/phonetic render it with U+065B ARABIC VOWEL SIGN INVERTED SMALL V ABOVE.',
  }),
  row('ⵢ', 'y', AR.YEH + AR.LATIN_COMBINING_CIRCUMFLEX, [AR.YEH + V, AR.YEH, AR.YEH + V], {
    ircamTable1TextLayer: AR.LATIN_COMBINING_CIRCUMFLEX,
    ircamTable2: { arabic: AR.YEH, context: 'word-initial' },
    sources: ['IRCAM-T1', 'IRCAM-T2', 'WIKIDATA-SHI'],
    alternatives: [{ arabic: AR.YEH, label: 'plain yeh', sources: ['WIKIDATA-SHI'] }],
    notes: 'Table I: ي with "^" (text layer U+0302). Table II: plain ي word-initially.',
  }),
  row('ⵣ', 'z', AR.ZAIN, [AR.ZAIN, AR.ZAIN, AR.ZAIN]),
  row('ⵥ', 'ẓ', AR.JEH, [AR.JEH, AR.JEH, AR.JEH], {
    ircamTable1TextLayer: null,
    alternatives: [
      { arabic: AR.ZAIN, label: 'zain ز (official Arabic toponyms, e.g. تازناخت)', sources: ['PROJECT'] },
      { arabic: AR.ZAH, label: 'zah ظ (common informal usage)', sources: ['PROJECT'] },
    ],
    notes: 'Table I prints ژ (zain with three dots above, U+0698); no text-layer code point.',
  }),
]

/** Arabic correspondences for the extended (non-IRCAM) letters, from Albane et al. (2025) Fig. 2. */
export const EXTENDED_CORRESPONDENCES: Readonly<Record<string, string>> = {
  'ⴲ': AR.BEH, // ⴲ ḇ
  'ⴵ': AR.JEEM, // ⴵ ǧ
  'ⴸ': AR.THAL, // ⴸ ḏ
  'ⵒ': AR.PEH, // ⵒ p
  'ⵝ': AR.THEH, // ⵝ ṯ
  'ⵞ': AR.TEH + AR.SHEEN, // ⵞ č  (Fig. 2 gives "تش" in parentheses)
}

/**
 * Base Arabic letter for a Tifinagh consonant/semivowel/vowel in neutral
 * context, according to the options. Returns `null` for schwa (handled by
 * a dedicated rule) and for characters without a correspondence.
 */
export function baseArabic(ch: string, o: ArabicOptions): { text: string; rule: string } | null {
  switch (ch) {
    case 'ⴳ': // ⴳ
      return {
        text: o.g === 'ng' ? AR.NG : o.g === 'gaf' ? AR.GAF : o.g === 'kaf' ? AR.KAF : AR.QAF_THREE_DOTS,
        rule: `base.g.${o.g}`,
      }
    case 'ⴽ': // ⴽ
      return { text: o.k === 'keheh' ? AR.KEHEH : AR.KAF, rule: `base.k.${o.k}` }
    case 'ⵀ': // ⵀ
      return { text: o.h === 'heh-doachashmee' ? AR.HEH_DOACHASHMEE : AR.HEH, rule: `base.h.${o.h}` }
    case 'ⵕ': // ⵕ
      return {
        text: o.emphaticR === 'plain' ? AR.REH : o.emphaticR === 'dot-below' ? AR.REH_DOT_BELOW : AR.REH + AR.HEBREW_SEGOL,
        rule: `base.r-emphatic.${o.emphaticR}`,
      }
    case 'ⵥ': // ⵥ
      return {
        text: o.emphaticZ === 'jeh' ? AR.JEH : o.emphaticZ === 'zah' ? AR.ZAH : AR.ZAIN,
        rule: `base.z-emphatic.${o.emphaticZ}`,
      }
    case 'ⵡ': // ⵡ
      return { text: AR.WAW + semivowelMark(o), rule: `base.w.mark-${o.semivowelMark}` }
    case 'ⵢ': // ⵢ
      return { text: AR.YEH + semivowelMark(o), rule: `base.y.mark-${o.semivowelMark}` }
    case 'ⴻ': // ⴻ
      return null
  }
  const simple = SIMPLE.get(ch)
  if (simple !== undefined) return { text: simple, rule: 'base.table1' }
  const ext = EXTENDED_CORRESPONDENCES[ch]
  if (ext !== undefined) return { text: ext, rule: 'base.extended.albane2025' }
  return null
}

export function semivowelMark(o: ArabicOptions): string {
  return o.semivowelMark === 'arabic' ? V : o.semivowelMark === 'ircam-literal' ? AR.LATIN_COMBINING_CIRCUMFLEX : ''
}

/** One-to-one Table I correspondences that no option changes. */
const SIMPLE: ReadonlyMap<string, string> = new Map(
  CORRESPONDENCES.filter((c) => [...c.tifinagh].length === 1 && c.ircamTable1 !== null && c.profiles.ircam === c.ircamTable1 && c.profiles.readable === c.ircamTable1).map(
    (c) => [c.tifinagh, c.ircamTable1 as string],
  ),
)
