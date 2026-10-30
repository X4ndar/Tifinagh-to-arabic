# Research notes

What was inspected, what was found, and what was decided. Dates refer to
access in October 2026.

## 1. Sources inspected

| # | Source | Access | Used for |
|---|---|---|---|
| A | `hamza-bouqssim/tifinagh-convert` @ `1f0f31ad6910b47ce93c28c251f03956a2dd0579` (MIT) | cloned; 25/25 tests pass | code base (Latin ↔ Tifinagh, detection, types) |
| B | IRCAM, *Amazigh Language Desktop Converter* (SITACAM 2013), `tal.ircam.ma/talam/Articles/SITACAM13.pdf` | IRCAM server failed TLS verification / HTTP 503; retrieved the Internet Archive copy of 2022-01-08 | Tables I and II, inventory, orthographic rules |
| B′ | IRCAM transliterator page and converter documentation page | unreachable (TLS failure / 503) | — (documented gap) |
| C | Albane, Slimani, Kheddouci (2025), *An approach for transliterating Tifinagh Berber texts into Latin and Arabic alphabets* | PDF downloaded; text layer + page images read | rules R1/R2, Figure 2 table, examples |
| D | `mustapharajaa/tamazight-Transliterating-en-ar` @ `a1fb902` | cloned and analysed | audit only (not reused) |
| E | `Tamazight-NLP/ircam-dglai` (Hugging Face) | downloaded locally | character statistics only (not shipped) |
| F | Wikidata (lexemes and item labels) | SPARQL + entity API | independent reference spellings (CC0) |

## 2. IRCAM Tables I and II (source B)

The PDF text layer is **not reliable** for these tables: several Arabic cells
are drawn with special fonts and have no code point, and some marks are
encoded with non-Arabic characters. Every cell was therefore checked on the
page image rendered at 600 dpi, then compared with the text layer
(`pdftotext -raw`). Both readings are recorded in
`src/alphabet/arabic.ts` (`ircamTable1`, `ircamTable1TextLayer`).

### Table I — Tifinaghe-IRCAM alphabet (Arabic column)

| Tifinagh | Latin | Arabic (visual) | Text layer | Remark |
|---|---|---|---|---|
| ⴰ U+2D30 | a | ا | U+0627 | |
| ⴱ U+2D31 | b | ب | U+0628 | |
| ⴳ U+2D33 | g | گ (gaf) | *none* | glyph only |
| ⴳⵯ | gʷ | گ‘ | U+2018 only | quote mark marks labialization |
| ⴷ U+2D37 | d | د | U+062F | |
| ⴹ U+2D39 | ḍ | ض | U+0636 | |
| ⴻ U+2D3B | e | **(empty)** | — | schwa has no Arabic letter |
| ⴼ U+2D3C | f | ف | U+0641 | |
| ⴽ U+2D3D | k | ک (keheh shape) | *none* | glyph only |
| ⴽⵯ | kʷ | ک‘ | U+2018 only | |
| ⵀ U+2D40 | h | ه | U+06BE (heh doachashmee) | visible glyph is ordinary heh |
| ⵃ U+2D43 | ḥ | ح | U+062D | |
| ⵄ U+2D44 | ɛ | ع | U+0639 | |
| ⵅ U+2D45 | x | خ | U+062E | |
| ⵇ U+2D47 | q | ق | U+0642 | |
| ⵉ U+2D49 | i | ي | U+064A | |
| ⵊ U+2D4A | j | ج | U+062C | |
| ⵍ U+2D4D | l | ل | U+0644 | |
| ⵎ U+2D4E | m | م | U+0645 | |
| ⵏ U+2D4F | n | ن | U+0646 | |
| ⵓ U+2D53 | u | و | U+0648 | |
| ⵔ U+2D54 | r | ر | U+0631 | |
| ⵕ U+2D55 | ṛ | ر with three dots below | U+0631 + U+05B6 (Hebrew segol) on U+25CC | no Arabic code point exists |
| ⵖ U+2D56 | ɣ | غ | U+063A | |
| ⵙ U+2D59 | s | س | U+0633 | |
| ⵚ U+2D5A | ṣ | ص | U+0635 | |
| ⵛ U+2D5B | c | ش | U+0634 | |
| ⵜ U+2D5C | t | ت | U+062A | |
| ⵟ U+2D5F | ṭ | ط | U+0637 | |
| ⵡ U+2D61 | w | و with "^" | *none* | semivowel mark |
| ⵢ U+2D62 | y | ي with "^" | U+064A + U+0302 (Latin combining circumflex) | semivowel mark |
| ⵣ U+2D63 | z | ز | U+0632 | |
| ⵥ U+2D65 | ẓ | ژ (U+0698) | *none* | glyph only |

### Table II — "Proposed Arabic correspondance" (inspired by M. Chafik)

| Tifinagh | New Arabic | Text layer |
|---|---|---|
| ⴳ | ڭ | U+06AD |
| ⴳⵯ | ڭُ | U+06AD + U+064F |
| ⴽⵯ | كُ | U+0643 + U+064F |
| ⵉ | ئـ *(in the beginning)* | U+0640 (+ garbled glyph) |
| ⵓ | ؤ *(in the beginning)* | U+0624 |
| ⵢ | ي *(in the beginning)* | U+064A |

The paper explains: damma replaces the quote mark "to ensure the Arabic
writing cursivity", and ڭ replaces گ "to help the reader to correctly
pronounce the letter ⴳ".

### Inventory (Section II.B)

33 letters: 27 consonants including ⴳⵯ ⴽⵯ, 2 semi-consonants (ⵢ ⵡ), 4 vowels
(ⴰ ⵉ ⵓ and the neutral vowel ⴻ). Encoded at U+2D30…U+2D65 plus U+2D6F. This
matches the 31 code points + 2 labialized units in `src/alphabet/inventory.ts`
(checked by `tests/alphabet.test.ts`).

### Orthographic rules (Section III.B.2) — direction matters

The paper lists rules "mainly on the transliteration from Arabic script into
Tifinaghe":

1. if a word contains an emphatic letter (ⴹ ⵕ ⵚ ⵟ ⵥ), Arabic ر becomes ⵕ;
2. ي after a vowel → ⵢ, otherwise ⵉ;
3. و after ا → ⵡ; after ي, or between consonants → ⵓ;
4. a letter with shadda → the Tifinagh letter doubled.

These are **Arabic → Tifinagh** heuristics and are not inverted
mechanically. What they *do* establish about Arabic-script Amazigh: ي and و
serve both vowels and semivowels (so a plain-letter spelling is the expected
reading convention), and **shadda is the Arabic-script mark of gemination**.
Rule 1 shows that IRCAM expected Arabic text to write ṛ as plain ر.

## 3. Albane et al. (2025) (source C)

* Figure 2 merges Berber Academy, HCA (Algeria) and IRCAM alphabets: ⴳ → ڨ,
  ⴽ → ک, ⵕ → ر, ⵥ → ژ, ⴻ → "(Empty) ◌ / ا", ⵉ → إ/ي, ⵓ → أ/و; plus Kabyle
  letters ⵝ → ث, ⴸ → ذ, ⵞ → ڜ (تش), ⵒ → پ, ⴵ → ج, ⴲ → ب.
* **R1**: a vowel after a single consonant becomes a short-vowel diacritic
  (fatha/damma/kasra) on that consonant, schwa between consonants a sukun —
  so `ⴼⵉⵃⴻⵍ` → فحل. This contradicts every Moroccan example available (ازول,
  تامازيغت, افوس, ئفاسّن keep full vowels as letters), so **R1 is rejected**.
* **R2**: a vowel after two consonants is written as a letter; a geminate is
  one letter with shadda. **Adopted** (shadda) — consistent with IRCAM and
  Wikidata.
* Evaluation: "popular sentences and proverbs" (not published); a sentence
  correct except for diacritics scores 95 %, and diacritic coverage adds up to
  5 %. The 95.46 % figure is therefore *not* a word accuracy and is not
  comparable with our metrics. The Java code (Figure 1) is an image; no source
  is published, so the system cannot be run as a baseline.
* Worked examples (Figures 3–5) are kept in
  `data/gold/albane2025-examples.json` as a **different convention**.

## 4. `mustapharajaa/tamazight-Transliterating-en-ar` (source D)

* Files: `dictionary.csv`, `dictionary.txt` (the README also announces JSON/TSV files that do not exist).
* **178,075 rows** (the README says "over 17,000"); 178,057 unique; no
  Tifinagh word has two Arabic spellings (no internal conflicts).
* **Every entry is a strict 1:1 character substitution** (100 % equal length,
  each Tifinagh code point always mapped to the same Arabic character): it is
  the output of a naive converter, not independent spellings. Notable
  choices: ⴻ → ى (alef maqsura), ⵯ → ڤ, ⵥ → ظ, ⵕ → ر, no initial-vowel
  handling, gemination as doubled letters (اباببا). 317 entries carry
  punctuation inside the Tifinagh field.
* Contains transliterations, not translations (good), but no provenance.
* **No license file** → all rights reserved by default. **Not bundled.** Its
  1:1 map is described and re-implemented as a baseline.

## 5. IRCAM DGLAI scrape (source E)

* 18,491 entries (README says 18,420), fields include `tifinagh`, `latin`,
  `meaning_fr`, `meaning_ar`. `meaning_ar` is an Arabic **translation**
  (e.g. ⴰ → "حرف نداء") and is never used as transliteration ground truth.
* License CC-BY-NC-4.0 → not shipped; used locally for statistics:
  18,846 word tokens, 104,100 Tifinagh characters, all within the IRCAM set
  (0 unsupported). Schwa occurs in only 227 words, and in **all 227** it
  stands between two identical consonants (ⴰⵣⴻⵣ, ⴱⴽⴽⴻⴽ) — which motivated the
  *schwa-between-identical* rule. 266 words contain ⵯ (182 after ⴳ, 84 after ⴽ);
  6,279 contain a geminate; no vowel–vowel sequences occur.

## 6. Wikidata (source F)

* **Lexemes**: three Tachelhit lexemes carry Tifinagh, Latin and
  Arabic-script (`shi-x-Q1828555`, Q1828555 = "Arabic script")
  representations: ⴰⴼⵓⵙ → افوس, ⵉⴼⴰⵙⵙⵏ → ئفاسّن, ⵓⴽⵙⵓⵎ → ؤكسوم,
  ⴱⵔⴰⵢⵔ → براير. They independently confirm Table II (ئ/ؤ word-initially),
  shadda for gemination, and unmarked semivowels.
* **Toponyms**: 2,486 Moroccan items have both `zgh` and `ar` labels; 192
  spell the same name (equal coarse consonant skeletons). Their Arabic labels
  are official Arabic spellings (أ/إ/آ initially, ك for g, ة for final a,
  vowels often omitted) — a different convention, useful to measure distance
  from lexicalized Arabic usage.

## 7. Upstream audit (source A)

Reused: `MAPPING`, `detect`, `tifinaghToLatin`, `latinToTifinagh`, types,
tests (all still passing, two expectations changed on purpose).

Issues found (left as-is unless noted, to preserve upstream behaviour):

1. `convert('')` threw → **changed**: returns empty output.
2. `to: 'arabic'` threw "not yet supported" → **implemented**.
3. The `AMBIGUOUS_DIGRAPH` warning is unreachable: the alias table matches
   `gh`/`ch` first (tests even assert no warning).
4. Tifinagh → Latin emits `UNKNOWN_CHAR` for every non-Tifinagh character
   (spaces excepted), so mixed text produces many warnings.
5. An isolated ⵯ is dropped from Latin output (with a warning).
6. ⵛ is romanized `ch`, whereas IRCAM Table I uses `c`.
7. `region` is accepted but unused by both converters.
8. Unicode: only 32 IRCAM letters + ⴵ; no handling of U+2D7F (joiner),
   U+2D70 (separator), Tuareg/Kabyle letters, or combining marks.

## 8. Decisions

| Topic | Decision | Basis |
|---|---|---|
| Algorithm | direct Tifinagh → Arabic, units → rules → render; not via Latin | spec; IRCAM Table I is Tifinagh–Arabic |
| ⴳ | ڭ (all profiles); options گ ك ڨ | Table II |
| ⴽ | ك U+0643 | Table II (ⴽⵯ → كُ); keheh shape in Table I is a font glyph |
| ⵀ | ه U+0647 | visible glyph; U+06BE text-layer value as option |
| ⵥ | ژ | Table I |
| ⵕ | ر (readable); ڔ U+0694 (ircam, phonetic) | Table I mark has no Arabic code point; IRCAM rule 1 |
| ⵡ ⵢ | plain و ي (readable); + U+065B (ircam, phonetic) | Wikidata (براير); Table I "^" mark |
| labialization | damma | Table II |
| initial vowels | ا / ئ / ؤ; options اي او, إي أو أ | Table II; Wikidata |
| gemination | shadda (readable, phonetic); doubled letters (ircam) | Wikidata, IRCAM rule 4, Albane R2; Table I per-letter |
| schwa | omitted (ircam, readable); kasra (phonetic, heuristic) | Table I empty cell |
| final ⵜ | always ت (never ة) | Table I |
| non-IRCAM letters | Albane Figure 2 values + warning | source C |
| datasets D, E | not shipped | licenses |
