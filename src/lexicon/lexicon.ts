import { LABIALIZATION_MARK, LETTER_BY_CHAR } from '../alphabet/inventory'
import type { LexiconLike, LexiconLookup, LexiconStatus, ProfileId } from '../types/index'

/**
 * One lexical override. Entries are word-level and exact-match on the
 * (normalized) Tifinagh word. Only `verified` entries override the rule
 * engine unless the lexicon is created with `allowProvisional: true`.
 */
export interface LexiconEntry {
  tifinagh: string
  arabic: string
  /** Profiles the entry applies to. Default: all profiles. */
  profiles?: ProfileId[]
  status: LexiconStatus
  /** Where the spelling comes from (citation, URL, reviewer). Required. */
  source: string
  note?: string
}

export interface LexiconOptions {
  /** Let `provisional` entries override rule output (default false). */
  allowProvisional?: boolean
  /** Maximum number of entries accepted (default 1,000,000). */
  maxEntries?: number
}

export interface LexiconConflict {
  tifinagh: string
  profile: ProfileId
  candidates: string[]
}

const PROFILES: ProfileId[] = ['ircam', 'readable', 'phonetic']
// Arabic letters & marks (Arabic, Arabic Supplement, Arabic Extended-A/B) — no spaces, no Latin.
const ARABIC_WORD_RE = /^[\u0600-ۿݐ-ݿࡰ-\u08FF]+$/u

export class LexiconValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LexiconValidationError'
  }
}

/** Validate an entry; throws LexiconValidationError with a precise message. */
export function validateEntry(e: unknown, index = 0): LexiconEntry {
  const where = `lexicon entry #${index}`
  if (typeof e !== 'object' || e === null) throw new LexiconValidationError(`${where}: must be an object`)
  const r = e as Record<string, unknown>
  for (const key of Object.keys(r)) {
    if (!['tifinagh', 'arabic', 'profiles', 'status', 'source', 'note'].includes(key)) {
      throw new LexiconValidationError(`${where}: unknown field '${key}'`)
    }
  }
  if (typeof r.tifinagh !== 'string' || r.tifinagh.length === 0 || r.tifinagh.length > 200) {
    throw new LexiconValidationError(`${where}: 'tifinagh' must be a non-empty string (≤ 200 chars)`)
  }
  for (const ch of r.tifinagh) {
    if (!LETTER_BY_CHAR.has(ch) && ch !== LABIALIZATION_MARK) {
      throw new LexiconValidationError(`${where}: 'tifinagh' contains non-Tifinagh-letter character '${ch}'`)
    }
  }
  if (typeof r.arabic !== 'string' || !ARABIC_WORD_RE.test(r.arabic) || r.arabic.length > 400) {
    throw new LexiconValidationError(`${where}: 'arabic' must be a single Arabic-script word (letters and marks only)`)
  }
  if (r.status !== 'verified' && r.status !== 'provisional') {
    throw new LexiconValidationError(`${where}: 'status' must be 'verified' or 'provisional'`)
  }
  if (typeof r.source !== 'string' || r.source.trim() === '') {
    throw new LexiconValidationError(`${where}: 'source' (provenance) is required`)
  }
  if (r.profiles !== undefined) {
    if (!Array.isArray(r.profiles) || r.profiles.some((p) => !PROFILES.includes(p as ProfileId))) {
      throw new LexiconValidationError(`${where}: 'profiles' must be an array of ${PROFILES.join(', ')}`)
    }
  }
  if (r.note !== undefined && typeof r.note !== 'string') throw new LexiconValidationError(`${where}: 'note' must be a string`)
  return {
    tifinagh: r.tifinagh,
    arabic: r.arabic,
    status: r.status,
    source: r.source,
    ...(r.profiles ? { profiles: r.profiles as ProfileId[] } : {}),
    ...(r.note ? { note: r.note as string } : {}),
  }
}

/**
 * Optional word-level override lexicon with provenance and conflict detection.
 * Empty by default: this library ships no third-party lexical data.
 */
export class Lexicon implements LexiconLike {
  private readonly map = new Map<string, LexiconEntry[]>()
  private count = 0
  private readonly allowProvisional: boolean
  private readonly maxEntries: number

  constructor(entries: Iterable<LexiconEntry> = [], options: LexiconOptions = {}) {
    this.allowProvisional = options.allowProvisional ?? false
    this.maxEntries = options.maxEntries ?? 1_000_000
    let i = 0
    for (const e of entries) this.add(e, i++)
  }

  /** Parse and validate a JSON document: either an array of entries or `{ entries: [...] }`. */
  static fromJSON(json: string | unknown, options: LexiconOptions = {}): Lexicon {
    const data = typeof json === 'string' ? (JSON.parse(json) as unknown) : json
    const list = Array.isArray(data) ? data : (data as { entries?: unknown })?.entries
    if (!Array.isArray(list)) throw new LexiconValidationError('lexicon JSON must be an array of entries or an object with an "entries" array')
    return new Lexicon(
      list.map((e, i) => validateEntry(e, i)),
      options,
    )
  }

  add(entry: LexiconEntry, index = this.count): void {
    const e = validateEntry(entry, index)
    if (this.count >= this.maxEntries) throw new LexiconValidationError(`lexicon exceeds maxEntries (${this.maxEntries})`)
    const list = this.map.get(e.tifinagh)
    if (list) {
      if (!list.some((x) => x.arabic === e.arabic && sameProfiles(x, e) && x.status === e.status)) list.push(e)
    } else this.map.set(e.tifinagh, [e])
    this.count++
  }

  get size(): number {
    return this.map.size
  }

  /** Entries usable for `profile` (verified only, unless provisional allowed). */
  private usable(tifinagh: string, profile: ProfileId): LexiconEntry[] {
    const list = this.map.get(tifinagh)
    if (!list) return []
    return list.filter((e) => (!e.profiles || e.profiles.includes(profile)) && (e.status === 'verified' || this.allowProvisional))
  }

  lookup(tifinagh: string, profile: ProfileId): LexiconLookup {
    const list = this.usable(tifinagh, profile)
    if (list.length === 0) return { kind: 'none' }
    // verified entries take precedence over provisional ones
    const verified = list.filter((e) => e.status === 'verified')
    const pool = verified.length > 0 ? verified : list
    const spellings = [...new Set(pool.map((e) => e.arabic))]
    if (spellings.length > 1) return { kind: 'conflict', candidates: spellings }
    const e = pool[0]
    return { kind: 'hit', arabic: e.arabic, source: e.source, status: e.status }
  }

  /** All (word, profile) pairs with more than one competing spelling. */
  conflicts(): LexiconConflict[] {
    const out: LexiconConflict[] = []
    for (const [tifinagh, list] of this.map) {
      for (const profile of PROFILES) {
        const forProfile = list.filter((e) => !e.profiles || e.profiles.includes(profile))
        const verified = forProfile.filter((e) => e.status === 'verified')
        const pool = verified.length > 0 ? verified : forProfile
        const spellings = [...new Set(pool.map((e) => e.arabic))]
        if (spellings.length > 1) out.push({ tifinagh, profile, candidates: spellings })
      }
    }
    return out
  }

  entries(): LexiconEntry[] {
    return [...this.map.values()].flat()
  }
}

function sameProfiles(a: LexiconEntry, b: LexiconEntry): boolean {
  const pa = (a.profiles ?? PROFILES).slice().sort().join(',')
  const pb = (b.profiles ?? PROFILES).slice().sort().join(',')
  return pa === pb
}
