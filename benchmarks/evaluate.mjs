#!/usr/bin/env node
// Quality evaluation against independently sourced references.
//
//   npm run build && node benchmarks/evaluate.mjs [--dglai path/to/dglai.json] [--json out.json]
//
// Datasets (data/gold):
//   moroccan   specification-examples.json + wikidata-lexemes.json  (Arabic-script Amazigh)
//   toponyms   wikidata-toponyms.json  (official Arabic spellings — a *different* convention)
//   albane     albane2025-examples.json (Algerian/Kabyle convention — reported only)
// Optional coverage corpus (not shipped, CC-BY-NC): IRCAM DGLAI scraped dataset.
import { readFileSync, writeFileSync } from 'node:fs'
import lib from '../dist/index.js'
import { dictionaryStyle, naiveTable1 } from './baselines.mjs'

const { createConverter, IRCAM_LETTERS, CORRESPONDENCES } = lib
const args = process.argv.slice(2)
const argVal = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined)

const load = (f) => JSON.parse(readFileSync(new URL(`../data/gold/${f}`, import.meta.url), 'utf8'))
const spec = load('specification-examples.json')
const lex = load('wikidata-lexemes.json')
const topo = load('wikidata-toponyms.json')
const albane = load('albane2025-examples.json')

const DATASETS = {
  moroccan: [
    ...spec.entries.map((e) => ({ ...e, origin: 'specification' })),
    ...lex.entries.map((e) => ({ ...e, origin: `wikidata:${e.lexeme}` })),
  ],
  toponyms: topo.entries.map((e) => ({ ...e, origin: `wikidata:${e.qid}` })),
  albane: albane.entries.map((e) => ({ ...e, origin: `albane2025:fig${e.figure}` })),
}

// ── Systems ────────────────────────────────────────────────────────────────
const conv = (profile, arabic = {}) => {
  const c = createConverter({ profile, arabic })
  const ca = createConverter({ profile, arabic, alternatives: true })
  return { run: (t) => c.convert(t).output, alts: (t) => ca.convert(t).alternatives.flatMap((w) => w.alternatives.map((a) => a.output)) }
}
const SYSTEMS = {
  'baseline: naive Table I (1:1)': { run: naiveTable1 },
  'baseline: dictionary-style 1:1 map': { run: dictionaryStyle },
  'ours: readable (default)': conv('readable'),
  'ours: ircam': conv('ircam'),
  'ours: phonetic': conv('phonetic'),
  'ablation: readable − positional rules': conv('readable', { initialVowels: 'alef', hiatus: 'plain' }),
  'ablation: readable − gemination rule': conv('readable', { gemination: 'double' }),
  'ablation: readable − all context': conv('readable', { initialVowels: 'alef', hiatus: 'plain', gemination: 'double' }),
}

// ── Metrics ────────────────────────────────────────────────────────────────
function levenshtein(a, b) {
  const x = [...a]
  const y = [...b]
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j)
  for (let i = 1; i <= x.length; i++) {
    const cur = [i]
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[y.length]
}

const HARAKAT = /[ً-ٰٟ]/g
/**
 * Ordered normalization levels used to *explain* mismatches (never to score the
 * strict metric). Each level includes the previous ones.
 */
const LEVELS = [
  ['diacritics (shadda / damma / kasra)', (s) => s.replace(HARAKAT, '')],
  ['letter choice for g/ẓ/ṛ (ڭ گ ك · ژ ظ ز · ڔ ر)', (s) => s.replace(/[ڭگ]/g, 'ك').replace(/[ژظ]/g, 'ز').replace(/ڔ/g, 'ر')],
  ['word-initial vowel spelling (ئ ؤ أ إ آ ا)', (s) => s.split(' ').map((w) => w.replace(/^(?:[ئؤأإآا][يو]?)/u, 'ا')).join(' ')],
  ['final -a as ة / ى', (s) => s.replace(/[ةى](?=\s|$)/g, 'ا')],
  ['vowel letters omitted or added (lexicalized spelling)', (s) => s.split(' ').map((w) => w[0] + w.slice(1).replace(/[اوي]/g, '')).join(' ')],
  ['article / clitic spacing (ال, word breaks)', (s) => s.replace(/(^|\s)ال/g, '$1').replace(/\s+/g, '')],
]
function explain(pred, ref) {
  let p = pred
  let r = ref
  for (const [label, f] of LEVELS) {
    p = f(p)
    r = f(r)
    if (p === r) return label
  }
  return 'other (consonant or lexical difference)'
}

function phenomena(t) {
  const tags = []
  if (/ⴻ/.test(t)) tags.push('schwa')
  if (/ⵯ/.test(t)) tags.push('labialization')
  if (/([^ⴰⵉⵓⴻ\s])\1/u.test(t)) tags.push('gemination')
  if (/[ⴹⵕⵚⵟⵥ]/.test(t)) tags.push('emphatic')
  if (/[ⵡⵢ]/.test(t)) tags.push('semivowel')
  if (/(^|\s|-)[ⴰⵉⵓ]/u.test(t)) tags.push('initial vowel')
  if (/[ⵉⵓ]/.test(t)) tags.push('vowel i/u')
  if (/ⴳ/.test(t)) tags.push('g')
  if (/[ⴰⵉⵓ][ⴰⵉⵓ]/.test(t)) tags.push('hiatus')
  return tags
}

function evaluate(sysName, sys, items) {
  let exact = 0
  let altMatch = 0
  let skeleton = 0
  let edits = 0
  let refLen = 0
  const byTag = {}
  const errors = {}
  const examples = []
  for (const it of items) {
    const pred = sys.run(it.tifinagh)
    const ok = pred === it.arabic
    const alt = ok || (sys.alts ? sys.alts(it.tifinagh).includes(it.arabic) : false)
    const skel = LEVELS[0][1](pred) === LEVELS[0][1](it.arabic)
    exact += ok
    altMatch += alt
    skeleton += skel
    edits += levenshtein(pred, it.arabic)
    refLen += [...it.arabic].length
    for (const tag of phenomena(it.tifinagh)) {
      byTag[tag] ??= { n: 0, exact: 0 }
      byTag[tag].n++
      byTag[tag].exact += ok
    }
    if (!ok) {
      const cat = explain(pred, it.arabic)
      errors[cat] = (errors[cat] ?? 0) + 1
      if (examples.length < 12) examples.push({ tifinagh: it.tifinagh, reference: it.arabic, predicted: pred, category: cat })
    }
  }
  const n = items.length
  return { system: sysName, n, exact, exactRate: exact / n, altMatchRate: altMatch / n, skeletonRate: skeleton / n, cer: edits / refLen, byTag, errors, examples }
}

const pct = (x) => (100 * x).toFixed(1) + '%'
const results = {}
for (const [ds, items] of Object.entries(DATASETS)) {
  results[ds] = Object.entries(SYSTEMS).map(([name, sys]) => evaluate(name, sys, items))
}

// ── Coverage ───────────────────────────────────────────────────────────────
const readable = createConverter({ profile: 'readable' })
const coverage = {
  ircamUnits: CORRESPONDENCES.length,
  ircamUnitsMapped: CORRESPONDENCES.filter((c) => {
    const out = readable.convert('ⴱ' + c.tifinagh + 'ⴷ')
    return out.warnings.length === 0 && !/[ⴰ-⵿]/.test(out.output)
  }).length,
}
const dglaiPath = argVal('--dglai')
if (dglaiPath) {
  const d = JSON.parse(readFileSync(dglaiPath, 'utf8'))
  const words = Object.values(d).flatMap((e) => (e.tifinagh ?? '').split(/[\s,;/()]+/).filter(Boolean))
  let chars = 0
  let unsupported = 0
  let warnedWords = 0
  const codes = {}
  const t0 = process.hrtime.bigint()
  for (const w of words) {
    const r = readable.convert(w)
    chars += [...w].filter((c) => /[ⴰ-⵿]/.test(c)).length
    unsupported += r.warnings.filter((x) => x.code === 'UNSUPPORTED_TIFINAGH').length
    if (r.warnings.some((x) => x.severity === 'warning')) warnedWords++
    for (const x of r.warnings) codes[x.code] = (codes[x.code] ?? 0) + 1
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6
  coverage.dglai = { words: words.length, tifinaghChars: chars, unsupportedChars: unsupported, unsupportedRate: unsupported / chars, wordsWithWarnings: warnedWords, warningCodes: codes, ms }
}

// ── Preservation check on a synthetic mixed corpus ─────────────────────────
function preservation() {
  const others = ['bonjour', 'مرحبا', '2026', '😀', 'https://ⵜⴰ.ma/ⴰ', '`ⴰⵣⵓⵍ`', 'a@b.ma', '«', '»', '—', '\t', '  ', '\n', '\r\n']
  const words = IRCAM_LETTERS.map((l) => l.char)
  let failures = 0
  let rng = 42
  const rand = (n) => ((rng = (rng * 1103515245 + 12345) % 2147483648), rng % n)
  for (let k = 0; k < 2000; k++) {
    const parts = []
    for (let i = 0; i < 12; i++) {
      if (rand(2)) parts.push(Array.from({ length: 1 + rand(8) }, () => words[rand(words.length)]).join(''))
      else parts.push(others[rand(others.length)])
    }
    const text = parts.join(' ')
    const out = readable.convert(text).output
    const strip = (s) => s.replace(/[؀-ۿⴰ-⵿]+/g, '')
    // the non-Arabic, non-Tifinagh skeleton must be identical (protected spans keep their Tifinagh)
    if (strip(out) !== strip(text)) failures++
  }
  return { cases: 2000, failures }
}
const preserve = preservation()

// ── Report ─────────────────────────────────────────────────────────────────
const lines = []
for (const [ds, rows] of Object.entries(results)) {
  lines.push(`\n## ${ds} (n = ${rows[0].n})\n`)
  lines.push('| system | exact | exact or listed alternative | exact ignoring diacritics | CER |')
  lines.push('|---|---:|---:|---:|---:|')
  for (const r of rows) lines.push(`| ${r.system} | ${r.exact}/${r.n} (${pct(r.exactRate)}) | ${pct(r.altMatchRate)} | ${pct(r.skeletonRate)} | ${r.cer.toFixed(3)} |`)
}
lines.push('\n## coverage\n')
lines.push('```json\n' + JSON.stringify(coverage, null, 2) + '\n```')
lines.push(`\n## preservation\n\n${preserve.failures} failures in ${preserve.cases} synthetic mixed-script documents`)
console.log(lines.join('\n'))

const readableTopo = results.toponyms.find((r) => r.system.startsWith('ours: readable'))
console.log('\nreadable vs official toponyms — mismatch explanations:')
console.log(readableTopo.errors)
console.log('\nreadable vs official toponyms — by phenomenon (exact):')
console.log(Object.fromEntries(Object.entries(readableTopo.byTag).map(([k, v]) => [k, `${v.exact}/${v.n}`])))

const out = argVal('--json')
if (out) writeFileSync(out, JSON.stringify({ results, coverage, preservation: preserve }, null, 2) + '\n')
