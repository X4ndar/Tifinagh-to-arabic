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
| `src/cli/` | command-line interface |
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
  input is ambiguous, prefer Tifinagh input); `from: 'arabic'` throws with an
  explanation.
* `ConvertOptions`/`ConvertResult`/`ConversionWarning` gain optional fields
  only.
* Package renamed `amazigh-transliterate` (fork); version 0.2.0.
* Within this version, `readable` changed its defaults to the Tawalt
  dictionary's conventions (`initialVowels: 'hamza-all'`, `g: 'gaf'`):
  ⴰⵣⵓⵍ → أزول (was ازول), ⴳ → گ (was ڭ). Pass
  `{ initialVowels: 'hamza-seat', g: 'ng' }` for the previous output.
