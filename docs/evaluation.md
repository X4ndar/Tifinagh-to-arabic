# Evaluation

Reproduce with:

```bash
npm run build
node benchmarks/evaluate.mjs \
  [--tawalt /path/to/tawalt_ar.json] \   # local only, see §1
  [--dglai /path/to/dglai.json] \        # local only, coverage
  [--json benchmarks/results/evaluation.json]
node benchmarks/performance.mjs --mb 20
```

Raw outputs: `benchmarks/results/evaluation.md`, `evaluation.json`,
`performance.json` (generated with both local datasets present).

## 1. Reference data

No expected value in the tests or the evaluation was produced by the
converter.

| Set | n | What it is | Shipped? | Influenced rule choices? |
|---|---:|---|---|---|
| `tawalt` | 27,921 | Tawalt Amazigh–Arabic dictionary, field `tifinagh_in_arabic`: every Tifinagh word with exactly one Arabic-script spelling | **no** (license unspecified; get it from Hugging Face `abdelhaqueidali/Tawalt-Amazigh-Arabic-Dictionary`) | **yes**: hiatus default and runs of 3 (91 words), and `readable`'s initial أ and گ (adopted at the maintainer's request after measuring) |
| `moroccan` | 7 | 3 examples confirmed by the project specification + 4 Wikidata Tachelhit lexeme forms in Arabic script | yes | yes (initial ئ/ؤ, shadda) |
| `toponyms` | 192 | Wikidata items whose Tifinagh (zgh) and Arabic (ar) labels spell the same name | yes | no |
| `albane` | 3 | worked examples of Albane et al. 2025 (Kabyle convention) | yes | no (convention rejected) |

Because `readable` now follows Tawalt's conventions, its Tawalt score is
**not a blind test** of those conventions; it still measures everything else
(letters, ئ/ؤ, gemination, schwa, hiatus) on 27,921 words, and the
"earlier default" row shows the score before the change. The
`toponyms` set remains fully held out.

The sets follow **different orthographic conventions**:

* `tawalt`: أ ئ ؤ word-initially, گ for ⴳ, shadda, irregular sukun, damma for
  labialization that the Tifinagh does not mark (see research.md §9).
* `moroccan`: bare ا initially (ازول, افوس), ئ / ؤ.
* `toponyms`: *official Arabic* spellings of names (أكادير, وجدة, الحسيمة):
  hamza on alef, ك for g, ة for final a, vowel omission, article ال.

## 2. Systems

* **baseline: naive Table I (1:1)** — every code point → its IRCAM Table I
  letter, ⵯ → ‘, schwa dropped; no context (`benchmarks/baselines.mjs`).
* **baseline: dictionary-style 1:1 map** — the character map that generated
  all 178,057 entries of `mustapharajaa/tamazight-Transliterating-en-ar`
  (ⴻ → ى, ⵯ → ڤ, ⵥ → ظ …), re-implemented from the analysis in
  [research.md](research.md); no data copied.
* **ours** — the three profiles (`readable` = Tawalt conventions: أ ئ ؤ, گ).
* **ablations** of `readable`: without positional rules (initial vowels as
  ا/اي/او), without the gemination rule (doubled letters), without both.
* **variants**: `readable` with the earlier defaults (IRCAM Table II ا and ڭ;
  hamza seats in hiatus).

Not compared: Albane et al.'s Java system (no published code; its 95.46 %
mixes sentence correctness with diacritic coverage and is not a word
accuracy), IRCAM's online transliterator (unreachable), upstream
`tifinagh-convert` (no Arabic output).

## 3. Metrics

* **exact** — output equals the reference (headline metric).
* **exact or listed alternative** — the reference is the output or one of the
  alternatives the converter lists (each alternative changes *one* documented
  convention). Separates legitimate alternative spellings from errors.
* **ignoring vowel signs** — fatha/damma/kasra/sukun/tanwin and U+065B removed
  on both sides; shadda kept (gemination still counts).
* **ignoring all marks** — shadda removed too.
* **CER** — code-point edit distance / reference length.
* Mismatch causes are found by applying cumulative normalizations in a fixed
  order (vowel signs → shadda → letter choice for g/ẓ/ṛ → initial-vowel
  spelling → final ة/ى → vowel-letter omission → article/spacing); the first
  level at which the strings agree is the reported cause.

## 4. Results (2026-10-30)

### `tawalt` (n = 27,921 words)

| system | exact | exact or alternative | ignoring vowel signs | ignoring all marks | CER |
|---|---:|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 15.1 % | 15.1 % | 16.9 % | 16.9 % | 0.221 |
| baseline: dictionary-style 1:1 map | 13.8 % | 13.8 % | 15.4 % | 15.4 % | 0.240 |
| **ours: readable (default)** | 88.2 % | 88.3 % | 99.6 % | 99.6 % | 0.020 |
| ours: ircam | 23.1 % | 47.1 % | 29.9 % | 29.9 % | 0.195 |
| ours: phonetic | 36.7 % | 76.3 % | 53.5 % | 53.5 % | 0.138 |
| ablation: readable − positional rules | 28.1 % | 88.3 % | 31.1 % | 31.1 % | 0.180 |
| ablation: readable − gemination rule | 53.2 % | 53.3 % | 59.6 % | 59.6 % | 0.088 |
| ablation: readable − all context | 17.5 % | 53.3 % | 19.4 % | 19.4 % | 0.248 |
| variant: readable with IRCAM Table II initial vowels and ڭ (earlier default) | 46.4 % | 83.2 % | 53.5 % | 53.5 % | 0.104 |
| variant: readable + hiatus=hamza-seat (earlier default) | 87.9 % | 88.0 % | 99.3 % | 99.3 % | 0.020 |

* Letters, initial vowels, gemination and schwa agree on **99.6 %** of
  words. The exact-match gap is Tawalt's sukun and damma (3195 words), which
  cannot be predicted from the Tifinagh.
* Context rules matter: without positional rules exact match falls to
  28.1 %, without the gemination rule to 53.2 %, without both to 17.5 % —
  the level of the naive baselines.
* Remaining true differences (0.4 %): 36 "other" (e.g. ⵢⵢⴰ → ييه,
  ⵎⵓⴽⴽⴰⵙⵏ → مؤكّاسن — lexical or inconsistent entries), 43 with vowel letters
  added/omitted, 12 with final ى/ه, 19 initial-vowel exceptions.

### `moroccan` (development set, n = 7)

| system | exact | exact or alternative | ignoring vowel signs | ignoring all marks | CER |
|---|---:|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 5/7 · 71.4 % | 71.4 % | 71.4 % | 71.4 % | 0.108 |
| baseline: dictionary-style 1:1 map | 5/7 · 71.4 % | 71.4 % | 71.4 % | 71.4 % | 0.081 |
| **ours: readable (default)** | 4/7 · 57.1 % | 100.0 % | 57.1 % | 57.1 % | 0.081 |
| ours: ircam | 5/7 · 71.4 % | 85.7 % | 85.7 % | 85.7 % | 0.054 |
| ours: phonetic | 6/7 · 85.7 % | 100.0 % | 100.0 % | 100.0 % | 0.027 |
| variant: readable with IRCAM Table II initial vowels and ڭ (earlier default) | 7/7 · 100.0 % | 100.0 % | 100.0 % | 100.0 % | 0.000 |

These references write bare ا (ازول, امغار, افوس): `readable` matches 4/7
exactly and all 7 through its listed alternatives; `readable` with
`initialVowels: 'hamza-seat'` matches 7/7 (checked in `tests/gold.test.ts`).

### `toponyms` (held out, official Arabic convention, n = 192)

| system | exact | exact or alternative | ignoring vowel signs | ignoring all marks | CER |
|---|---:|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 34/192 · 17.7 % | 17.7 % | 17.7 % | 17.7 % | 0.214 |
| baseline: dictionary-style 1:1 map | 39/192 · 20.3 % | 20.3 % | 20.3 % | 20.3 % | 0.196 |
| **ours: readable (default)** | 50/192 · 26.0 % | 40.1 % | 26.6 % | 34.4 % | 0.181 |
| ours: ircam | 29/192 · 15.1 % | 28.6 % | 18.8 % | 18.8 % | 0.265 |
| ours: phonetic | 29/192 · 15.1 % | 28.6 % | 18.8 % | 23.4 % | 0.265 |
| variant: readable with IRCAM Table II initial vowels and ڭ (earlier default) | 39/192 · 20.3 % | 33.9 % | 20.3 % | 26.6 % | 0.204 |

Causes of the 142 `readable` mismatches: vowel letters omitted or added (lexicalized spelling) 40; other (consonant or lexical difference) 30; word-initial vowel spelling (ئ ؤ أ إ آ ا) 26; letter choice for g/ẓ/ṛ (ڭ گ ك · ژ ظ ز · ڔ ر) 18; shadda 15; final -a as ة / ى 12; vowel signs / sukun only (fatha, damma, kasra, sukun, U+065B) 1.
A manual review of the "other" cases found no converter error: they are
Arabic lexicalizations (الحسيمة for ⵍⵃⵓⵙⵉⵎⴰ, أولاد for ⵡⵍⴰⴷ, بئر for ⴱⵉⵔ) or
inconsistent Wikidata labels (ⵜⵉⵎⵓⵎⵉⵍⵜ vs تيموليلت).

### `albane` (Kabyle convention, n = 3)

0/3 for every system, as expected (ⴳ → ڨ, full vowels dropped by rule R1,
ⵝ → ث). `readable` has the lowest CER (0.308).

## 5. Coverage, robustness, speed

| Measure | Result |
|---|---|
| IRCAM units with an explicit, tested mapping | 33 / 33 (31 letters + ⴳⵯ ⴽⵯ), in all 3 profiles |
| IRCAM DGLAI lexicon (local, 18,846 words, 104,100 Tifinagh chars) | 0 unsupported characters, 0 words with warnings |
| TAWNZA subtitles (local, CC-BY-4.0; 897,778 words, 3.5 M Tifinagh chars) | 3 unsupported code points (input typos), 75 diagnostics in total, 2.1 s |
| Input preservation (2,000 synthetic mixed-script documents) | 0 failures |
| Unit / integration tests | 358 passing in 12 files (CI: Node 18, 20, 22); 98.2 % line, 91.5 % branch coverage |
| Property tests (9 invariants) | 400 cases each on every CI run, 20,000 in the `thorough` CI job |
| Round trip (`ircam`, schwa-free words) | an independent decoder recovers the exact Tifinagh; 50,000 random multi-word cases |
| Metamorphic relations (9) | idempotence, letter counts, streaming = whole text, CLI = library, alternatives = their options, profile = its options, context independence, cache consistency |
| Demo page in Chromium | 19 checks: conversion, letter map, profile switch, keyboard, copy, warnings, offline fonts, no sideways scroll at 320–768 px, reduced motion, axe-core WCAG 2.1 AA with 0 violations (light and dark) |
| Installed package | packed tarball installed in an empty project: CommonJS, ES module, CLI, TypeScript types and Python bridge |
| TAWNZA through CLI, library and Python | identical output for 131,624 lines; every diagnostic points at its source text |
| Throughput, library, `readable`, 20 MiB synthetic text | 7.1 MiB/s, ≈ 333,000 words/s (`ircam` 7.2, `phonetic` 5.4 MiB/s) |
| Latency, single word | p50 1.6 µs, p99 6.9 µs |
| CLI streaming, same 20 MiB file | 3.2 MiB/s (incl. process start) |
| Scaling | 12× input → < 40× time asserted in tests (linear in practice) |

Hardware: 4-core Intel Xeon @ 2.10 GHz (cloud VM), Node 22.22. The
benchmark process RSS (≈ 720 MiB) is dominated by the 20 MiB test string and
three full outputs held at once, not by the library.

## 6. What remains unverified

* A **licensed, reviewed** Moroccan gold standard: Tawalt is large and
  independent but unlicensed and reflects one editorial convention; running
  text in context (sentences) has no Arabic-script reference at all.
* The `phonetic` schwa-as-kasra and the U+065B / ڔ renderings of IRCAM's
  non-Unicode marks (project decisions).
* Reader preferences per variety (Tachelhit, Central Atlas, Tarifit) for
  ا vs أ and ڭ vs گ.

To build a licensed held-out set: `node benchmarks/scripts/make-validation-sheet.mjs
words.txt --sample 300 > sheet.csv`, have native-speaker linguists fill
`reviewer_spelling` and `verdict`, then add the result to `data/gold/` with
the reviewers as source and run the evaluation.
