import { isTifinaghWordChar, LATIN_SMALL_W } from '../alphabet/inventory'
import { isCombiningMark, isFormatChar } from '../normalization/normalize'

/**
 * A slice of the input text.
 *  - `tifinagh`: a Tifinagh word to transliterate
 *  - `text`: anything else (spaces, punctuation, other scripts) — preserved
 *  - `protected`: URL, e-mail or code span — preserved even if it contains Tifinagh
 */
export interface Segment {
  kind: 'tifinagh' | 'text' | 'protected'
  text: string
  /** UTF-16 offset in the input. */
  start: number
}

/** State carried across lines when converting a stream (fenced code blocks). */
export interface SegmentState {
  fence: string | null
}

export interface SegmentOptions {
  protectUrls: boolean
  protectCode: boolean
}

type Range = [number, number]

/**
 * Split `text` into segments. Linear in the input length: no backtracking
 * regular expressions are used on unbounded input.
 */
export function segment(text: string, opts: SegmentOptions, state: SegmentState = { fence: null }): Segment[] {
  const protectedRanges: Range[] = []
  if (opts.protectCode) findCodeRanges(text, state, protectedRanges)
  if (opts.protectUrls) findUrlRanges(text, protectedRanges)
  const ranges = mergeRanges(protectedRanges)

  const out: Segment[] = []
  let cursor = 0
  for (const [s, e] of ranges) {
    if (s > cursor) splitTifinagh(text, cursor, s, out)
    out.push({ kind: 'protected', text: text.slice(s, e), start: s })
    cursor = e
  }
  if (cursor < text.length) splitTifinagh(text, cursor, text.length, out)
  return out
}

function pushText(out: Segment[], text: string, start: number): void {
  if (!text) return
  const last = out[out.length - 1]
  if (last && last.kind === 'text') last.text += text
  else out.push({ kind: 'text', text, start })
}

/** Split an unprotected stretch into Tifinagh words and other text. */
function splitTifinagh(text: string, from: number, to: number, out: Segment[]): void {
  let i = from
  let textStart = from
  while (i < to) {
    const cp = text.codePointAt(i)!
    if (!isTifinaghWordChar(cp)) {
      i += cp > 0xffff ? 2 : 1
      continue
    }
    // start of a Tifinagh word
    pushText(out, text.slice(textStart, i), textStart)
    const wordStart = i
    let j = i
    let end = i
    while (j < to) {
      const c = text.codePointAt(j)!
      const ch = String.fromCodePoint(c)
      const w = ch.length
      if (isTifinaghWordChar(c)) {
        j += w
        end = j
      } else if (isCombiningMark(ch) || ch === LATIN_SMALL_W) {
        // marks directly modify the preceding letter: part of the word
        j += w
        end = j
      } else if (isFormatChar(ch)) {
        // formatting chars belong to the word only when *internal*
        let k = j + w
        while (k < to && isFormatChar(String.fromCodePoint(text.codePointAt(k)!))) k += text.codePointAt(k)! > 0xffff ? 2 : 1
        if (k < to && isTifinaghWordChar(text.codePointAt(k)!)) {
          j = k
        } else break
      } else break
    }
    out.push({ kind: 'tifinagh', text: text.slice(wordStart, end), start: wordStart })
    i = end
    textStart = end
  }
  pushText(out, text.slice(textStart, to), textStart)
}

const isSpace = (c: number): boolean => c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0x0c || c === 0x0b || c === 0xa0 || c === 0x3000 || (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x1680 || c === 0x202f || c === 0x205f

const isAsciiAlnum = (c: number): boolean => (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)
const isSchemeChar = (c: number): boolean => isAsciiAlnum(c) || c === 0x2b || c === 0x2d || c === 0x2e
const LETTER_OR_DIGIT = /[\p{L}\p{N}\p{M}]/u
/** Characters allowed in an e-mail local part (incl. internationalized addresses, RFC 6531). */
const isEmailLocalChar = (ch: string): boolean => LETTER_OR_DIGIT.test(ch) || ch === '.' || ch === '_' || ch === '%' || ch === '+' || ch === '-'

/**
 * Protect URLs (scheme://…, www.…) and e-mail addresses. Works on
 * whitespace-delimited chunks; a URL extends to the end of its chunk.
 */
function findUrlRanges(text: string, out: Range[]): void {
  let i = 0
  const n = text.length
  while (i < n) {
    while (i < n && isSpace(text.charCodeAt(i))) i++
    const start = i
    while (i < n && !isSpace(text.charCodeAt(i))) i++
    const end = i
    if (end > start) protectChunk(text, start, end, out)
  }
}

function protectChunk(text: string, start: number, end: number, out: Range[]): void {
  const chunk = text.slice(start, end)
  // scheme://
  const sep = chunk.indexOf('://')
  if (sep > 0) {
    let s = sep
    while (s > 0 && isSchemeChar(chunk.charCodeAt(s - 1))) s--
    // scheme must start with a letter
    while (s < sep && !/[A-Za-z]/.test(chunk[s])) s++
    if (s < sep) {
      out.push([start + s, end])
      return
    }
  }
  // www.
  const lower = chunk.toLowerCase()
  let w = lower.indexOf('www.')
  while (w >= 0) {
    if (w === 0 || !isAsciiAlnum(chunk.charCodeAt(w - 1))) {
      out.push([start + w, end])
      return
    }
    w = lower.indexOf('www.', w + 1)
  }
  // e-mail: local@domain.tld
  const at = chunk.indexOf('@')
  if (at > 0 && chunk.indexOf('.', at + 2) > at + 1) {
    let s = at
    while (s > 0 && isEmailLocalChar(chunk[s - 1])) s--
    if (s < at) out.push([start + s, end])
  }
}

/**
 * Protect Markdown fenced code blocks (``` or ~~~ fences, possibly spanning
 * calls via `state`) and inline code spans (`…`, matching backtick runs on
 * the same line).
 */
function findCodeRanges(text: string, state: SegmentState, out: Range[]): void {
  let lineStart = 0
  const n = text.length
  while (lineStart <= n) {
    let lineEnd = text.indexOf('\n', lineStart)
    if (lineEnd < 0) lineEnd = n
    const line = text.slice(lineStart, lineEnd)
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    if (state.fence !== null) {
      out.push([lineStart, lineEnd])
      if (fence && fence[1][0] === state.fence[0] && fence[1].length >= state.fence.length && line.trim() === fence[1]) {
        state.fence = null
      }
    } else if (fence) {
      state.fence = fence[1]
      out.push([lineStart, lineEnd])
    } else {
      inlineCode(line, lineStart, out)
    }
    if (lineEnd >= n) break
    lineStart = lineEnd + 1
  }
}

function inlineCode(line: string, offset: number, out: Range[]): void {
  if (line.indexOf('`') < 0) return
  // collect backtick runs
  const runs: Array<[number, number]> = []
  for (let i = 0; i < line.length; ) {
    if (line.charCodeAt(i) === 0x60) {
      let j = i
      while (j < line.length && line.charCodeAt(j) === 0x60) j++
      runs.push([i, j - i])
      i = j
    } else i++
  }
  // index runs by length for linear matching
  const byLen = new Map<number, number[]>()
  runs.forEach(([, len], idx) => {
    const list = byLen.get(len)
    if (list) list.push(idx)
    else byLen.set(len, [idx])
  })
  const ptr = new Map<number, number>()
  let k = 0
  while (k < runs.length) {
    const [pos, len] = runs[k]
    const list = byLen.get(len)!
    let p = ptr.get(len) ?? 0
    while (p < list.length && list[p] <= k) p++
    ptr.set(len, p)
    if (p < list.length) {
      const closeIdx = list[p]
      const [cpos, clen] = runs[closeIdx]
      out.push([offset + pos, offset + cpos + clen])
      k = closeIdx + 1
    } else {
      k++
    }
  }
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return ranges
  const sorted = ranges.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const out: Range[] = [sorted[0].slice() as Range]
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1]
    const [s, e] = sorted[i]
    if (s <= last[1]) last[1] = Math.max(last[1], e)
    else out.push([s, e])
  }
  return out
}
