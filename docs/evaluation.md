# Evaluation

Reproduce with:

```bash
npm run build
node benchmarks/evaluate.mjs [--dglai /path/to/dglai.json] [--json benchmarks/results/evaluation.json]
node benchmarks/performance.mjs --mb 20
```

Raw outputs: `benchmarks/results/evaluation.md`, `evaluation.json`,
`performance.json`.

## 1. The reference data problem

There is **no public, independently produced, sizeable corpus of Moroccan
Amazigh written in both Tifinagh and Arabic script**. What could be found:

| Set | n | What it is | Independent of this project? | Used to choose rules? |
|---|---:|---|---|---|
| `moroccan` | 7 | 3 examples confirmed by the project specification + 4 Wikidata Tachelhit lexeme forms in Arabic script | yes (spellings not produced by the converter) | **yes** — the Wikidata forms confirmed the Table II initial vowels and shadda, so this set is a development set, not a held-out test |
| `toponyms` | 192 | Wikidata items whose Tifinagh (zgh) and Arabic (ar) labels spell the same name | yes, held out | no |
| `albane` | 3 | worked examples from Albane et al. 2025 (Kabyle convention) | yes | no (convention rejected) |

No expected value anywhere in the test suite or the evaluation was generated
by the converter. The `toponyms` labels are *official Arabic spellings* of
names (أكادير, وجدة, الحسيمة): they follow Arabic-orthography conventions
(hamza on initial alef, ك for g, ة for final a, frequent vowel omission,
article ال), not the IRCAM convention for writing Amazigh in Arabic script.
They measure how far the output is from lexicalized Arabic usage; low scores
there are expected for any IRCAM-based system.

**Consequence:** held-out accuracy on Moroccan Arabic-script Amazigh is
*unmeasured*. A realistic accuracy target cannot be set until such a set
exists; `benchmarks/scripts/make-validation-sheet.mjs` produces review sheets
for linguists to build one (see §6).

## 2. Systems

* **baseline: naive Table I (1:1)** — every code point → its IRCAM Table I
  letter, ⵯ → ‘, schwa dropped; no context (`benchmarks/baselines.mjs`).
* **baseline: dictionary-style 1:1 map** — the character map that generated
  all 178,057 entries of `mustapharajaa/tamazight-Transliterating-en-ar`
  (ⴻ → ى, ⵯ → ڤ, ⵥ → ظ …), re-implemented from the analysis in
  [research.md](research.md); no data copied.
* **ours** — the three profiles.
* **ablations** of `readable`: without positional rules (initial vowels as
  ا/اي/او, plain hiatus), without the gemination rule (doubled letters), and
  without both.

Not compared: Albane et al.'s Java system (no published code; their 95.46 %
mixes sentence correctness with diacritic coverage and is not a word
accuracy), IRCAM's online transliterator (unreachable during this work),
upstream `tifinagh-convert` (no Arabic output).

## 3. Metrics

* **exact** — output string equals the reference (strict; this is the
  headline metric).
* **exact or listed alternative** — the reference is the output or one of the
  documented alternatives the converter lists (§7 of linguistic-rules.md).
  This separates *legitimate alternative spellings* from errors.
* **exact ignoring diacritics** — after removing harakat/shadda/U+065B only
  (both sides). Reported separately, never merged into the headline.
* **CER** — character (code point) edit distance / reference length.
* Mismatches are explained by applying cumulative normalizations in a fixed
  order (diacritics → letter choice for g/ẓ/ṛ → initial-vowel spelling →
  final ة/ى → vowel-letter omission → article/spacing); the first level at
  which the strings agree is the reported cause. Anything left is "other".

## 4. Results (2026-10-30, Node 22)

### `moroccan` (development set, n = 7)

| system | exact | exact or alternative | ignoring diacritics | CER |
|---|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 5/7 (71.4 %) | 71.4 % | 71.4 % | 0.108 |
| baseline: dictionary-style 1:1 map | 5/7 (71.4 %) | 71.4 % | 71.4 % | 0.081 |
| **ours: readable (default)** | **7/7 (100 %)** | 100 % | 100 % | 0.000 |
| ours: ircam | 5/7 (71.4 %) | 85.7 % | 85.7 % | 0.054 |
| ours: phonetic | 6/7 (85.7 %) | 100 % | 100 % | 0.027 |
| ablation: readable − positional rules | 5/7 (71.4 %) | 71.4 % | 71.4 % | 0.108 |
| ablation: readable − gemination rule | 6/7 (85.7 %) | 85.7 % | 85.7 % | 0.027 |
| ablation: readable − all context | 5/7 (71.4 %) | 71.4 % | 71.4 % | 0.135 |

The two baselines fail on the word-initial vowels (ئفاسن/يفاسن, ؤكسوم/وكسوم)
and on gemination. With n = 7 and rules partly chosen on this set, this shows
consistency with the available Moroccan evidence, **not** generalization.
`ircam` and `phonetic` differ from the references only by their extra marks
(doubled letters, U+065B on semivowels) — by design.

### `toponyms` (held out, different convention, n = 192)

| system | exact | exact or alternative | ignoring diacritics | CER |
|---|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 34/192 (17.7 %) | 17.7 % | 17.7 % | 0.214 |
| baseline: dictionary-style 1:1 map | 39/192 (20.3 %) | 20.3 % | 20.3 % | 0.196 |
| **ours: readable (default)** | 39/192 (20.3 %) | **33.9 %** | 26.6 % | 0.204 |
| ours: ircam | 29/192 (15.1 %) | 28.6 % | 18.8 % | 0.265 |
| ours: phonetic | 29/192 (15.1 %) | 28.6 % | 23.4 % | 0.265 |
| ablation: readable − positional rules | 40/192 (20.8 %) | 33.9 % | 27.1 % | 0.207 |
| ablation: readable − gemination rule | 39/192 (20.3 %) | 33.9 % | 20.3 % | 0.203 |
| ablation: readable − all context | 40/192 (20.8 %) | 33.9 % | 20.8 % | 0.207 |

Causes of the 153 `readable` mismatches:

| cause | count |
|---|---:|
| word-initial vowel spelling (official أ/إ/آ vs IRCAM ا/ئ/ؤ) | 54 |
| vowel letters omitted in the official spelling (تزنيت for *tiznit*) | 40 |
| other: Arabic article ال, Arabic-origin names (أولاد, أحمد), label inconsistencies | 30 |
| shadda (official names omit it) | 12 |
| final -a written ة in the official name (وجدة) | 12 |
| letter choice (ك for ⴳ, ز for ⵥ) | 5 |

A manual review of all 30 "other" cases found no converter error: they are
Arabic lexicalizations (الحسيمة for ⵍⵃⵓⵙⵉⵎⴰ, أولاد for ⵡⵍⴰⴷ, بئر for ⴱⵉⵔ) or
inconsistent Wikidata labels (ⵜⵉⵎⵓⵎⵉⵍⵜ vs تيموليلت, ⵎⵥⵉⵥⵍ vs أمزيزل).
The listed alternatives (hamza-alef initial vowels, ك, no shadda) recover
33.9 % vs 20.3 % for the baselines. Removing positional rules gains exactly
one exact match: ⵓⵏⴰⵖⴰ, officially اوناغا, where `readable` writes ؤناغا
(IRCAM Table II) and the ablation writes او. This illustrates that the IRCAM
convention and official Arabic spelling pull in different directions.

### `albane` (Kabyle convention, n = 3)

0/3 for every system, as expected: ⴳ → ڨ, R1 drops full vowels (فحل for
*fiḥel*), ⵝ → ث. `readable` has the lowest CER (0.385).

## 5. Coverage, robustness, speed

| Measure | Result |
|---|---|
| IRCAM units with an explicit, tested mapping | 33 / 33 (31 letters + ⴳⵯ ⴽⵯ), in all 3 profiles |
| IRCAM DGLAI lexicon (local copy, 18,846 words, 104,100 Tifinagh chars) | 0 unsupported characters, 0 words with warnings |
| Input preservation (2,000 synthetic mixed-script documents) | 0 failures |
| Property tests (9 invariants) | pass at 400 runs each in CI; also run once at 20,000 runs locally |
| Unit / integration tests | 287 passing |
| Throughput, library, `readable`, 20 MiB synthetic text | 7.1 MiB/s, ≈ 333,000 words/s (`ircam` 7.2, `phonetic` 5.4 MiB/s) |
| Latency, single word | p50 1.6 µs, p99 6.9 µs |
| CLI streaming, same 20 MiB file | 3.2 MiB/s (6.3 s incl. process start) |
| Scaling | 12× input → < 40× time asserted in tests (linear in practice) |

Hardware: 4-core Intel Xeon @ 2.10 GHz (cloud VM), Node 22.22. The
benchmark process RSS (≈ 720 MiB) is dominated by the 20 MiB test string and
three full outputs held at once, not by the library.

## 6. What remains unverified

* Held-out accuracy on Moroccan Arabic-script Amazigh (no data).
* The `phonetic` schwa-as-kasra and the U+065B / ڔ renderings of IRCAM's
  non-Unicode marks (project decisions).
* Behaviour on regional varieties beyond the lexicon's standard spelling
  (Tarifit spirantization, Central Atlas forms) — the converter writes what
  the Tifinagh says; whether readers of each variety prefer other Arabic
  spellings is unknown.

To build a held-out set: `node benchmarks/scripts/make-validation-sheet.mjs
words.txt --sample 300 > sheet.csv`, have native-speaker linguists fill
`reviewer_spelling` and `verdict`, then add the result as a new file in
`data/gold/` with the reviewers as source and run the evaluation.
