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
| `moroccan` | 7 | 3 examples confirmed by the project specification + 4 Wikidata Tachelhit lexeme forms in Arabic script | yes | **yes** (initial ئ/ؤ, shadda) — a development set |
| `tawalt` | 27,921 | Tawalt Amazigh–Arabic dictionary, field `tifinagh_in_arabic`: every Tifinagh word with exactly one Arabic-script spelling | **no** (license unspecified; get it from Hugging Face `abdelhaqueidali/Tawalt-Amazigh-Arabic-Dictionary`) | partly: found after the rules were written; it led to two changes (hiatus default, runs of 3), affecting 91 words (0.3 %) |
| `toponyms` | 192 | Wikidata items whose Tifinagh (zgh) and Arabic (ar) labels spell the same name | yes | no |
| `albane` | 3 | worked examples of Albane et al. 2025 (Kabyle convention) | yes | no (convention rejected) |

The sets follow **different orthographic conventions**:

* `tawalt` is Arabic-script Amazigh written by people (see research.md §9):
  أ ئ ؤ word-initially, گ for ⴳ, shadda, irregular sukun, damma for
  labialization that the Tifinagh does not mark.
* `toponyms` are *official Arabic* spellings of names (أكادير, وجدة,
  الحسيمة): hamza on alef, ك for g, ة for final a, vowel omission, article
  ال. Low scores there are expected for any IRCAM-based system.
* `moroccan` uses bare ا initially (ازول, افوس) and ئ / ؤ.

## 2. Systems

* **baseline: naive Table I (1:1)** — every code point → its IRCAM Table I
  letter, ⵯ → ‘, schwa dropped; no context (`benchmarks/baselines.mjs`).
* **baseline: dictionary-style 1:1 map** — the character map that generated
  all 178,057 entries of `mustapharajaa/tamazight-Transliterating-en-ar`
  (ⴻ → ى, ⵯ → ڤ, ⵥ → ظ …), re-implemented from the analysis in
  [research.md](research.md); no data copied.
* **ours** — the three profiles, plus `readable` with Tawalt's two
  conventions (`initialVowels: 'hamza-all'`, `g: 'gaf'`).
* **ablations** of `readable`: without positional rules (initial vowels as
  ا/اي/او), without the gemination rule (doubled letters), without both; and
  the earlier hiatus default (`hiatus: 'hamza-seat'`).

Not compared: Albane et al.'s Java system (no published code; its 95.46 %
mixes sentence correctness with diacritic coverage and is not a word
accuracy), IRCAM's online transliterator (unreachable), upstream
`tifinagh-convert` (no Arabic output).

## 3. Metrics

* **exact** — output equals the reference (headline metric).
* **exact or listed alternative** — the reference is the output or one of the
  alternatives the converter lists (each alternative changes *one* documented
  convention). Separates legitimate alternative spellings from errors.
* **ignoring vowel signs (shadda kept)** — fatha/damma/kasra/sukun/tanwin and
  U+065B removed on both sides; shadda kept (gemination still counts).
* **ignoring all marks** — shadda removed too.
* **CER** — code-point edit distance / reference length.
* Mismatch causes are found by applying cumulative normalizations in a fixed
  order (vowel signs → shadda → letter choice for g/ẓ/ṛ → initial-vowel
  spelling → final ة/ى → vowel-letter omission → article/spacing); the first
  level at which the strings agree is the reported cause.

## 4. Results (2026-10-30)

### `tawalt` (independent, n = 27,921 words)

| system | exact | exact or alternative | ignoring vowel signs | ignoring all marks | CER |
|---|---:|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 15.1 % | 15.1 % | 16.9 % | 16.9 % | 0.221 |
| baseline: dictionary-style 1:1 map | 13.8 % | 13.8 % | 15.4 % | 15.4 % | 0.240 |
| ours: readable (default) | 46.4 % | 83.2 % | 53.5 % | 53.5 % | 0.104 |
| ours: ircam | 23.1 % | 47.1 % | 29.9 % | 29.9 % | 0.195 |
| ours: phonetic | 36.7 % | 76.3 % | 53.5 % | 53.5 % | 0.138 |
| **ours: readable + Tawalt conventions** | **88.2 %** | 88.3 % | **99.6 %** | 99.6 % | **0.020** |
| ablation: readable − positional rules | 24.4 % | 79.4 % | 27.1 % | 27.1 % | 0.203 |
| ablation: readable − gemination rule | 26.1 % | 50.0 % | 29.9 % | 29.9 % | 0.172 |
| ablation: readable − all context | 15.2 % | 48.1 % | 16.9 % | 16.9 % | 0.271 |
| variant: hiatus = hamza-seat (earlier default) | 46.2 % | 83.0 % | 53.2 % | 53.2 % | 0.105 |

Reading the table:

* With the two conventions aligned, letters, initial vowels, gemination and
  schwa agree on **99.6 %** of words; the remaining exact-match gap (11.4
  points) is Tawalt's sukun and damma (3,195 words), which no rule could
  predict from the Tifinagh.
* `readable` differs from Tawalt mainly by convention: initial أ vs ا (10,543
  words) and گ vs ڭ (2,349 words, "letter choice"). Listing alternatives
  recovers 83.2 %.
* Context rules matter: removing positional rules or the gemination rule
  roughly halves exact match; removing both brings `readable` down to the
  level of the naive baselines.
* Remaining true differences (the 0.4 %): 36 "other" (e.g. ⵢⵢⴰ → ييه,
  ⵎⵓⴽⴽⴰⵙⵏ → مؤكّاسن — lexical or inconsistent entries), 43 with vowel
  letters added/omitted, 12 with final ى/ه.

### `moroccan` (development set, n = 7)

| system | exact | exact or alternative | ignoring vowel signs | CER |
|---|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 5/7 | 71.4 % | 71.4 % | 0.108 |
| baseline: dictionary-style 1:1 map | 5/7 | 71.4 % | 71.4 % | 0.081 |
| **ours: readable (default)** | **7/7** | 100 % | 100 % | 0.000 |
| ours: ircam | 5/7 | 85.7 % | 85.7 % | 0.054 |
| ours: phonetic | 6/7 | 100 % | 100 % | 0.027 |
| ours: readable + Tawalt conventions | 4/7 | 100 % | 57.1 % | 0.081 |

The specification's ازول / امغار and Wikidata's افوس use bare ا, which is
why `readable` keeps ا although Tawalt writes أ. Small and partly used for
rule choice: consistency evidence only.

### `toponyms` (held out, official Arabic convention, n = 192)

| system | exact | exact or alternative | ignoring all marks | CER |
|---|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 17.7 % | 17.7 % | 17.7 % | 0.214 |
| baseline: dictionary-style 1:1 map | 20.3 % | 20.3 % | 20.3 % | 0.196 |
| ours: readable (default) | 20.3 % | 33.9 % | 26.6 % | 0.204 |
| ours: readable + Tawalt conventions | 26.0 % | 40.1 % | 34.4 % | 0.181 |

Causes of the 153 `readable` mismatches: initial-vowel spelling 54, vowel
letters omitted in the official name 40, other 30, shadda 12, final ة 12,
letter choice 5. A manual review of the 30 "other" cases found no converter
error: they are Arabic lexicalizations (الحسيمة for ⵍⵃⵓⵙⵉⵎⴰ, أولاد for ⵡⵍⴰⴷ,
بئر for ⴱⵉⵔ) or inconsistent Wikidata labels (ⵜⵉⵎⵓⵎⵉⵍⵜ vs تيموليلت).

### `albane` (Kabyle convention, n = 3)

0/3 for every system, as expected (ⴳ → ڨ, full vowels dropped by rule R1,
ⵝ → ث). `readable` has the lowest CER (0.385).

## 5. Coverage, robustness, speed

| Measure | Result |
|---|---|
| IRCAM units with an explicit, tested mapping | 33 / 33 (31 letters + ⴳⵯ ⴽⵯ), in all 3 profiles |
| IRCAM DGLAI lexicon (local, 18,846 words, 104,100 Tifinagh chars) | 0 unsupported characters, 0 words with warnings |
| TAWNZA subtitles (local, CC-BY-4.0; 897,778 words, 3.5 M Tifinagh chars) | 3 unsupported code points (input typos), 76 diagnostics in total, 2.1 s |
| Input preservation (2,000 synthetic mixed-script documents) | 0 failures |
| Property tests (9 invariants) | pass at 400 runs each in CI; also run once at 20,000 runs |
| Unit / integration tests | 290 passing (CI: Node 18, 20, 22) |
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
