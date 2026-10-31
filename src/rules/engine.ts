import { AR, baseArabic } from '../alphabet/arabic'
import { diag } from '../diagnostics/diagnostics'
import { canonicalMarkOrder } from '../normalization/normalize'
import type { Unit } from '../tokenization/units'
import type { ArabicOptions, ConversionWarning, TraceEntry } from '../types/index'
import { SORTED_LETTER_RULES, type Condition, type PrevContext, type Rule } from './rules'

/** Output of one unit before rendering. */
interface Piece {
  unit: Unit
  /** Arabic letters (may already contain combining marks, e.g. و + U+065B). */
  base: string
  /** Combining marks to attach to the last letter of `base`. */
  marks: string
  /** How many times to write `base` (the run length for the `double` gemination style). */
  repeat: number
  /** Plain copies of `base` written before the marked letter (runs of 3+ with shadda). */
  prefixRepeat?: number
  /** Text written after the letter(s) and marks (e.g. Table I quote mark, extra marks). */
  suffix: string
  rules: string[]
}

export interface WordResult {
  output: string
  warnings: ConversionWarning[]
  trace: TraceEntry[]
}

function prevContext(units: Unit[], index: number): PrevContext {
  for (let i = index - 1; i >= 0; i--) {
    const u = units[i]
    if (u.kind === 'letter') return u.cls!
    return 'other'
  }
  return 'boundary'
}

function matches(cond: Condition, unit: Unit, prev: PrevContext, o: ArabicOptions): boolean {
  if (cond.letters && !cond.letters.includes(unit.letter!.char)) return false
  if (cond.classes && !cond.classes.includes(unit.cls!)) return false
  if (cond.prev && !cond.prev.includes(prev)) return false
  if (cond.single !== undefined && cond.single !== (unit.length === 1)) return false
  if (cond.options) {
    for (const k of Object.keys(cond.options) as (keyof ArabicOptions)[]) {
      if (cond.options[k] !== o[k]) return false
    }
  }
  return true
}

/** First matching letter rule (rules are pre-sorted by priority). */
export function selectRule(unit: Unit, prev: PrevContext, o: ArabicOptions): Rule | undefined {
  for (const r of SORTED_LETTER_RULES) if (matches(r.when, unit, prev, o)) return r
  return undefined
}

/**
 * Rule selection depends only on (letter, previous context, single vs geminate, options), and the
 * base letter only on (letter, options), so both are memoized per options
 * object. Results are identical to calling `selectRule` / `baseArabic`.
 */
const PREV_INDEX: Record<PrevContext, number> = { boundary: 0, vowel: 1, schwa: 2, semivowel: 3, consonant: 4, other: 5 }
interface Memo {
  rules: Map<string, Array<Rule | null | undefined>>
  base: Map<string, { text: string; rule: string } | null>
}
const MEMO = new WeakMap<ArabicOptions, Memo>()
function memoFor(o: ArabicOptions): Memo {
  let m = MEMO.get(o)
  if (!m) {
    m = { rules: new Map(), base: new Map() }
    MEMO.set(o, m)
  }
  return m
}
function selectRuleMemo(m: Memo, unit: Unit, prev: PrevContext, o: ArabicOptions): Rule | undefined {
  const ch = unit.letter!.char
  let row = m.rules.get(ch)
  if (!row) {
    row = new Array(12)
    m.rules.set(ch, row)
  }
  // rule conditions depend on the previous context and on single vs geminate
  const i = PREV_INDEX[prev] * 2 + (unit.length > 1 ? 1 : 0)
  let r = row[i]
  if (r === undefined) {
    r = selectRule(unit, prev, o) ?? null
    row[i] = r
  }
  return r ?? undefined
}
function baseArabicMemo(m: Memo, ch: string, o: ArabicOptions): { text: string; rule: string } | null {
  let b = m.base.get(ch)
  if (b === undefined) {
    b = baseArabic(ch, o)
    m.base.set(ch, b)
  }
  return b
}

/** Split "letter(s)+marks" into the part before trailing combining marks and those marks. */
function splitTrailingMarks(s: string): [string, string] {
  let i = s.length
  while (i > 0 && /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0300-\u036F\u0591-\u05C7]/.test(s[i - 1])) i--
  return [s.slice(0, i), s.slice(i)]
}

function render(p: Piece): string {
  if (p.base === '') return p.marks + p.suffix // only possible for a bare mark carrier (not produced) or schwa omission
  if (p.marks === '' && p.repeat === 1) return p.base + p.suffix // fast path: nothing to reorder
  const [letters, own] = splitTrailingMarks(p.base)
  const marks = canonicalMarkOrder(own + p.marks)
  const copies = p.repeat > 1 ? p.repeat - 1 : (p.prefixRepeat ?? 0)
  return (letters + own).repeat(copies) + letters + marks + p.suffix
}

/**
 * Convert the units of one Tifinagh word into Arabic according to `o`.
 * Pure function: same input and options always give the same output.
 */
export function convertUnits(units: Unit[], o: ArabicOptions, wantTrace = true): WordResult {
  const warnings: ConversionWarning[] = []
  const pieces: Piece[] = []
  const memo = memoFor(o)

  for (let i = 0; i < units.length; i++) {
    const u = units[i]
    if (u.kind !== 'letter') {
      pieces.push({ unit: u, base: '', marks: '', repeat: 1, suffix: u.source + u.extraMarks, rules: ['passthrough.unsupported'] })
      continue
    }
    const prev = prevContext(units, i)
    const rule = selectRuleMemo(memo, u, prev, o)
    const piece: Piece = { unit: u, base: '', marks: '', repeat: 1, suffix: '', rules: [] }
    if (!rule) {
      // cannot happen for inventory letters (letter.base covers all classes); keep text safe anyway
      piece.suffix = u.source
      piece.rules.push('passthrough.no-rule')
      pieces.push(piece)
      continue
    }
    piece.rules.push(rule.id)
    if (rule.action.type === 'emit') {
      piece.base = rule.action.text
    } else {
      const b = baseArabicMemo(memo, u.letter!.char, o)
      if (b) {
        piece.base = b.text
        piece.rules.push(b.rule)
      } else {
        piece.suffix = u.source
        piece.rules.push('passthrough.no-correspondence')
      }
    }

    if (u.cls === 'vowel' && prev === 'vowel') {
      warnings.push(diag('VOWEL_HIATUS', `Vowel '${u.source}' directly follows another vowel (hiatus); spelled with rule ${rule.id}.`, u.start, u.source))
    }

    // ── schwa ────────────────────────────────────────────────────────────
    if (u.cls === 'schwa') {
      if (o.schwa !== 'omit') {
        const mark = o.schwa === 'kasra' ? AR.KASRA : AR.FATHA
        const target = pieces[pieces.length - 1]
        if (target && target.unit.kind === 'letter' && (target.unit.cls === 'consonant' || target.unit.cls === 'semivowel') && target.base !== '') {
          target.marks += mark
          target.rules.push('schwa.mark')
          piece.rules.push('schwa.mark')
        } else {
          piece.base = AR.ALEF
          piece.marks = mark
          piece.rules.push('schwa.mark')
        }
      } else {
        const prevU = units[i - 1]
        const nextU = units[i + 1]
        if (o.reportSchwaOmission) {
          warnings.push(diag('SCHWA_OMITTED', `Schwa '${u.source}' is not written in Arabic script (IRCAM Table I).`, u.start, u.source))
        }
        if (
          prevU && nextU && prevU.kind === 'letter' && nextU.kind === 'letter' &&
          prevU.letter!.char === nextU.letter!.char && prevU.cls !== 'vowel' && prevU.cls !== 'schwa'
        ) {
          piece.rules.push('schwa.between-identical')
          if (o.gemination === 'double') {
            warnings.push(
              diag(
                'SCHWA_BETWEEN_IDENTICAL',
                `Omitted schwa between identical consonants ('${prevU.source}${u.source}${nextU.source}') makes the spelling identical to a geminate under gemination=double.`,
                u.start,
                u.source,
              ),
            )
          }
        }
      }
      pieces.push(piece)
      continue
    }

    // ── labialization ────────────────────────────────────────────────────
    if (u.labialized) {
      if (o.labialization === 'damma') {
        piece.marks += AR.DAMMA
        piece.rules.push('labialization.damma')
      } else if (o.labialization === 'ircam-table1') {
        piece.suffix += AR.LEFT_SINGLE_QUOTE
        piece.rules.push('labialization.ircam-table1')
      } else {
        piece.rules.push('labialization.omit')
      }
    }

    // ── gemination ───────────────────────────────────────────────────────
    if (u.length >= 2) {
      if (o.gemination === 'shadda') {
        piece.marks += AR.SHADDA
        // a run of n ≥ 3: (n − 2) plain letters, then the geminate (as in Tawalt: ⵢⵢⵢ → ييّ)
        if (u.length > 2) piece.prefixRepeat = u.length - 2
        piece.rules.push('gemination.shadda')
      } else if (o.gemination === 'double') {
        piece.repeat = u.length
        piece.rules.push('gemination.double')
      } else {
        piece.rules.push('gemination.single')
      }
    }

    if (u.extraMarks) piece.suffix += u.extraMarks
    pieces.push(piece)
  }

  // ── render ─────────────────────────────────────────────────────────────
  let output = ''
  const trace: TraceEntry[] = []
  for (const p of pieces) {
    const text = render(p)
    output += text
    if (!wantTrace) continue
    const rules = p.rules.some((r) => r.startsWith('gemination') || r.startsWith('labialization') || r === 'schwa.mark')
      ? [...p.rules, 'mark.canonical-order']
      : p.rules
    trace.push({ position: p.unit.start, source: p.unit.source + p.unit.extraMarks, output: text, rules })
  }
  return { output, warnings, trace }
}

