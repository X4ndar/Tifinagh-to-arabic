#!/usr/bin/env node
// Rebuild the Wikidata-derived evaluation sets (CC0 data). Requires network access.
//
//   node benchmarks/scripts/build-gold.mjs
//
// Writes:
//   data/gold/wikidata-lexemes.json   — Tachelhit lexeme forms with Tifinagh + Arabic-script representations
//   data/gold/wikidata-toponyms.json  — Moroccan entities whose Tifinagh (zgh) and Arabic (ar) labels
//                                       spell the same name (official Arabic spellings)
//
// The toponym filter compares *coarse consonant skeletons* only (vowels, semivowels,
// gemination and emphasis ignored; g/k/q merged). It uses no rule of the converter,
// so it does not bias the evaluation toward the converter's conventions.
import { writeFileSync, mkdirSync } from 'node:fs'

const UA = 'amazigh-transliterate-gold-builder/0.2 (https://github.com/x4ndar/tifinagh-to-arabic)'
const SPARQL = 'https://query.wikidata.org/sparql'
const OUT = new URL('../../data/gold/', import.meta.url)

async function sparql(query) {
  const url = SPARQL + '?query=' + encodeURIComponent(query)
  const res = await fetch(url, { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } })
  if (!res.ok) throw new Error(`SPARQL ${res.status}`)
  const json = await res.json()
  return json.results.bindings
}

async function entity(id) {
  const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`)
  return Object.values((await res.json()).entities)[0]
}

// ── Lexemes ────────────────────────────────────────────────────────────────
async function lexemes() {
  // Lexemes of Amazigh languages (Standard Moroccan Tamazight, Tachelhit, Central Atlas, Tarifit, Kabyle)
  const rows = await sparql(`SELECT DISTINCT ?l WHERE {
    VALUES ?lang { wd:Q7400 wd:Q34152 wd:Q49268 wd:Q34174 wd:Q25448 wd:Q35764 }
    ?l dct:language ?lang . }`)
  const out = []
  for (const r of rows) {
    const id = r.l.value.split('/').pop()
    const e = await entity(id)
    const reps = [e.lemmas, ...(e.forms ?? []).map((f) => f.representations)]
    for (const rep of reps) {
      const vals = Object.values(rep)
      const tif = vals.find((v) => /[ⴰ-⵿]/.test(v.value))
      const ar = vals.find((v) => /[\u0600-ۿ]/.test(v.value))
      const lat = vals.find((v) => /latn$/i.test(v.language))
      if (tif && ar) {
        out.push({ tifinagh: tif.value, arabic: ar.value, latin: lat?.value, lexeme: id, arabicLanguageCode: ar.language })
      }
    }
  }
  const uniq = [...new Map(out.map((x) => [x.tifinagh + '\t' + x.arabic, x])).values()]
  return uniq
}

// ── Toponyms / entities ────────────────────────────────────────────────────
const T = { 'ⴱ': 'B', 'ⴳ': 'K', 'ⴽ': 'K', 'ⵇ': 'K', 'ⴷ': 'D', 'ⴹ': 'D', 'ⴼ': 'F', 'ⵀ': 'H', 'ⵃ': 'H', 'ⵄ': 'E', 'ⵅ': 'X', 'ⵊ': 'J', 'ⵍ': 'L', 'ⵎ': 'M', 'ⵏ': 'N', 'ⵔ': 'R', 'ⵕ': 'R', 'ⵖ': 'G', 'ⵙ': 'S', 'ⵚ': 'S', 'ⵛ': 'C', 'ⵜ': 'T', 'ⵟ': 'T', 'ⵣ': 'Z', 'ⵥ': 'Z', 'ⵡ': '', 'ⵢ': '', 'ⴰ': '', 'ⵉ': '', 'ⵓ': '', 'ⴻ': '', 'ⵯ': '' }
const A = { 'ب': 'B', 'ك': 'K', 'ڭ': 'K', 'گ': 'K', 'ق': 'K', 'ج': 'J', 'د': 'D', 'ض': 'D', 'ف': 'F', 'ه': 'H', 'ح': 'H', 'ع': 'E', 'خ': 'X', 'ل': 'L', 'م': 'M', 'ن': 'N', 'ر': 'R', 'غ': 'G', 'س': 'S', 'ص': 'S', 'ش': 'C', 'ت': 'T', 'ط': 'T', 'ة': '', 'ز': 'Z', 'ظ': 'Z', 'ژ': 'Z', 'و': '', 'ي': '', 'ى': '', 'ا': '', 'أ': '', 'إ': '', 'آ': '', 'ؤ': '', 'ئ': '', 'ء': '', '\u0651': '' }
function skeleton(s, map) {
  const out = []
  for (const c of s) {
    if (c in map) {
      const v = map[c]
      if (v && out[out.length - 1] !== v) out.push(v)
    } else if (c === ' ' || c === '-') out.push(' ')
    else return null
  }
  return out.join('').split(/\s+/).filter(Boolean).join(' ')
}

async function toponyms() {
  const rows = await sparql(`SELECT ?item ?zgh ?ar ?fr WHERE {
    ?item wdt:P17 wd:Q1028 .
    ?item rdfs:label ?zgh FILTER(LANG(?zgh)="zgh")
    ?item rdfs:label ?ar FILTER(LANG(?ar)="ar")
    OPTIONAL { ?item rdfs:label ?fr FILTER(LANG(?fr)="fr") }
  }`)
  const keep = []
  for (const r of rows) {
    const t = r.zgh.value.trim()
    const a = r.ar.value.trim()
    const st = skeleton(t, T)
    const sa = skeleton(a.replace(/[\u064B-\u0652]/g, ''), A)
    if (st && sa && st === sa) keep.push({ qid: r.item.value.split('/').pop(), tifinagh: t, arabic: a, french: r.fr?.value })
  }
  keep.sort((x, y) => x.qid.localeCompare(y.qid, 'en', { numeric: true }))
  return { total: rows.length, keep }
}

const now = new Date().toISOString().slice(0, 10)
mkdirSync(OUT, { recursive: true })
const lex = await lexemes()
writeFileSync(
  new URL('wikidata-lexemes.json', OUT),
  JSON.stringify(
    {
      description: 'Amazigh lexeme forms on Wikidata having both a Tifinagh and an Arabic-script representation.',
      license: 'CC0-1.0 (Wikidata)',
      retrieved: now,
      sourceType: 'community lexicographic data (independent of this project)',
      profile: 'arabic-script Tachelhit (compared against `readable`)',
      entries: lex,
    },
    null,
    2,
  ) + '\n',
)
const top = await toponyms()
writeFileSync(
  new URL('wikidata-toponyms.json', OUT),
  JSON.stringify(
    {
      description:
        'Moroccan Wikidata items whose Standard Moroccan Tamazight (zgh, Tifinagh) and Arabic (ar) labels spell the same name. ' +
        'Arabic labels are official/lexicalized Arabic spellings, i.e. a different orthographic convention from Arabic-script Amazigh.',
      license: 'CC0-1.0 (Wikidata)',
      retrieved: now,
      sourceType: 'official Arabic spellings of (mostly) Amazigh-origin names',
      filter: 'equal coarse consonant skeletons (see build-gold.mjs); candidates: ' + top.total,
      entries: top.keep,
    },
    null,
    2,
  ) + '\n',
)
console.log(`lexeme pairs: ${lex.length}; toponym pairs: ${top.keep.length} of ${top.total}`)
