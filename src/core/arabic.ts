import { AR } from '../alphabet/arabic'
import { diag, TransliterationError } from '../diagnostics/diagnostics'
import { DEFAULT_PROFILE, resolveOptions } from '../profiles/profiles'
import { convertUnits } from '../rules/engine'
import { segment, type Segment, type SegmentState } from '../tokenization/segment'
import { tokenizeWord } from '../tokenization/units'
import type {
  ArabicOptions,
  ConversionWarning,
  LexiconLike,
  ProfileId,
  TraceEntry,
  WordAlternatives,
} from '../types/index'

export interface ArabicConverterConfig {
  profile?: ProfileId
  /** Per-option overrides on top of the profile. */
  arabic?: Partial<ArabicOptions>
  /** Throw a TransliterationError if any `warning`-severity diagnostic occurs. */
  strict?: boolean
  /** Compute alternative spellings per word. */
  alternatives?: boolean
  /** Record which rules produced each output unit. */
  trace?: boolean
  lexicon?: LexiconLike | null
}

export interface ArabicResult {
  output: string
  profile: ProfileId
  warnings: ConversionWarning[]
  alternatives?: WordAlternatives[]
  trace?: TraceEntry[]
}

/**
 * Documented alternative option sets used to list legitimate alternative
 * spellings of a word. Each corresponds to a convention attested in a
 * source (see docs/linguistic-rules.md §Alternatives).
 */
export const ALTERNATIVE_VARIANTS: ReadonlyArray<{ label: string; options: Partial<ArabicOptions> }> = [
  { label: 'initial vowels all with hamza (أ / ئ / ؤ, Tawalt dictionary)', options: { initialVowels: 'hamza-all' } },
  { label: 'initial vowels ا / ئ / ؤ (IRCAM Table II)', options: { initialVowels: 'hamza-seat' } },
  { label: 'initial vowels with alef (اي / او / ا)', options: { initialVowels: 'alef' } },
  { label: 'initial vowels with hamza on alef (إي / أو / أ)', options: { initialVowels: 'hamza-alef' } },
  { label: 'gemination as doubled letters', options: { gemination: 'double' } },
  { label: 'gemination not written', options: { gemination: 'single' } },
  { label: 'g as kaf (ك)', options: { g: 'kaf' } },
  { label: 'g as gaf (گ, IRCAM Table I, Tawalt)', options: { g: 'gaf' } },
  { label: 'g as ڭ (IRCAM Table II)', options: { g: 'ng' } },
  { label: 'ẓ as zain (ز)', options: { emphaticZ: 'zain' } },
  { label: 'ẓ as zah (ظ)', options: { emphaticZ: 'zah' } },
  { label: 'labialization not written', options: { labialization: 'omit' } },
  { label: 'semivowels unmarked', options: { semivowelMark: 'none' } },
  { label: 'ṛ as plain reh', options: { emphaticR: 'plain' } },
]

const ARABIC_PUNCT: Readonly<Record<string, string>> = { ',': AR.COMMA, ';': AR.SEMICOLON, '?': AR.QUESTION }

/**
 * A reusable, precompiled Tifinagh → Arabic converter. Option resolution and
 * validation happen once; `convert` is then a linear pass over the input.
 */
export class ArabicConverter {
  readonly profile: ProfileId
  readonly options: Readonly<ArabicOptions>
  private readonly config: ArabicConverterConfig
  private readonly variantOptions: ReadonlyArray<{ label: string; options: ArabicOptions }>

  constructor(config: ArabicConverterConfig = {}) {
    this.profile = config.profile ?? DEFAULT_PROFILE
    this.options = Object.freeze(resolveOptions(this.profile, config.arabic))
    this.config = config
    this.variantOptions = ALTERNATIVE_VARIANTS.map((v) => ({ label: v.label, options: { ...this.options, ...v.options } }))
  }

  /** Convert a complete text. */
  convert(text: string): ArabicResult {
    return this.convertChunk(text, { fence: null }, 0)
  }

  /**
   * Convert one chunk of a larger stream. `state` carries fenced-code-block
   * status between chunks; `offset` shifts reported positions. Chunks must
   * not split a Tifinagh word (splitting at line breaks is always safe).
   */
  convertChunk(text: string, state: SegmentState, offset = 0): ArabicResult {
    if (typeof text !== 'string') throw new TypeError('Tifinagh → Arabic conversion expects a string input.')
    const o = this.options
    const segments = segment(text, { protectUrls: o.protectUrls, protectCode: o.protectCode }, state)
    const warnings: ConversionWarning[] = []
    const trace: TraceEntry[] | undefined = this.config.trace ? [] : undefined
    const alternatives: WordAlternatives[] | undefined = this.config.alternatives ? [] : undefined
    const parts: string[] = []
    let lastWasTifinagh = false

    for (const seg of segments) {
      if (seg.kind !== 'tifinagh') {
        parts.push(seg.kind === 'text' && o.punctuation === 'arabic' ? arabicPunctuation(seg, lastWasTifinagh) : seg.text)
        if (seg.kind === 'protected' || /[^\s,;?]/.test(seg.text)) lastWasTifinagh = false
        continue
      }
      lastWasTifinagh = true
      const start = seg.start + offset
      const tok = tokenizeWord(seg.text, start)
      warnings.push(...tok.warnings)
      const ruled = convertUnits(tok.units, o, trace !== undefined)
      warnings.push(...ruled.warnings)
      let wordOut = ruled.output

      const lex = this.config.lexicon
      if (lex) {
        const hit = lex.lookup(tok.normalized, this.profile)
        if (hit.kind === 'hit') {
          if (hit.arabic !== wordOut) {
            warnings.push(
              diag('LEXICON_OVERRIDE', `Lexicon (${hit.status}, source: ${hit.source}) overrides rule output '${wordOut}' with '${hit.arabic}'.`, start, seg.text),
            )
          }
          wordOut = hit.arabic
          if (trace) trace.push({ position: start, source: seg.text, output: hit.arabic, rules: ['lexicon.override'] })
        } else if (hit.kind === 'conflict') {
          warnings.push(
            diag('LEXICON_CONFLICT', `Lexicon has conflicting spellings (${hit.candidates.join(' / ')}); rule output kept.`, start, seg.text),
          )
        }
      }
      if (trace && !(lex && wordOut !== ruled.output)) trace.push(...ruled.trace)

      if (alternatives) {
        const seen = new Set<string>([wordOut])
        const alts: Array<{ output: string; label: string }> = []
        if (wordOut !== ruled.output) {
          seen.add(ruled.output)
          alts.push({ output: ruled.output, label: 'rule-based spelling (lexicon overridden)' })
        }
        for (const v of this.variantOptions) {
          const alt = convertUnits(tok.units, v.options, false).output
          if (!seen.has(alt)) {
            seen.add(alt)
            alts.push({ output: alt, label: v.label })
          }
        }
        alternatives.push({ position: start, source: seg.text, output: wordOut, alternatives: alts })
      }
      parts.push(wordOut)
    }

    const result: ArabicResult = { output: parts.join(''), profile: this.profile, warnings }
    if (trace) result.trace = trace
    if (alternatives) result.alternatives = alternatives
    if (this.config.strict) {
      const blocking = warnings.filter((w) => w.severity === 'warning' || w.severity === 'error')
      if (blocking.length > 0) {
        throw new TransliterationError(
          `Strict mode: ${blocking.length} problem(s) in input — first: ${blocking[0].code} at ${blocking[0].position}: ${blocking[0].message}`,
          blocking,
        )
      }
    }
    return result
  }
}

/** Convert `,` `;` `?` that directly follow (possibly after spaces) a converted Tifinagh word. */
function arabicPunctuation(seg: Segment, afterTifinagh: boolean): string {
  if (!afterTifinagh) return seg.text
  let out = ''
  let active = true
  for (const ch of seg.text) {
    if (active && ARABIC_PUNCT[ch]) {
      out += ARABIC_PUNCT[ch]
      continue
    }
    if (!/\s/.test(ch)) active = false
    out += ch
  }
  return out
}

/** One-shot helper. */
export function tifinaghToArabic(text: string, config: ArabicConverterConfig = {}): ArabicResult {
  return new ArabicConverter(config).convert(text)
}
