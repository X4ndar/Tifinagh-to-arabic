# amazigh-transliterate

**Tifinagh → Arabic-script transliteration for Moroccan Amazigh (Tamazight)**,
plus the Tifinagh ↔ Latin conversion of the upstream
[`tifinagh-convert`](https://github.com/hamza-bouqssim/tifinagh-convert).

```
ⵜⴰⵎⴰⵣⵉⵖⵜ  →  تامازيغت        ⵉⴼⴰⵙⵙⵏ  →  ئفاسّن        ⴰⴳⴳⵯⴰ  →  اڭُّا
```

> **Transliteration, not translation.** The output is the *same Amazigh
> words* written in Arabic letters. ⴰⵎⵖⴰⵔ becomes امغار (*amɣar*), not the
> Arabic word for "chief".

* Rule-based, deterministic, offline, zero runtime dependencies, TypeScript.
* Mappings verified against IRCAM's published correspondence tables, each
  with its source; context rules (initial vowels, gemination, labialization,
  schwa) are data-driven and auditable.
* Three profiles: `readable` (default), `ircam` (reference), `phonetic`.
* Safe on real text: other scripts, numbers, emoji, URLs, e-mails and
  Markdown code are left untouched; unknown characters are never dropped.
* Diagnostics, alternative spellings and a rule trace on request.
* CLI with streaming and JSON-lines batch mode; Python bridge.

## Contents

[Scope](#scope) · [Install](#install) · [JavaScript / TypeScript](#javascript--typescript) ·
[CLI](#cli) · [Python](#python) · [Profiles](#profiles) · [Examples](#examples) ·
[Accuracy](#accuracy-and-evidence) · [Limitations](#limitations) ·
[Extending](#extending) · [Sources and licensing](#sources-and-licensing)

## Scope

* **Input:** Unicode Tifinagh in IRCAM standard orthography (Standard
  Moroccan Tamazight; usable for Tachelhit, Central Atlas Tamazight and
  Tarifit texts written in that orthography). All 33 IRCAM units are
  supported; six Algerian/Kabyle letters are accepted with a warning.
* **Conventions:** IRCAM Table I as amended by Table II (Ataa Allah et al.,
  IRCAM 2013), confirmed where possible by independent Arabic-script
  Tachelhit data (Wikidata). Details: [docs/linguistic-rules.md](docs/linguistic-rules.md).

## Install

Requires Node.js ≥ 18.

```bash
git clone https://github.com/x4ndar/tifinagh-to-arabic.git
cd tifinagh-to-arabic
npm install        # also builds dist/ (prepare script)
npm test           # 287 tests
```

Or as a dependency straight from GitHub: `npm install github:x4ndar/tifinagh-to-arabic`.

## JavaScript / TypeScript

```ts
import { toArabic, convert, transliterate, createConverter } from 'amazigh-transliterate'

toArabic('ⴰⵣⵓⵍ')                                   // 'ازول'

convert('ⵜⴰⵎⴰⵣⵉⵖⵜ', { from: 'tifinagh', to: 'arabic', profile: 'readable' }).output
// 'تامازيغت'

toArabic('ⴰⵣⵓⵍ, bonjour! 2026 ⵜⴰⵎⴰⵣⵉⵖⵜ')            // 'ازول, bonjour! 2026 تامازيغت'

const r = transliterate('ⵉⴳⵔ ⵯ', { alternatives: true, trace: true })
r.output                     // 'ئڭر ⵯ'
r.warnings[0].code           // 'ORPHAN_LABIALIZATION' (the stray ⵯ is kept, not dropped)
r.alternatives[0].alternatives.map(a => a.output)
// ['ايڭر', 'إيڭر', 'ئكر', 'ئگر']
r.trace[0]                   // { source: 'ⵉ', output: 'ئ', rules: ['vowel.initial.hamza-seat.i'], position: 0 }

// one option on top of a profile
toArabic('ⴰⵔⴳⴰⵣ ⵉⵎⵉ', { arabic: { initialVowels: 'hamza-alef', g: 'kaf' } })  // 'أركاز إيمي'

// reusable converter for batches (options validated once)
const c = createConverter({ profile: 'ircam' })
c.convert('ⵉⴼⴰⵙⵙⵏ').output   // 'ئفاسسن'
```

Other exports: `detect`, `alphabet` (upstream), `Lexicon`,
`TransliterationError`, `PROFILES`, `CORRESPONDENCES`, `LETTER_RULES`,
`MODIFIER_RULES`, `SOURCES`, `IRCAM_LETTERS`, `normalizeText`, `segment`,
`tokenizeWord`. `strict: true` throws on unsupported or malformed Tifinagh.

## CLI

```bash
amazigh-transliterate --from tifinagh --to arabic --profile readable --text "ⴰⵣⵓⵍ"
amazigh-transliterate book.txt -o book.ar.txt            # streams; keeps every line break
cat corpus.txt | amazigh-transliterate --profile ircam > out.txt
amazigh-transliterate --json --alternatives < word.txt   # one JSON document
amazigh-transliterate --jsonl < records.jsonl            # {"id":…,"text":…} per line → {"id","output","warnings"}
amazigh-transliterate --strict --diagnostics corpus.txt  # exit 3 on unsupported input, warnings on stderr
amazigh-transliterate --option gemination=double --option g=gaf --text "ⴰⴳⴳⴰ"
amazigh-transliterate --to latin --text "ⵜⴰⵎⵓⵔⵜ"         # upstream Tifinagh → Latin
```

Run `amazigh-transliterate --help` for all options (inside the repository:
`node dist/cli/bin.js …`). Exit codes: 0 ok, 1 usage, 2 I/O, 3 strict failure.

## Python

The TypeScript engine stays authoritative; Python talks to a persistent CLI
process, so results are identical. Copy or import
[`python/amazigh_transliterate.py`](python/amazigh_transliterate.py):

```python
from amazigh_transliterate import Transliterator, to_arabic

to_arabic("ⴰⵣⵓⵍ")                                  # 'ازول'

with Transliterator(profile="readable") as tr:     # one Node process, fast for ASR/OCR batches
    tr.convert_many(["ⵜⴰⵎⴰⵣⵉⵖⵜ", "ⴰⵎⵖⴰⵔ"])         # ['تامازيغت', 'امغار']
    tr.convert_detailed("ⵯ")["warnings"][0]["code"] # 'ORPHAN_LABIALIZATION'
```

The CLI is found via `AMAZIGH_TRANSLITERATE_CLI`, `node_modules/.bin`, the
repository's `dist/cli/bin.js`, or `PATH`. For files, `convert_file(src, dst)`
streams through the CLI. Example: [examples/python_batch.py](examples/python_batch.py).

## Profiles

| | `readable` (default) | `ircam` | `phonetic` |
|---|---|---|---|
| purpose | natural Arabic-script spelling | letter-by-letter IRCAM reference | keep as many contrasts as possible |
| ⴳ / ⴳⵯ ⴽⵯ | ڭ / ڭُ كُ | ڭ / ڭُ كُ | ڭ / ڭُ كُ |
| initial ⴰ ⵉ ⵓ | ا ئ ؤ | ا ئ ؤ | ا ئ ؤ |
| gemination | shadda ّ | doubled letters | shadda ّ |
| ⵡ ⵢ | و ي | وٛ يٛ (initial ⵢ: ي) | وٛ يٛ |
| ⵕ | ر | ڔ | ڔ |
| ⵥ | ژ | ژ | ژ |
| schwa ⴻ | not written | not written | kasra |
| ⵉⴼⴰⵙⵙⵏ | ئفاسّن | ئفاسسن | ئفاسّن |
| ⴰⵡⴰⵍ | اوال | اوٛال | اوٛال |
| ⵜⴰⵎⴻⵣⴳⵉⴷⴰ | تامزڭيدا | تامزڭيدا | تامِزڭيدا |

Every choice can be overridden individually (see
[docs/architecture.md](docs/architecture.md#profiles-and-options)).

## Examples

| Tifinagh | Latin | readable | Notes |
|---|---|---|---|
| ⴰⵣⵓⵍ | azul | ازول | |
| ⵜⴰⵎⴰⵣⵉⵖⵜ | tamaziɣt | تامازيغت | final ⵜ is ت, never ة |
| ⴰⵎⵖⴰⵔ | amɣar | امغار | |
| ⵉⴼⴰⵙⵙⵏ | ifassn | ئفاسّن | initial ⵉ → ئ; geminate → shadda |
| ⵓⴽⵙⵓⵎ | uksum | ؤكسوم | initial ⵓ → ؤ |
| ⴱⵔⴰⵢⵔ | brayr | براير | semivowel unmarked |
| ⴰⴳⴳⵯⴰ | aggʷa | اڭُّا | labialized geminate: damma + shadda |
| ⴰⵣⴻⵣ / ⴰⵣⵣ | azez / azz | ازز / ازّ | schwa not written, but it blocks the shadda |
| `ⴰⵣⵓⵍ https://ⵜⴰⵎⴰ.ma` | | `ازول https://ⵜⴰⵎⴰ.ma` | URL untouched |

A small offline demo page: `npm run build`, then open
[`demo/index.html`](demo/index.html) in a browser.

## Accuracy and evidence

Full report: [docs/evaluation.md](docs/evaluation.md). In short:

* **Coverage:** 33/33 IRCAM units mapped and tested in every profile; 0
  unsupported characters on IRCAM's 18,846-word DGLAI lexicon (checked
  locally; not shipped).
* **Moroccan Arabic-script references (n = 7):** `readable` 7/7 exact;
  naive 1:1 baselines 5/7. This set is tiny and was partly used to choose
  rules — it shows consistency, not generalization.
* **Official Arabic toponyms (n = 192, held out, different convention):**
  `readable` 20.3 % exact, 33.9 % counting its listed alternatives
  (baselines 17.7–20.3 %). Most differences are convention (أ/إ initial
  vowels, omitted vowels, ة, ال), analysed per cause in the report.
* **No held-out Moroccan gold standard exists yet**, so real-world accuracy
  is not established. A review-sheet generator is provided to build one.
* **Robustness:** 0 preservation failures on 2,000 mixed documents; property
  tests for preservation, determinism, Unicode validity, idempotent
  normalization and the unknown-character policy.
* **Speed:** ≈ 7 MiB/s (≈ 330,000 words/s) single-threaded; ~1.6 µs per word.

## Limitations

See [docs/limitations.md](docs/limitations.md). Most important: Arabic script
merges some Amazigh contrasts in `readable` (ⵔ/ⵕ, ⵓ/ⵡ, ⵉ/ⵢ, schwa);
IRCAM's ṛ and semivowel marks have no exact Unicode encoding; official
spellings of place names are lexicalized and need a lexicon; accuracy on
real Moroccan Arabic-script text still needs validation by linguists.

## Extending

* **Mappings:** `src/alphabet/arabic.ts` (`CORRESPONDENCES`, `baseArabic`).
* **Rules:** `src/rules/rules.ts` — each rule has an id, priority, declarative
  condition, sources, status and executable examples run by the tests.
* **Profiles / options:** `src/profiles/profiles.ts`.
* **Lexicon:** pass `new Lexicon([...])` or `--lexicon file.json`; entries
  need a `source` and `status: "verified"` to override rules
  (format: [examples/lexicon.example.json](examples/lexicon.example.json)).

Then run `npm run typecheck && npm run lint && npm test && npm run evaluate`.
Architecture: [docs/architecture.md](docs/architecture.md).
Research notes: [docs/research.md](docs/research.md).

## Sources and licensing

MIT — see [LICENSE](LICENSE). Forked from
[hamza-bouqssim/tifinagh-convert](https://github.com/hamza-bouqssim/tifinagh-convert)
(MIT, commit `1f0f31a`; original license in [LICENSE.upstream](LICENSE.upstream)).

Linguistic sources: IRCAM, *Amazigh Language Desktop Converter* (SITACAM 2013,
Tables I–II); Albane, Slimani & Kheddouci (2025); Wikidata (CC0). The
`mustapharajaa/tamazight-Transliterating-en-ar` dictionary (no license) and
the IRCAM DGLAI scrape (CC-BY-NC) were audited but **not** included. Full
attributions: [NOTICE.md](NOTICE.md).
