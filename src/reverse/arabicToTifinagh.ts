/**
 * Arabic-script Amazigh → Tifinagh (IRCAM orthography).
 *
 * Arabic script does not show everything Tifinagh writes: ي/و are vowels or
 * semivowels, ر is plain or emphatic, and the neutral vowel ⴻ is normally not
 * written. This module recovers them with the rules IRCAM documents for this
 * direction (Ataa Allah et al. 2013, §III.B.2), checked against the Tawalt
 * dictionary, and with explicit marks when the text carries them (as the
 * `ircam` and `phonetic` spellings of this library do).
 *
 * The input convention is chosen with a profile, mirroring the forward profiles:
 *  - readable  everyday spelling: ي/و decided by context, ر by the emphatic-word rule
 *  - ircam     marks decide (وٛ يٛ = semivowels, ڔ = ṛ); unmarked letters are vowels / plain
 *  - phonetic  like ircam, and kasra (or fatha) is read as the neutral vowel ⴻ (ⴻ only where it is written)
 */
import type { SourceId } from '../alphabet/sources'
import { diag, TransliterationError } from '../diagnostics/diagnostics'
import { isCombiningMark, isFormatChar } from '../normalization/normalize'
import { segment, type SegmentState } from '../tokenization/segment'
import { arabicLexiconKey } from '../lexicon/lexicon'
import type { ConversionWarning, LexiconLike, ProfileId, ReverseOptionsShape, TraceEntry } from '../types/index'

// ── Options and profiles ─────────────────────────────────────────────────────

export interface ReverseOptions extends ReverseOptionsShape {
  /** How ي/و are read: from context (IRCAM rules) or only from explicit marks. */
  semivowels: 'context' | 'marked'
  /** How ر is read: emphatic ⵕ in words with ض ص ط ظ ژ (IRCAM rule), or exactly as written (ڔ = ⵕ). */
  emphaticR: 'word-rule' | 'as-written'
  /** Read kasra/fatha as the neutral vowel ⴻ, or ignore them. */
  schwa: 'vowel-sign' | 'ignore'
  /**
   * Two identical letters without shadda: the neutral vowel between them (CⴻC; everyday spelling
   * marks a geminate with shadda — Tawalt 605/606), or a geminate (IRCAM spelling writes CC twice).
   */
  doubledLetters: 'schwa' | 'geminate'
  /** Read damma on a consonant as labialization ⵯ (IRCAM Table II), or ignore it. */
  labialization: 'damma' | 'ignore'
  /** Write ، ؛ ؟ as , ; ? (IRCAM recommends international punctuation for Tifinagh). */
  punctuation: 'latin' | 'preserve'
  /** Write Arabic-Indic digits as 0–9 (the digits IRCAM recommends with Tifinagh). */
  digits: 'western' | 'preserve'
  protectUrls: boolean
  protectCode: boolean
}

export const REVERSE_PROFILES: Readonly<Record<ProfileId, ReverseOptions>> = {
  readable: {
    semivowels: 'context',
    emphaticR: 'word-rule',
    schwa: 'ignore',
    doubledLetters: 'schwa',
    labialization: 'damma',
    punctuation: 'latin',
    digits: 'western',
    protectUrls: true,
    protectCode: true,
  },
  ircam: {
    semivowels: 'marked',
    emphaticR: 'as-written',
    schwa: 'ignore',
    doubledLetters: 'geminate',
    labialization: 'damma',
    punctuation: 'latin',
    digits: 'western',
    protectUrls: true,
    protectCode: true,
  },
  phonetic: {
    semivowels: 'marked',
    emphaticR: 'as-written',
    schwa: 'vowel-sign',
    doubledLetters: 'geminate',
    labialization: 'damma',
    punctuation: 'latin',
    digits: 'western',
    protectUrls: true,
    protectCode: true,
  },
}

const REVERSE_ALLOWED: { [K in keyof ReverseOptions]: readonly ReverseOptions[K][] } = {
  semivowels: ['context', 'marked'],
  emphaticR: ['word-rule', 'as-written'],
  schwa: ['vowel-sign', 'ignore'],
  doubledLetters: ['schwa', 'geminate'],
  labialization: ['damma', 'ignore'],
  punctuation: ['latin', 'preserve'],
  digits: ['western', 'preserve'],
  protectUrls: [true, false],
  protectCode: [true, false],
}
export const REVERSE_OPTION_VALUES = REVERSE_ALLOWED

export function resolveReverseOptions(profile: ProfileId = 'readable', overrides: Partial<ReverseOptions> = {}): ReverseOptions {
  const base = REVERSE_PROFILES[profile]
  if (!base) throw new Error(`Unknown profile '${String(profile)}'. Expected one of: ${Object.keys(REVERSE_PROFILES).join(', ')}.`)
  const out: ReverseOptions = { ...base }
  for (const key of Object.keys(overrides) as (keyof ReverseOptions)[]) {
    const value = overrides[key]
    if (value === undefined) continue
    const allowed = REVERSE_ALLOWED[key] as readonly unknown[] | undefined
    if (!allowed) throw new Error(`Unknown Arabic → Tifinagh option '${String(key)}'.`)
    if (!allowed.includes(value)) throw new Error(`Invalid value ${JSON.stringify(value)} for option '${key}'. Allowed: ${allowed.map((v) => JSON.stringify(v)).join(', ')}.`)
    ;(out as unknown as Record<string, unknown>)[key] = value
  }
  return out
}

// ── Rules (metadata; examples are executed by the tests) ─────────────────────

export interface ReverseRule {
  id: string
  description: string
  sources: SourceId[]
  status: 'documented' | 'derived' | 'heuristic'
  examples: ReadonlyArray<{ profile: ProfileId; input: string; output: string }>
}

export const REVERSE_RULES: readonly ReverseRule[] = [
  {
    id: 'rev.letter',
    description: 'A consonant letter is written with its IRCAM Tifinagh letter (inverse of Table I/II).',
    sources: ['IRCAM-T1', 'IRCAM-T2'],
    status: 'documented',
    examples: [{ profile: 'readable', input: 'تامازيغت', output: 'ⵜⴰⵎⴰⵣⵉⵖⵜ' }],
  },
  {
    id: 'rev.alef',
    description: 'ا أ آ ٱ (and ى, as in Tawalt) are the vowel ⴰ.',
    sources: ['IRCAM-T1', 'TAWALT'],
    status: 'documented',
    examples: [
      { profile: 'readable', input: 'أزول', output: 'ⴰⵣⵓⵍ' },
      { profile: 'readable', input: 'ازول', output: 'ⴰⵣⵓⵍ' },
    ],
  },
  {
    id: 'rev.initial-hamza-seat',
    description:
      'ئ is ⵉ and ؤ is ⵓ (Table II word-initial forms; also accepted in hiatus). With semivowels=context, ئي / إي / ؤو at the start of a word are one vowel (Tawalt spelling), unless ا follows.',
    sources: ['IRCAM-T2', 'WIKIDATA-SHI', 'TAWALT'],
    status: 'documented',
    examples: [
      { profile: 'readable', input: 'ئفاسّن', output: 'ⵉⴼⴰⵙⵙⵏ' },
      { profile: 'readable', input: 'ؤكسوم', output: 'ⵓⴽⵙⵓⵎ' },
      { profile: 'readable', input: 'إيمي', output: 'ⵉⵎⵉ' },
      { profile: 'readable', input: 'ؤواتن', output: 'ⵓⵡⴰⵜⵏ' },
    ],
  },
  {
    id: 'rev.yeh.context',
    description:
      'Unmarked ي is the semivowel ⵢ at the start of a word (Table II), after a vowel (IRCAM rule) or before ا (Tawalt: 95 % of 370 cases); otherwise the vowel ⵉ.',
    sources: ['IRCAM-RULES', 'IRCAM-T2', 'TAWALT'],
    status: 'documented',
    examples: [
      { profile: 'readable', input: 'براير', output: 'ⴱⵔⴰⵢⵔ' },
      { profile: 'readable', input: 'يان', output: 'ⵢⴰⵏ' },
      { profile: 'readable', input: 'تيفيناغ', output: 'ⵜⵉⴼⵉⵏⴰⵖ' },
    ],
  },
  {
    id: 'rev.waw.context',
    description:
      'Unmarked و is the semivowel ⵡ at the start of a word, before ا (Tawalt: 100 % of 505), or after a vowel ا / و / vowel ي (IRCAM rule: after ا; Tawalt for the others) — except after ئ, where ئو is the hiatus ⵉⵓ; otherwise (between consonants, at the end) it is the vowel ⵓ.',
    sources: ['IRCAM-RULES', 'TAWALT'],
    status: 'documented',
    examples: [
      { profile: 'readable', input: 'أوال', output: 'ⴰⵡⴰⵍ' },
      { profile: 'readable', input: 'أزوال', output: 'ⴰⵣⵡⴰⵍ' },
      { profile: 'readable', input: 'أفوس', output: 'ⴰⴼⵓⵙ' },
      { profile: 'readable', input: 'ئسّيون', output: 'ⵉⵙⵙⵉⵡⵏ' },
      { profile: 'readable', input: 'ئودان', output: 'ⵉⵓⴷⴰⵏ' },
    ],
  },
  {
    id: 'rev.semivowel.marked',
    description:
      'و or ي carrying the semivowel mark (U+065B, or the Latin circumflex of IRCAM Table I) or a sukun (Tawalt: every one of 1,466 words) is ⵡ / ⵢ; a geminate (shadda) و/ي is always a semivowel.',
    sources: ['IRCAM-T1', 'TAWALT', 'PROJECT'],
    status: 'derived',
    examples: [
      { profile: 'ircam', input: 'اوٛال', output: 'ⴰⵡⴰⵍ' },
      { profile: 'readable', input: 'أسيْلّال', output: 'ⴰⵙⵢⵍⵍⴰⵍ' },
      { profile: 'readable', input: 'أيّور', output: 'ⴰⵢⵢⵓⵔ' },
    ],
  },
  {
    id: 'rev.vowel.marked-mode',
    description: 'With semivowels=marked (ircam, phonetic), an unmarked medial ي / و is the vowel ⵉ / ⵓ; a word-initial plain ي is ⵢ (Table II).',
    sources: ['IRCAM-T2', 'PROJECT'],
    status: 'derived',
    examples: [{ profile: 'ircam', input: 'تائري', output: 'ⵜⴰⵉⵔⵉ' }],
  },
  {
    id: 'rev.r.emphatic-word',
    description: 'In a word that contains an emphatic letter (ض ص ط ظ ژ), ر is ⵕ (IRCAM rule, Arabic → Tifinagh).',
    sources: ['IRCAM-RULES'],
    status: 'documented',
    examples: [{ profile: 'readable', input: 'أژيضر', output: 'ⴰⵥⵉⴹⵕ' }],
  },
  {
    id: 'rev.r.plain-word',
    description: 'In a word with no emphatic letter, ر is the plain ⵔ.',
    sources: ['IRCAM-RULES'],
    status: 'documented',
    examples: [{ profile: 'readable', input: 'براير', output: 'ⴱⵔⴰⵢⵔ' }],
  },
  {
    id: 'rev.r.as-written',
    description: 'ڔ (or ر with the three-dots sign of Table I) is ⵕ; plain ر is ⵔ.',
    sources: ['IRCAM-T1', 'PROJECT'],
    status: 'derived',
    examples: [{ profile: 'ircam', input: 'ضار', output: 'ⴹⴰⵔ' }],
  },
  {
    id: 'rev.shadda',
    description: 'A letter with shadda is written twice (IRCAM rule).',
    sources: ['IRCAM-RULES'],
    status: 'documented',
    examples: [{ profile: 'readable', input: 'ئفاسّن', output: 'ⵉⴼⴰⵙⵙⵏ' }],
  },
  {
    id: 'rev.damma.labialization',
    description: 'Damma on ڭ/گ/ك is labialization: ⴳⵯ / ⴽⵯ (Table II). Damma elsewhere is ignored (reported).',
    sources: ['IRCAM-T2'],
    status: 'documented',
    examples: [{ profile: 'readable', input: 'أگُّا', output: 'ⴰⴳⴳⵯⴰ' }],
  },
  {
    id: 'rev.schwa.between-identical',
    description:
      'With doubledLetters=schwa (readable), two adjacent copies of the same consonant letter have the neutral vowel ⴻ between them, because a geminate is one letter with shadda: دد is ⴷⴻⴷ (Tawalt: 605 of 606 cases), لّل is ⵍⵍⴻⵍ. Not applied to ي / و.',
    sources: ['TAWALT', 'PROJECT'],
    status: 'derived',
    examples: [
      { profile: 'readable', input: 'أمودد', output: 'ⴰⵎⵓⴷⴻⴷ' },
      { profile: 'readable', input: 'ئللّو', output: 'ⵉⵍⴻⵍⵍⵓ' },
      { profile: 'ircam', input: 'ئللو', output: 'ⵉⵍⵍⵓ' },
    ],
  },
  {
    id: 'rev.schwa',
    description: 'With schwa=vowel-sign (phonetic), kasra or fatha after a consonant is the neutral vowel ⴻ; on an alef carrier it is ⴻ alone.',
    sources: ['PROJECT'],
    status: 'heuristic',
    examples: [{ profile: 'phonetic', input: 'تامِزڭيدا', output: 'ⵜⴰⵎⴻⵣⴳⵉⴷⴰ' }],
  },
  {
    id: 'rev.nonstandard',
    description: 'Letters outside the Amazigh correspondence (ث ذ پ چ ڤ ة) are approximated (ⵜ ⴷ ⴱ ⵛ ⴼ ⴰ) and reported; ء is dropped and reported. ظ is read as ⵥ (an accepted spelling of ⵥ).',
    sources: ['PROJECT'],
    status: 'heuristic',
    examples: [],
  },
]

// ── Letter tables ────────────────────────────────────────────────────────────

/** Consonants (and letters read as consonants) → Tifinagh. */
const CONSONANT: Readonly<Record<string, string>> = {
  'ب': 'ⴱ', 'ت': 'ⵜ', 'ج': 'ⵊ', 'ح': 'ⵃ', 'خ': 'ⵅ', 'د': 'ⴷ', 'ر': 'ⵔ', 'ڔ': 'ⵕ', 'ز': 'ⵣ', 'ژ': 'ⵥ', 'س': 'ⵙ', 'ش': 'ⵛ',
  'ص': 'ⵚ', 'ض': 'ⴹ', 'ط': 'ⵟ', 'ع': 'ⵄ', 'غ': 'ⵖ', 'ف': 'ⴼ', 'ق': 'ⵇ', 'ك': 'ⴽ', 'ک': 'ⴽ', 'گ': 'ⴳ', 'ڭ': 'ⴳ', 'ڨ': 'ⴳ',
  'ل': 'ⵍ', 'م': 'ⵎ', 'ن': 'ⵏ', 'ه': 'ⵀ', 'ھ': 'ⵀ', 'ظ': 'ⵥ',
}
/** Letters outside the Amazigh correspondence: approximated, with a warning. */
const APPROXIMATE: Readonly<Record<string, string>> = { 'ث': 'ⵜ', 'ذ': 'ⴷ', 'پ': 'ⴱ', 'چ': 'ⵛ', 'ڤ': 'ⴼ', 'ة': 'ⴰ' }
const ALEFS = new Set(['ا', 'أ', 'آ', 'ٱ', 'ى'])
const EMPHATIC_LETTERS = new Set(['ض', 'ص', 'ط', 'ظ', 'ژ'])
const VELARS = new Set(['ⴳ', 'ⴽ'])
const TIF_VOWELS = new Set(['ⴰ', 'ⵉ', 'ⵓ', 'ⴻ'])

const SHADDA = '\u0651'
const DAMMA = '\u064F'
const KASRA = '\u0650'
const FATHA = '\u064E'
const SUKUN = '\u0652'
/** Marks that make و/ي a semivowel: U+065B (this library), U+0302 (IRCAM Table I), sukun (Tawalt: 1,466/1,466 words). */
const SEMIVOWEL_MARKS = new Set(['\u065B', '\u0302', SUKUN])
const SEGOL = '\u05B6' // three dots below ر in IRCAM Table I's text layer
/** Signs with no Tifinagh counterpart: sukun, tanwin, superscript alef, small high marks. */
const IGNORED_MARKS = /^[\u064B-\u064D\u0652\u0653\u0656-\u065A\u065C-\u065F\u0670\u06D6-\u06ED]$/

const PUNCT: Readonly<Record<string, string>> = { '،': ',', '؛': ';', '؟': '?', '٪': '%', '٫': ',', '٬': ',' }

/** Code points that can belong to an Arabic-script word. */
export function isArabicWordChar(cp: number): boolean {
  return (
    (cp >= 0x0621 && cp <= 0x064a) ||
    (cp >= 0x066e && cp <= 0x06d3) ||
    cp === 0x06d5 ||
    cp === 0x0640 ||
    (cp >= 0x06ee && cp <= 0x06ef) ||
    (cp >= 0x06fa && cp <= 0x06fc) ||
    cp === 0x06ff ||
    (cp >= 0x0750 && cp <= 0x077f) ||
    (cp >= 0x08a0 && cp <= 0x08c9) ||
    (cp >= 0xfb50 && cp <= 0xfdfb) ||
    (cp >= 0xfe70 && cp <= 0xfefc)
  )
}
const isPresentationForm = (cp: number): boolean => (cp >= 0xfb50 && cp <= 0xfdff) || (cp >= 0xfe70 && cp <= 0xfeff)

// ── Units ────────────────────────────────────────────────────────────────────

interface ArUnit {
  base: string
  marks: string[]
  start: number
  end: number
  source: string
}

function hasMark(u: ArUnit, m: string): boolean {
  return u.marks.includes(m)
}

/** Split an Arabic word into letters with their marks (presentation forms and decomposed hamza normalized). */
function units(word: string, offset: number, warnings: ConversionWarning[]): ArUnit[] {
  const out: ArUnit[] = []
  let i = 0
  while (i < word.length) {
    const cp = word.codePointAt(i)!
    const ch = String.fromCodePoint(cp)
    const pos = offset + i
    const next = i + ch.length
    if (cp === 0x0640 || isFormatChar(ch)) {
      // tatweel (kashida) and invisible formatting carry no sound
      if (cp !== 0x0640) warnings.push(diag('FORMAT_CHAR_REMOVED', `Formatting character inside an Arabic word was removed.`, pos, ch))
      i = next
      continue
    }
    if (isCombiningMark(ch)) {
      const prev = out[out.length - 1]
      if (prev) {
        prev.marks.push(ch)
        prev.end = offset + next
        prev.source = word.slice(prev.start - offset, next)
      }
      i = next
      continue
    }
    const letters = isPresentationForm(cp) ? ch.normalize('NFKC') : ch
    const chars = [...letters]
    chars.forEach((c, k) => {
      if (isCombiningMark(c)) {
        out[out.length - 1]?.marks.push(c)
        return
      }
      out.push({ base: c, marks: [], start: pos, end: k === chars.length - 1 ? offset + next : pos, source: ch })
    })
    i = next
  }
  // decomposed hamza / madda (ا + U+0654 …) → precomposed letters
  for (const u of out) {
    const combined = (u.base + u.marks.join('')).normalize('NFC')
    const [b, ...rest] = [...combined]
    u.base = b
    u.marks = rest
  }
  return out
}

// ── Converter ────────────────────────────────────────────────────────────────

export interface ReverseConverterConfig {
  profile?: ProfileId
  options?: Partial<ReverseOptions>
  strict?: boolean
  trace?: boolean
  /** Lexicon of validated spellings, used in reverse (Arabic word → Tifinagh word). */
  lexicon?: LexiconLike | null
}

export interface ReverseResult {
  output: string
  profile: ProfileId
  warnings: ConversionWarning[]
  trace?: TraceEntry[]
}

interface Out {
  unit: ArUnit
  tif: string
  rules: string[]
}

export class ArabicToTifinaghConverter {
  readonly profile: ProfileId
  readonly options: Readonly<ReverseOptions>
  private readonly config: ReverseConverterConfig

  constructor(config: ReverseConverterConfig = {}) {
    this.profile = config.profile ?? 'readable'
    this.options = Object.freeze(resolveReverseOptions(this.profile, config.options))
    this.config = config
  }

  convert(text: string): ReverseResult {
    return this.convertChunk(text, { fence: null }, 0)
  }

  /** Convert one chunk of a stream (split at line breaks); `state` carries fenced-code status. */
  convertChunk(text: string, state: SegmentState, offset = 0): ReverseResult {
    if (typeof text !== 'string') throw new TypeError('Arabic → Tifinagh conversion expects a string input.')
    const o = this.options
    const warnings: ConversionWarning[] = []
    const trace: TraceEntry[] | undefined = this.config.trace ? [] : undefined
    const parts: string[] = []
    for (const seg of segment(text, { protectUrls: o.protectUrls, protectCode: o.protectCode }, state, isArabicWordChar)) {
      if (seg.kind === 'protected') {
        parts.push(seg.text)
        continue
      }
      if (seg.kind === 'text') {
        parts.push(this.convertText(seg.text))
        continue
      }
      const start = seg.start + offset
      parts.push(this.convertWord(seg.text, start, warnings, trace))
    }
    const result: ReverseResult = { output: parts.join(''), profile: this.profile, warnings }
    if (trace) result.trace = trace
    if (this.config.strict) {
      const blocking = warnings.filter((w) => w.severity === 'warning' || w.severity === 'error')
      if (blocking.length > 0) {
        throw new TransliterationError(`Strict mode: ${blocking.length} problem(s) in input — first: ${blocking[0].code} at ${blocking[0].position}: ${blocking[0].message}`, blocking)
      }
    }
    return result
  }

  /** Punctuation and digits outside words. */
  private convertText(s: string): string {
    const o = this.options
    if (o.punctuation === 'preserve' && o.digits === 'preserve') return s
    let out = ''
    for (const ch of s) {
      const cp = ch.codePointAt(0)!
      if (o.punctuation === 'latin' && PUNCT[ch]) out += PUNCT[ch]
      else if (o.digits === 'western' && cp >= 0x0660 && cp <= 0x0669) out += String(cp - 0x0660)
      else if (o.digits === 'western' && cp >= 0x06f0 && cp <= 0x06f9) out += String(cp - 0x06f0)
      else out += ch
    }
    return out
  }

  private convertWord(word: string, start: number, warnings: ConversionWarning[], trace: TraceEntry[] | undefined): string {
    const o = this.options
    const us = units(word, start, warnings)

    // lexicon first (exact spelling, marks ignored)
    const lex = this.config.lexicon
    if (lex?.lookupArabic) {
      const key = arabicLexiconKey(word)
      const hit = lex.lookupArabic(key, this.profile)
      if (hit.kind === 'hit') {
        warnings.push(diag('LEXICON_OVERRIDE', `Lexicon (${hit.status}, source: ${hit.source}) gives '${hit.tifinagh}' for '${word}'.`, start, word))
        trace?.push({ position: start, source: word, output: hit.tifinagh, rules: ['lexicon.override'] })
        return hit.tifinagh
      }
      if (hit.kind === 'conflict') {
        warnings.push(diag('LEXICON_CONFLICT', `Lexicon has conflicting Tifinagh spellings (${hit.candidates.join(' / ')}); rule output kept.`, start, word))
      }
    }

    const emphaticWord = o.emphaticR === 'word-rule' && us.some((u) => EMPHATIC_LETTERS.has(u.base)) && !us.some((u) => u.base === 'ڔ' || hasMark(u, SEGOL))
    const outs: Out[] = []
    const prevTif = (): string => {
      for (let k = outs.length - 1; k >= 0; k--) if (outs[k].tif) return [...outs[k].tif].pop()!
      return ''
    }
    const nextIsA = (k: number): boolean => {
      const n = us[k + 1]
      return !!n && (ALEFS.has(n.base) || n.base === 'ة')
    }

    for (let k = 0; k < us.length; k++) {
      const u = us[k]
      const initial = outs.every((x) => x.tif === '')
      const rules: string[] = []
      let tif = ''
      const marked = u.marks.some((m) => SEMIVOWEL_MARKS.has(m))
      const geminate = hasMark(u, SHADDA)
      const b = u.base

      if (ALEFS.has(b)) {
        tif = 'ⴰ'
        rules.push('rev.alef')
      } else if (b === 'إ') {
        tif = 'ⵉ'
        rules.push('rev.initial-hamza-seat')
        if (o.semivowels === 'context' && us[k + 1]?.base === 'ي' && !us[k + 1].marks.length && !nextIsA(k + 1)) us[k + 1] = { ...us[k + 1], base: '\u0000' } // absorbed
      } else if (b === 'ئ' || b === 'ؤ') {
        tif = b === 'ئ' ? 'ⵉ' : 'ⵓ'
        rules.push('rev.initial-hamza-seat')
        const follower = b === 'ئ' ? 'ي' : 'و'
        const n = us[k + 1]
        // ئي / ؤو at the start of a word: one vowel (the yeh/waw only repeats it),
        // unless a vowel follows (ؤوا = ⵓⵡⴰ: Tawalt 4/4)
        if (o.semivowels === 'context' && initial && n && n.base === follower && !n.marks.length && !nextIsA(k + 1)) us[k + 1] = { ...n, base: '\u0000' }
      } else if (b === 'ي' || b === 'و') {
        const isY = b === 'ي'
        const prev = prevTif()
        let semi: boolean
        if (marked || geminate) {
          semi = true
          rules.push('rev.semivowel.marked')
        } else if (o.semivowels === 'marked') {
          semi = isY && initial
          rules.push('rev.vowel.marked-mode')
        } else {
          rules.push(isY ? 'rev.yeh.context' : 'rev.waw.context')
          if (initial || nextIsA(k)) semi = true
          else if (isY) semi = TIF_VOWELS.has(prev)
          // ئو + consonant is the hiatus ⵉⵓ (Tawalt); after any other vowel و is ⵡ
          else semi = us[k - 1]?.base !== 'ئ' && (prev === 'ⴰ' || prev === 'ⵓ' || prev === 'ⵉ')
        }
        tif = isY ? (semi ? 'ⵢ' : 'ⵉ') : semi ? 'ⵡ' : 'ⵓ'
      } else if (b === '\u0000') {
        tif = ''
        rules.push('rev.initial-hamza-seat')
      } else if (b === 'ر') {
        const asWrittenEmphatic = hasMark(u, SEGOL)
        tif = emphaticWord || asWrittenEmphatic ? 'ⵕ' : 'ⵔ'
        rules.push(emphaticWord ? 'rev.r.emphatic-word' : asWrittenEmphatic || o.emphaticR === 'as-written' ? 'rev.r.as-written' : 'rev.r.plain-word')
      } else if (CONSONANT[b]) {
        tif = CONSONANT[b]
        rules.push('rev.letter')
      } else if (APPROXIMATE[b]) {
        tif = APPROXIMATE[b]
        rules.push('rev.nonstandard')
        warnings.push(diag('APPROXIMATED_CHAR', `'${b}' has no Amazigh Tifinagh letter; written ${tif}.`, u.start, u.source))
      } else if (b === 'ء') {
        rules.push('rev.nonstandard')
        warnings.push(diag('APPROXIMATED_CHAR', `Hamza 'ء' has no Tifinagh letter and was left out.`, u.start, u.source))
      } else {
        tif = u.source
        rules.push('passthrough.unsupported')
        warnings.push(diag('UNKNOWN_CHAR', `'${b}' has no Tifinagh correspondence; it was kept unchanged.`, u.start, u.source))
      }

      // an unknown letter is kept verbatim, with its marks
      if (rules[0] === 'passthrough.unsupported') {
        outs.push({ unit: u, tif, rules })
        continue
      }
      // marks: shadda (double), damma (labialization), kasra/fatha (schwa), others
      const isConsonant = tif !== '' && !TIF_VOWELS.has(tif)
      let prefix = ''
      const before = outs[outs.length - 1]
      if (
        o.doubledLetters === 'schwa' &&
        isConsonant &&
        before &&
        before.unit.base === u.base &&
        b !== 'ي' &&
        b !== 'و' &&
        !before.tif.endsWith('ⴻ')
      ) {
        prefix = 'ⴻ'
        rules.push('rev.schwa.between-identical')
      }
      let suffix = ''
      if (geminate && tif) {
        tif = tif + tif
        rules.push('rev.shadda')
      }
      for (const m of u.marks) {
        if (m === SHADDA || SEMIVOWEL_MARKS.has(m) || m === SEGOL) continue
        if (m === DAMMA) {
          if (o.labialization === 'damma' && isConsonant && VELARS.has(tif[0])) {
            tif += 'ⵯ'
            rules.push('rev.damma.labialization')
          } else {
            warnings.push(diag('VOWEL_SIGN_IGNORED', `Damma on '${b}' has no Tifinagh counterpart here and was ignored.`, u.start, u.source))
          }
        } else if (m === KASRA || m === FATHA) {
          if (o.schwa === 'vowel-sign') {
            if (tif === 'ⴰ' && b === 'ا') tif = 'ⴻ' // alef carrier of a schwa
            else suffix += 'ⴻ'
            rules.push('rev.schwa')
          } else {
            warnings.push(diag('VOWEL_SIGN_IGNORED', `Short-vowel sign on '${b}' was ignored (the neutral vowel is not written in this profile).`, u.start, u.source))
          }
        } else if (IGNORED_MARKS.test(m)) {
          warnings.push(diag('VOWEL_SIGN_IGNORED', `Sign U+${m.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} on '${b}' has no Tifinagh counterpart and was ignored.`, u.start, u.source))
        } else {
          suffix += m
          warnings.push(diag('UNKNOWN_CHAR', `Mark U+${m.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} on '${b}' has no Tifinagh equivalent; it was kept.`, u.start, u.source))
        }
      }
      outs.push({ unit: u, tif: prefix + tif + suffix, rules })
    }

    let result = outs.map((x) => x.tif).join('')
    if (result === '') {
      result = word
      warnings.push(diag('EMPTY_WORD', `'${word}' has no letter that is written in Tifinagh; it was kept unchanged.`, start, word))
    }
    if (trace) {
      for (const x of outs) if (x.unit.base !== '\u0000' || x.tif) trace.push({ position: x.unit.start, source: x.unit.source, output: x.tif, rules: x.rules })
    }
    return result
  }
}

/** One-shot helper: Arabic-script Amazigh → Tifinagh. */
export function arabicToTifinagh(text: string, config: ReverseConverterConfig = {}): ReverseResult {
  return new ArabicToTifinaghConverter(config).convert(text)
}
