# Architecture

## Pipeline

```
input string
  │  segment()            src/tokenization/segment.ts
  │    protected spans (URLs, e-mails, Markdown code) · Tifinagh words · other text
  ▼
Tifinagh word
  │  tokenizeWord()       src/tokenization/units.ts
  │    normalization inside the word (format chars, ʷ → ⵯ)   src/normalization/normalize.ts
  │    longest match: letter (+ⵯ), unknown, orphan; then groupGeminates()
  ▼
units  (letter class, labialized, run length, original offsets)
  │  convertUnits()       src/rules/engine.ts
  │    letter stage: first matching rule by priority        src/rules/rules.ts
  │    base letters under profile options                   src/alphabet/arabic.ts
  │    modifier stage: schwa, labialization, gemination
  │    render with canonical mark order
  ▼
Arabic word ── optional lexicon override (verified entries)  src/lexicon/lexicon.ts
  ▼
output + diagnostics (+ alternatives, + trace)              src/core/arabic.ts
```

Arabic script → Tifinagh (`from: 'arabic'`) uses the same segmentation with
an Arabic word predicate:

```
input string
  │  segment(…, isArabicWordChar)   protected spans · Arabic words · other text
  ▼
Arabic word ── optional reverse lexicon lookup (marks ignored)
  │  units()        letters + marks; presentation forms → NFKC, hamza/madda → NFC;
  │                 tatweel and format characters removed
  │  per letter     REVERSE_RULES: letter table, ي/و reading (context or marks),
  │                 ر reading, ئي/ؤو merge, CⴻC between identical letters
  │  per mark       shadda doubles · damma on ك/گ → ⵯ · kasra → ⴻ (phonetic)
  ▼
Tifinagh word + diagnostics (+ trace)        src/reverse/arabicToTifinagh.ts
other text: ، ؛ ؟ → , ; ? and Arabic-Indic digits → 0–9 (options)
```

Every stage is a pure function and is tested on its own (`segment`,
`tokenizeWord`, `selectRule`, `convertUnits`). Non-Tifinagh segments are
copied verbatim, so the converter is safe on arbitrary text.

## Modules

| Path | Role |
|---|---|
| `src/alphabet/inventory.ts` | IRCAM letters (31 + ⵯ), extended letters, Unicode helpers |
| `src/alphabet/arabic.ts` | verified correspondence table (`CORRESPONDENCES`, with Table I, text layer, Table II, profile values, alternatives, provenance) and `baseArabic()` |
| `src/alphabet/sources.ts` | bibliography used by every mapping and rule |
| `src/profiles/profiles.ts` | the three profiles, option validation (`resolveOptions`) |
| `src/rules/rules.ts` | declarative rules (`LETTER_RULES`, `MODIFIER_RULES`) with ids, priorities, conditions, sources, status and executable examples |
| `src/rules/engine.ts` | applies the rules; memoizes rule selection per option set |
| `src/tokenization/segment.ts` | linear segmentation, URL/e-mail/code protection |
| `src/tokenization/units.ts` | word → units, gemination grouping, diagnostics |
| `src/normalization/normalize.ts` | format/combining character classes, canonical mark ordering, optional whole-text normalization |
| `src/lexicon/lexicon.ts` | validated, provenance-tagged overrides with conflict detection |
| `src/diagnostics/diagnostics.ts` | warning codes, severities, `TransliterationError` |
| `src/core/arabic.ts` | `ArabicConverter` (precompiled options, streaming `convertChunk`) |
| `src/reverse/arabicToTifinagh.ts` | Arabic script → Tifinagh: `ArabicToTifinaghConverter`, `REVERSE_RULES`, `REVERSE_PROFILES`, options |
| `src/cli/` | command-line interface |
| `src/server/` | dependency-free HTTP server: web page + JSON API, used by the Docker image ([deploy.md](deploy.md)) |
| `src/converters/`, `src/data/mapping.ts` | upstream Latin ↔ Tifinagh code (unchanged logic) |
| `python/amazigh_transliterate.py` | Python bridge over the CLI (`--jsonl`) |

## Rule format

```ts
{
  id: 'vowel.initial.hamza-seat.i',
  description: 'Word-initial ⵉ is written ئ …',
  priority: 100,
  when: { letters: ['ⵉ'], prev: ['boundary'], options: { initialVowels: 'hamza-seat' } },
  action: { type: 'emit', text: 'ئ' },        // or { type: 'base' }
  sources: ['IRCAM-T2', 'WIKIDATA-SHI'],
  status: 'documented',                       // | 'derived' | 'heuristic'
  examples: [{ profile: 'readable', input: 'ⵉⴼⴰⵙⵙⵏ', output: 'ئفاسّن' }],
}
```

Conflict resolution is deterministic: rules are sorted by priority, and a
test checks that for every (letter, context, option set) exactly one rule
of the winning priority matches. Conditions only use the letter, the class of
the previous letter in the word and profile options — no hidden state.

### Adding a rule

1. Add an entry to `LETTER_RULES` (or a modifier behaviour in
   `engine.ts` + an entry in `MODIFIER_RULES`) with sources and examples.
2. If it is option-dependent, add the option to `ArabicOptions`
   (`src/types/index.ts`) and `OPTION_VALUES` (`src/profiles/profiles.ts`).
3. Document it in `docs/linguistic-rules.md`; `npm test` runs its examples.

### Adding or changing a mapping

Edit the row in `CORRESPONDENCES` (keep `ircamTable1` as printed in the
source) and, if the profile value changes, `baseArabic()`. The alphabet tests
check every row in every profile.

## Profiles and options

A profile is a complete `ArabicOptions` object; any option can be
overridden per call (`arabic: { gemination: 'double' }`) or on the CLI
(`--option gemination=double`). Invalid names or values throw immediately.

| Option | Values (default in **readable**) |
|---|---|
| `g` | `ng` ڭ (ircam, phonetic) · **`gaf`** گ · `kaf` ك · `qaf3` ڨ |
| `k` | **`kaf`** ك · `keheh` ک |
| `emphaticR` | **`plain`** ر · `dot-below` ڔ · `ircam-literal` ر+U+05B6 |
| `emphaticZ` | **`jeh`** ژ · `zah` ظ · `zain` ز |
| `semivowelMark` | **`none`** · `arabic` (U+065B) · `ircam-literal` (U+0302) |
| `plainInitialY` | **`true`** · `false` |
| `labialization` | **`damma`** · `ircam-table1` (‘) · `omit` |
| `gemination` | **`shadda`** · `double` · `single` |
| `schwa` | **`omit`** · `kasra` · `fatha` |
| `initialVowels` | `hamza-seat` ا ئ ؤ (ircam, phonetic) · **`hamza-all`** أ ئ ؤ · `alef` ا اي او · `hamza-alef` أ إي أو |
| `hiatus` | **`plain`** · `hamza-seat` |
| `h` | **`heh`** ه · `heh-doachashmee` ھ |
| `punctuation` | **`preserve`** · `arabic` |
| `protectUrls`, `protectCode` | **`true`** · `false` |
| `reportSchwaOmission` | **`false`** · `true` |

Arabic → Tifinagh options (`reverse: {…}` in `convert()`, `options` in
`ArabicToTifinaghConverter`, `--option` with `--from arabic`):

| Option | readable | ircam | phonetic | Values |
|---|---|---|---|---|
| `semivowels` | `context` | `marked` | `marked` | `context` (IRCAM rules + Tawalt) · `marked` (only يٛ وٛ / sukun / shadda) |
| `emphaticR` | `word-rule` | `as-written` | `as-written` | `word-rule` (ر = ⵕ with ض ص ط ظ ژ) · `as-written` (ڔ = ⵕ) |
| `schwa` | `ignore` | `ignore` | `vowel-sign` | `vowel-sign` (kasra/fatha = ⴻ) · `ignore` |
| `doubledLetters` | `schwa` | `geminate` | `geminate` | `schwa` (دد = ⴷⴻⴷ) · `geminate` (دد = ⴷⴷ) |
| `labialization` | `damma` | `damma` | `damma` | `damma` (ُ on ك/گ = ⵯ) · `ignore` |
| `punctuation` | `latin` | `latin` | `latin` | `latin` (، ؛ ؟ → , ; ?) · `preserve` |
| `digits` | `western` | `western` | `western` | `western` (٠–٩ ۰–۹ → 0–9) · `preserve` |
| `protectUrls`, `protectCode` | `true` | `true` | `true` | `true` · `false` |

## Lexicon

Optional and empty by default. JSON format (array or `{ "entries": [...] }`):

```json
{ "tifinagh": "ⴰⴳⴰⴷⵉⵔ", "arabic": "أكادير", "status": "verified",
  "source": "who/what attests this spelling", "profiles": ["readable"], "note": "…" }
```

* exact match on the normalized word; only `verified` entries override unless
  `allowProvisional` is set; verified beats provisional;
* two different spellings for the same word/profile = conflict → rule output
  kept + `LEXICON_CONFLICT`; `lexicon.conflicts()` lists them;
* every override is reported (`LEXICON_OVERRIDE`) and the rule output is kept
  as the first alternative;
* the same entries work in reverse: `lookupArabic(word, profile)` matches the
  Arabic spelling with vowel signs, shadda and tatweel ignored
  (`arabicLexiconKey`), and overrides Arabic → Tifinagh;
* entries are schema-validated (Tifinagh letters only; one Arabic-script word;
  provenance required; unknown fields rejected); `maxEntries` bounds size, and
  the CLI refuses lexicon files over 64 MiB.

## Diagnostics

| Code | Severity | Meaning |
|---|---|---|
| `UNSUPPORTED_TIFINAGH` | warning | Tifinagh code point with no correspondence (kept) |
| `NONSTANDARD_LETTER` | warning | non-IRCAM letter converted via Albane 2025 |
| `ORPHAN_LABIALIZATION` | warning | ⵯ not after a consonant (kept) |
| `NONSTANDARD_LABIALIZATION` | warning | ⵯ after a consonant other than ⴳ/ⴽ |
| `COMBINING_MARK_ON_TIFINAGH` | warning | combining mark on a letter (kept) |
| `LONG_CONSONANT_RUN` | warning | ≥ 3 identical consonants |
| `LEXICON_CONFLICT` | warning | conflicting lexicon spellings |
| `EMPTY_WORD` | warning | a word with nothing written in Arabic (only ⴻ or formatting) — kept unchanged |
| `FORMAT_CHAR_REMOVED` | info | ZWJ/bidi mark/etc. removed inside a word |
| `MODIFIER_NORMALIZED` | info | ʷ read as ⵯ |
| `VOWEL_HIATUS` | info | vowel after vowel (spelled with plain letters by default) |
| `SCHWA_BETWEEN_IDENTICAL` | info | schwa omission merges CeC with CC (`double` only) |
| `SCHWA_OMITTED` | info | only with `reportSchwaOmission` |
| `LEXICON_OVERRIDE` | info | lexicon replaced the rule output |

Arabic → Tifinagh uses `APPROXIMATED_CHAR` (warning: ث ذ پ چ ڤ ة approximated,
ء dropped), `UNKNOWN_CHAR` (warning: letter or mark without a Tifinagh
counterpart, kept), `EMPTY_WORD`, `FORMAT_CHAR_REMOVED`, `LEXICON_*` and
`VOWEL_SIGN_IGNORED` (info: a short-vowel sign, tanwin or other sign the
profile does not read).

`strict: true` (CLI `--strict`) throws `TransliterationError` (exit code 3) on
any *warning*; *info* never fails. Positions are UTF-16 offsets into the
original input, and `input.slice(position, position + length) === source`
always holds (property-tested).

## Performance and safety

* Linear time: one pass for segmentation (URL detection scans
  whitespace-delimited chunks; inline-code matching indexes backtick runs by
  length), one pass per word. No regular expression is run on unbounded input
  with backtracking potential.
* Rule selection and base letters are memoized per option set.
* No recursion, no network access, no runtime dependencies.
* The CLI streams line by line with 64 KiB output batching; `--max-bytes`
  bounds input size; `--json` (whole-document mode) defaults to a 256 MiB cap.

## Compatibility with upstream `tifinagh-convert`

* `convert`, `detect`, `alphabet`, all upstream types and warning codes are
  kept; Tifinagh ↔ Latin output is unchanged.
* **Changed**: `convert('')` returns `{ output: '' … }` instead of throwing;
  non-string input throws `TypeError`.
* **Changed**: `to: 'arabic'` is implemented (it threw before). With no
  `from`, any Tifinagh in the input selects `from: 'tifinagh'`.
* **New**: `from: 'latin', to: 'arabic'` (Latin → Tifinagh → Arabic; Latin
  input is ambiguous, prefer Tifinagh input).
* **Changed**: `from: 'arabic'` is implemented (it threw before):
  `to: 'tifinagh'`, or `to: 'latin'` via Tifinagh. With no `from` and
  `to: 'tifinagh' | 'latin'`, Arabic letters and no Tifinagh select
  `from: 'arabic'`. `ConvertOptions` gains `reverse`; `LexiconLike` gains an
  optional `lookupArabic`.
* `ConvertOptions`/`ConvertResult`/`ConversionWarning` gain optional fields
  only.
* Package renamed `amazigh-transliterate` (fork); version 0.2.0.
* Within this version, `readable` changed its defaults to the Tawalt
  dictionary's conventions (`initialVowels: 'hamza-all'`, `g: 'gaf'`):
  ⴰⵣⵓⵍ → أزول (was ازول), ⴳ → گ (was ڭ). Pass
  `{ initialVowels: 'hamza-seat', g: 'ng' }` for the previous output.
