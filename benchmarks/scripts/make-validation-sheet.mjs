#!/usr/bin/env node
// Build a CSV sheet for human linguistic review of converter output.
//
//   node benchmarks/scripts/make-validation-sheet.mjs words.txt > sheet.csv
//   node benchmarks/scripts/make-validation-sheet.mjs dglai.json --sample 300 > sheet.csv
//
// Input: a UTF-8 file with one Tifinagh word per line, or the DGLAI JSON
// (object of entries with a `tifinagh` field). Reviewers fill `reviewer_spelling`,
// `verdict` (ok | alternative | wrong) and `notes`; finished sheets can be turned
// into a gold file with status "verified" and the reviewer named as source.
import { readFileSync } from 'node:fs'
import lib from '../../dist/index.js'

const { createConverter, convert } = lib
const [file, ...rest] = process.argv.slice(2)
if (!file) {
  console.error('usage: make-validation-sheet.mjs <words.txt|dglai.json> [--sample N] [--seed S]')
  process.exit(1)
}
const opt = (k, d) => (rest.includes(k) ? Number(rest[rest.indexOf(k) + 1]) : d)
const raw = readFileSync(file, 'utf8')
let words = file.endsWith('.json')
  ? Object.values(JSON.parse(raw)).flatMap((e) => (e.tifinagh ?? '').split(/[\s,;/()]+/))
  : raw.split(/\r?\n/)
words = [...new Set(words.map((w) => w.trim()).filter((w) => /^[ⴰ-⵿]+$/.test(w)))]

const n = opt('--sample', words.length)
let seed = opt('--seed', 1)
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648)
for (let i = words.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1))
  ;[words[i], words[j]] = [words[j], words[i]]
}
words = words.slice(0, n)

const conv = {
  readable: createConverter({ profile: 'readable', alternatives: true }),
  ircam: createConverter({ profile: 'ircam' }),
  phonetic: createConverter({ profile: 'phonetic' }),
}
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"'
console.log(['tifinagh', 'latin', 'readable', 'ircam', 'phonetic', 'alternatives', 'reviewer_spelling', 'verdict', 'notes'].join(','))
for (const w of words) {
  const r = conv.readable.convert(w)
  console.log(
    [w, convert(w, { from: 'tifinagh', to: 'latin' }).output, r.output, conv.ircam.convert(w).output, conv.phonetic.convert(w).output,
      r.alternatives.flatMap((a) => a.alternatives.map((x) => x.output)).join(' | '), '', '', '']
      .map(q)
      .join(','),
  )
}
