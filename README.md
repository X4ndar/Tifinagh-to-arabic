# amazigh-transliterate

**Tifinagh → Arabic-script transliteration for Moroccan Amazigh (Tamazight)**,
plus the Tifinagh ↔ Latin conversion of the upstream
[`tifinagh-convert`](https://github.com/hamza-bouqssim/tifinagh-convert).

```
ⵜⴰⵎⴰⵣⵉⵖⵜ  →  تامازيغت        ⵉⴼⴰⵙⵙⵏ  →  ئفاسّن        ⴰⴳⴳⵯⴰ  →  أگُّا
```

> **Transliteration, not translation.** The output is the *same Amazigh
> words* written in Arabic letters. ⴰⵎⵖⴰⵔ becomes أمغار (*amɣar*), not the
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
  IRCAM 2013), checked against independent Arabic-script Amazigh data
  (Wikidata lexemes; the 27,921-word Tawalt dictionary). Details:
  [docs/linguistic-rules.md](docs/linguistic-rules.md).

## Install

Requires Node.js ≥ 18.

```bash
git clone https://github.com/x4ndar/tifinagh-to-arabic.git
cd tifinagh-to-arabic
npm install        # also builds dist/ (prepare script)
npm test           # 352 tests
npm run test:heavy # randomized tests at 20,000 cases each
npm run test:e2e   # demo page in a real browser + accessibility scan (needs Playwright)
npm run test:pack  # installs the packed tarball and uses it like a consumer
```

Or as a dependency straight from GitHub: `npm install github:x4ndar/tifinagh-to-arabic`.

## JavaScript / TypeScript

```ts
import { toArabic, convert, transliterate, createConverter } from 'amazigh-transliterate'

toArabic('ⴰⵣⵓⵍ')                                   // 'أزول'

convert('ⵜⴰⵎⴰⵣⵉⵖⵜ', { from: 'tifinagh', to: 'arabic', profile: 'readable' }).output
// 'تامازيغت'

toArabic('ⴰⵣⵓⵍ, bonjour! 2026 ⵜⴰⵎⴰⵣⵉⵖⵜ')            // 'أزول, bonjour! 2026 تامازيغت'

const r = transliterate('ⵉⴳⵔ ⵯ', { alternatives: true, trace: true })
r.output                     // 'ئگر ⵯ'
r.warnings[0].code           // 'ORPHAN_LABIALIZATION' (the stray ⵯ is kept, not dropped)
r.alternatives[0].alternatives.map(a => a.output)
// ['ايگر', 'إيگر', 'ئكر', 'ئڭر']
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

to_arabic("ⴰⵣⵓⵍ")                                  # 'أزول'

with Transliterator(profile="readable") as tr:     # one Node process, fast for ASR/OCR batches
    tr.convert_many(["ⵜⴰⵎⴰⵣⵉⵖⵜ", "ⴰⵎⵖⴰⵔ"])         # ['تامازيغت', 'أمغار']
    tr.convert_detailed("ⵯ")["warnings"][0]["code"] # 'ORPHAN_LABIALIZATION'
```

The CLI is found via `AMAZIGH_TRANSLITERATE_CLI`, `node_modules/.bin`, the
repository's `dist/cli/bin.js`, or `PATH`. For files, `convert_file(src, dst)`
streams through the CLI. Example: [examples/python_batch.py](examples/python_batch.py).

## Profiles

| | `readable` (default) | `ircam` | `phonetic` |
|---|---|---|---|
| purpose | natural Arabic-script spelling (Tawalt dictionary conventions) | letter-by-letter IRCAM reference | keep as many contrasts as possible |
| ⴳ / ⴳⵯ ⴽⵯ | گ / گُ كُ | ڭ / ڭُ كُ | ڭ / ڭُ كُ |
| initial ⴰ ⵉ ⵓ | أ ئ ؤ | ا ئ ؤ | ا ئ ؤ |
| gemination | shadda ّ | doubled letters | shadda ّ |
| ⵡ ⵢ | و ي | وٛ يٛ (initial ⵢ: ي) | وٛ يٛ |
| ⵕ | ر | ڔ | ڔ |
| ⵥ | ژ | ژ | ژ |
| schwa ⴻ | not written | not written | kasra |
| ⵉⴼⴰⵙⵙⵏ | ئفاسّن | ئفاسسن | ئفاسّن |
| ⴰⵡⴰⵍ | أوال | اوٛال | اوٛال |
| ⵜⴰⵎⴻⵣⴳⵉⴷⴰ | تامزگيدا | تامزڭيدا | تامِزڭيدا |

Every choice can be overridden individually (see
[docs/architecture.md](docs/architecture.md#profiles-and-options)). For IRCAM
Table II spelling in `readable` (bare ا word-initially, ڭ for ⴳ — e.g. ازول,
امغار), use `{ arabic: { initialVowels: 'hamza-seat', g: 'ng' } }` or
`--option initialVowels=hamza-seat --option g=ng`.

## Examples

| Tifinagh | Latin | readable | Notes |
|---|---|---|---|
| ⴰⵣⵓⵍ | azul | أزول | initial ⴰ → أ (ازول with IRCAM Table II options) |
| ⵜⴰⵎⴰⵣⵉⵖⵜ | tamaziɣt | تامازيغت | final ⵜ is ت, never ة |
| ⴰⵎⵖⴰⵔ | amɣar | أمغار | |
| ⵉⴼⴰⵙⵙⵏ | ifassn | ئفاسّن | initial ⵉ → ئ; geminate → shadda |
| ⵓⴽⵙⵓⵎ | uksum | ؤكسوم | initial ⵓ → ؤ |
| ⴱⵔⴰⵢⵔ | brayr | براير | semivowel unmarked |
| ⴰⴳⴳⵯⴰ | aggʷa | أگُّا | ⴳ → گ; labialized geminate: damma + shadda |
| ⴰⵣⴻⵣ / ⴰⵣⵣ | azez / azz | ازز / ازّ | schwa not written, but it blocks the shadda |
| `ⴰⵣⵓⵍ https://ⵜⴰⵎⴰ.ma` | | `أزول https://ⵜⴰⵎⴰ.ma` | URL untouched |

A small offline demo page: `npm run build`, then open
[`demo/index.html`](demo/index.html) in a browser.

## Accuracy and evidence

Full report: [docs/evaluation.md](docs/evaluation.md). In short:

* **Tawalt dictionary (27,921 independent Arabic-script Amazigh words; used
  locally, not shipped):** `readable` matches **88.2 % exactly and 99.6 %
  ignoring short-vowel signs**; the gap is Tawalt's irregular sukun/damma.
  The naive 1:1 baselines get 13.8–15.1 %; removing the context rules drops
  `readable` to 17.5 %. Caveat: `readable` adopted Tawalt's أ and گ after
  measuring on it, so this is not a blind test for those two choices (with
  IRCAM Table II's ا and ڭ instead: 46.4 %).
* **Specification + Wikidata examples (n = 7):** these use bare ا (ازول, افوس),
  so `readable` matches 4/7 exactly and 7/7 with its listed alternatives; with
  `initialVowels: 'hamza-seat'` it matches 7/7.
* **Official Arabic toponyms (n = 192, different convention):** 26.0 % exact,
  40.1 % with alternatives (baselines 17.7–20.3 %); differences are
  lexicalized Arabic spellings (أكادير, وجدة, الحسيمة), analysed per cause.
* **Coverage:** 33/33 IRCAM units mapped and tested in every profile; 0
  unsupported characters on IRCAM's 18,846-word lexicon; 3 (input typos) in
  897,778 words of TV subtitles.
* **Robustness:** 0 preservation failures on 2,000 mixed documents; property
  tests for preservation, determinism, Unicode validity, idempotent
  normalization and the unknown-character policy.
* **Speed:** ≈ 7 MiB/s (≈ 330,000 words/s) single-threaded; ~1.6 µs per word.
* **Not yet established:** a licensed, linguist-reviewed gold standard, and
  any reference for running text in context.

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
`mustapharajaa/tamazight-Transliterating-en-ar` dictionary (no license), the
Tawalt dictionary on Hugging Face (license unspecified), the IRCAM DGLAI scrape
(CC-BY-NC) and the TAWNZA subtitles (CC-BY-4.0) were used for audit or local
evaluation only and are **not** included. Full attributions:
[NOTICE.md](NOTICE.md).
