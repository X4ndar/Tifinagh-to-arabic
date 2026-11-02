# Linguistic rules

This page lists every transformation the engine performs, where it comes
from, and how sure we are about it. The machine-readable versions live in
`src/alphabet/arabic.ts` (correspondences), `src/rules/rules.ts` (rules, with
executable examples that the test suite checks) and `src/profiles/profiles.ts`
(profiles).

**Status labels**

* **documented** — stated in a cited source.
* **derived** — follows from a documented rule, but the source does not state it for this exact case.
* **heuristic** — a project proposal; needs validation by a linguist.

Sources: `IRCAM-T1`/`IRCAM-T2`/`IRCAM-RULES` = Tables I, II and §III.B.2 of
the IRCAM SITACAM 2013 paper; `WIKIDATA-SHI` = Wikidata Tachelhit lexemes;
`ALBANE-2025` = Albane et al. 2025; `TAWALT` = the Tawalt Amazigh–Arabic
dictionary (27,921 pairs, used for local evaluation). Details:
[research.md](research.md).

## 1. Units

A Tifinagh word is a maximal run of Tifinagh letters (U+2D30–U+2D6F), the
labialization mark ⵯ and internal formatting characters. Hyphens, spaces,
punctuation and other scripts end a word, so each part of `ⵢⴰⵏ-ⵓⵔⵜⵜⵓ` is a
word of its own.

Inside a word, tokenization is longest-match:

| Input | Unit | Note |
|---|---|---|
| consonant + ⵯ | one labialized consonant | IRCAM: only ⴳⵯ ⴽⵯ; others get `NONSTANDARD_LABIALIZATION` |
| C C (same letter) | one geminate unit | ⴳ + ⴳⵯ (IRCAM spelling of gʷgʷ) merges into a labialized geminate |
| C C C… | one geminate unit + `LONG_CONSONANT_RUN` | `double` style still writes every letter |
| vowel vowel | two units (hiatus) | vowels never geminate |
| C ⴻ C (same letter) | three units | the schwa blocks gemination (§5) |
| ⵯ not after a consonant | orphan, kept verbatim, `ORPHAN_LABIALIZATION` | |
| U+02B7 ʷ after a consonant | read as ⵯ, `MODIFIER_NORMALIZED` | |
| ZWJ, ZWNJ, ZWSP, soft hyphen, bidi marks, U+2D7F inside a word | removed, `FORMAT_CHAR_REMOVED` | outside words they are untouched |
| combining mark (e.g. U+0323) on a letter | kept after the Arabic letter, `COMBINING_MARK_ON_TIFINAGH` | |

## 2. Letters (base correspondences)

| Tifinagh | readable | ircam | phonetic | Status / source |
|---|---|---|---|---|
| ⴰ a | ا | ا | ا | documented T1 |
| ⴱ b | ب | ب | ب | documented T1 |
| ⴳ g | گ | ڭ | ڭ | readable: T1 + Tawalt (99 %); ircam/phonetic: T2 |
| ⴷ d | د | د | د | documented T1 |
| ⴹ ḍ | ض | ض | ض | documented T1 |
| ⴻ e | — | — | kasra on previous consonant | T1 cell empty; kasra heuristic |
| ⴼ f | ف | ف | ف | documented T1 |
| ⴽ k | ك | ك | ك | documented T2 (T1 glyph shape ک) |
| ⵀ h | ه | ه | ه | documented T1 |
| ⵃ ḥ | ح | ح | ح | documented T1 |
| ⵄ ɛ | ع | ع | ع | documented T1 |
| ⵅ x | خ | خ | خ | documented T1 |
| ⵇ q | ق | ق | ق | documented T1 |
| ⵉ i | ي | ي | ي | documented T1 |
| ⵊ j | ج | ج | ج | documented T1 |
| ⵍ l | ل | ل | ل | documented T1 |
| ⵎ m | م | م | م | documented T1 |
| ⵏ n | ن | ن | ن | documented T1 |
| ⵓ u | و | و | و | documented T1 |
| ⵔ r | ر | ر | ر | documented T1 |
| ⵕ ṛ | ر | ڔ | ڔ | T1 marks ṛ with a sign that has no Arabic code point; ڔ (U+0694) is our substitute (heuristic); plain ر follows IRCAM rule 1 |
| ⵖ ɣ | غ | غ | غ | documented T1 |
| ⵙ s | س | س | س | documented T1 |
| ⵚ ṣ | ص | ص | ص | documented T1 |
| ⵛ c | ش | ش | ش | documented T1 |
| ⵜ t | ت | ت | ت | documented T1 — never ة |
| ⵟ ṭ | ط | ط | ط | documented T1 |
| ⵡ w | و | وٛ | وٛ | T1 "^" mark; U+065B is its Arabic-block rendering (derived); plain و per Wikidata |
| ⵢ y | ي | يٛ | يٛ | idem |
| ⵣ z | ز | ز | ز | documented T1 |
| ⵥ ẓ | ژ | ژ | ژ | documented T1 |
| ⴳⵯ gʷ | گُ | ڭُ | ڭُ | documented T2 (damma); letter as for ⴳ |
| ⴽⵯ kʷ | كُ | كُ | كُ | documented T2 |

Non-IRCAM letters (always with `NONSTANDARD_LETTER`): ⴲ ب, ⴵ ج, ⴸ ذ, ⵒ پ,
ⵝ ث, ⵞ تش (Albane 2025, Figure 2). Every other Tifinagh code point is kept
unchanged with `UNSUPPORTED_TIFINAGH`.

## 3. Context rules (letter stage)

Rules are matched in priority order; for each (letter, previous letter class,
options) exactly one rule of the highest matching priority applies — a test
enumerates all combinations to guarantee this.

| Rule id | Context | Output | Status | Source | Example |
|---|---|---|---|---|---|
| `vowel.initial.hamza-all.*` | word start, **readable default** (`initialVowels: hamza-all`) | أ / ئ / ؤ | documented | Tawalt (أ 10,558 vs ا 12); ئ ؤ also T2 | ⴰⵣⵓⵍ → أزول, ⵉⴼⴰⵙⵙⵏ → ئفاسّن |
| `vowel.initial.hamza-seat.i` | ⵉ at word start (ircam, phonetic) | ئ (no extra ي) | documented | T2, Wikidata | ⵉⴼⴰⵙⵙⵏ → ئفاسّن |
| `vowel.initial.hamza-seat.u` | ⵓ at word start (ircam, phonetic) | ؤ | documented | T2, Wikidata | ⵓⴽⵙⵓⵎ → ؤكسوم |
| `vowel.initial.hamza-seat.a` | ⴰ at word start (ircam, phonetic) | ا (no hamza) | documented | T1, Wikidata, spec | ircam: ⴰⵣⵓⵍ → ازول |
| `vowel.initial.alef.*` | option `initialVowels: alef` | اي / او / ا | heuristic | — | ⵉⵎⵉ → ايمي |
| `vowel.initial.hamza-alef.*` | option `initialVowels: hamza-alef` | إي / أو / أ | documented | Albane 2025 | ⵉⵎⵉ → إيمي |
| (default) vowel after a vowel | ⵉ/ⵓ right after a vowel | plain ي / و (`letter.base`), `VOWEL_HIATUS` info | documented | Tawalt (87/87) | ⵉⵓⵙⵔ → ئوسر |
| `vowel.hiatus.hamza-seat.i/u` | option `hiatus: hamza-seat` | ئ / ؤ | heuristic | T2 logic; not attested | ⵜⴰⵉⵔⵉ → تائري |
| `semivowel.initial.plain-y` | ⵢ at word start, `plainInitialY` | ي (no mark) | documented | T2 | ircam: ⵢⴰⵏ → يان |
| `letter.base` | anything else | §2 | documented | T1/T2 | ⵜⴰⵎⴰⵣⵉⵖⵜ → تامازيغت |
| `schwa.letter` | ⴻ | nothing | documented | T1 | ⵜⴰⵎⴻⵣⴳⵉⴷⴰ → تامزگيدا |

**Initial ⴰ: أ or ا.** `readable` writes أ, as the Tawalt dictionary does in
10,558 of 10,570 words. The specification examples (ازول, امغار) and the
Wikidata lexeme افوس use bare ا, which `ircam`, `phonetic` and
`initialVowels: 'hamza-seat'` produce. Both are attested; neither is wrong.

Word-initial ⵉ → ئ follows the hamza-seat logic of the Chafik-inspired
Table II: the seat (ا / ي / و) shows the quality of the initial vowel, so
ئ alone already reads *i*. This is also what the Wikidata lexeme
ⵉⴼⴰⵙⵙⵏ → ئفاسّن shows.

## 4. Modifier stage

| Rule id | Effect | Profiles | Status | Source |
|---|---|---|---|---|
| `gemination.shadda` | geminate → one letter + ّ; a run of 3 → plain letter + letter with ّ | readable, phonetic | documented | Wikidata (ئفاسّن), IRCAM rule 4, Albane R2, Tawalt (99.7 %) |
| `gemination.double` | geminate → letter repeated (as many times as in Tifinagh) | ircam | derived | T1 is per letter |
| `gemination.single` | geminate → one letter, no mark (lossy) | option | heuristic | — |
| `labialization.damma` | ⵯ → ُ on the consonant | all | documented | T2 |
| `labialization.ircam-table1` | ⵯ → ‘ (U+2018) after the consonant | option | documented | T1 (breaks joining) |
| `labialization.omit` | ⵯ not written (lossy) | option | heuristic | — |
| `schwa.mark` | ⴻ → kasra (or fatha) on the previous consonant; alef carrier after a vowel or word-initially | phonetic | heuristic | — |
| `schwa.between-identical` | C ⴻ C keeps two separate letters, no shadda | all | documented | IRCAM writes ⴻ precisely to separate identical consonants (all 227 DGLAI schwa words); Tawalt spells them this way (ⵢⵓⵏⴻⵏ → يونن) |
| `mark.canonical-order` | marks are emitted in Unicode canonical order (damma 31 < kasra 32 < shadda 33 < U+065B 230) | all | documented | Unicode |
| `ta.final-no-marbuta` | ⵜ is ت everywhere | all | documented | T1 |

Under `gemination: double` (ircam), ⵣⴻⵣ and ⵣⵣ both become زز; the engine
reports `SCHWA_BETWEEN_IDENTICAL` because the distinction is lost there.

## 5. Schwa

IRCAM writes ⴻ rarely; in the DGLAI lexicon every written ⴻ stands between
two identical consonants (ⴰⵣⴻⵣ *azez*, ⴱⴽⴽⴻⴽ *bkkek*), where it tells the reader
that the two consonants are *not* a geminate. Table I gives it no Arabic
letter. Consequences:

* readable / ircam: the schwa is not written. Because gemination is decided on
  Tifinagh units *before* the schwa is dropped, ⴰⵣⴻⵣ → أزز while ⴰⵣⵣ → أزّ:
  the contrast survives through the shadda.
* phonetic: kasra on the preceding consonant (ازِز). Kasra is chosen as the
  closest short-vowel sign; fatha is available (`schwa: 'fatha'`). This is a
  proposal, not an attested convention.
* Writing the schwa as a full letter (ا, ى, ي) is never done: it would be read
  as a full vowel (the 1:1 dictionary's ى is an example of this error).

## 6. Mixed text

* Non-Tifinagh text is never modified (property-tested), and no bidi controls
  are added.
* URLs (`scheme://…`, `www.…`) and e-mail addresses (including
  internationalized local parts) are protected to the end of their
  whitespace-delimited chunk; Markdown inline code and fenced blocks are
  protected (fence state carries across streamed lines).
* Option `punctuation: 'arabic'` turns `,` `;` `?` into `،` `؛` `؟` only when
  they directly follow converted Tifinagh (so `Hello, world` and `3,5` are
  untouched).

## 7. Alternatives

`alternatives: true` lists, per word, the outputs of documented variants that
differ from the main output: initial vowels with alef (اي/او/ا) or hamza on
alef (إي/أو/أ); gemination doubled or unwritten; ⴳ as ك or گ; ⵥ as ز or ظ;
labialization unwritten; semivowels unmarked; ṛ as ر. These are legitimate
spellings found in sources or common practice, not guesses about
pronunciation.

## 8. Rules considered and rejected

| Proposal | Why rejected |
|---|---|
| Albane R1: full vowels → diacritics after one consonant | contradicts all Moroccan references (ازول, افوس, ئفاسّن) |
| Inverting IRCAM rule 1 (ر → ⵕ in emphatic words) for Tifinagh → Arabic | it is an Arabic → Tifinagh rule; used in that direction (§9) |
| ⴻ → ى / ي / ا | turns a non-phonemic schwa into a full vowel |
| final ⵜ → ة | imports Arabic morphology |
| Arabic article detection (ⵍ… → ال…) | would change the Amazigh word |
| ⵥ → ظ by default | not documented by IRCAM; offered as an alternative |
| hamza seats in hiatus (ئ / ؤ) by default | refuted by Tawalt (0 of 87 words); kept as option |

## 9. Arabic script → Tifinagh

The reverse direction (`from: 'arabic'`, `src/reverse/arabicToTifinagh.ts`)
reads Arabic-script Amazigh with the rules IRCAM gives for this direction
(SITACAM 2013, §III.B.2: ر in a word with an emphatic letter is ⵕ; ي after a
vowel is ⵢ, otherwise ⵉ; و after ا is ⵡ, after ي or between consonants ⵓ;
shadda doubles the letter) and with conventions measured on the Tawalt
dictionary (local evaluation only). The profile names the convention of the
**input**; each rule below is in `REVERSE_RULES` with executable examples.

| Rule id | Reading | Profiles | Status | Evidence |
|---|---|---|---|---|
| `rev.letter` | consonant letters: inverse of §2 (ك/ک → ⴽ; گ/ڭ/ڨ → ⴳ; ژ/ظ → ⵥ; ه/ھ → ⵀ; ڔ → ⵕ) | all | documented | T1, T2 |
| `rev.alef` | ا أ آ ٱ ى → ⴰ | all | documented | T1; Tawalt uses final ى for ⴰ |
| `rev.initial-hamza-seat` | ئ → ⵉ, ؤ → ⵓ, إ → ⵉ; word-initial ئي / إي / ؤو = one vowel, unless ا follows | all (merging: readable) | documented | T2; Tawalt (ؤوا = ⵓⵡⴰ 4/4; ئي + C = ⵉ 17 vs ⵉⵢ 13) |
| `rev.yeh.context` | ي → ⵢ at word start, after a vowel, or before ا; else ⵉ | readable | documented | IRCAM rule; Tawalt: before ا 95 % (370), after ا 100 % (505), between consonants ⵉ 93 % (6,356) |
| `rev.waw.context` | و → ⵡ at word start, before ا, or after ا / و / vowel ي (not after ئ); else ⵓ | readable | documented | IRCAM rule (after ا); Tawalt: before ا 100 % (505), after ا 100 % (758), between consonants ⵓ 96 % (8,201); ئو + C = ⵉⵓ |
| `rev.semivowel.marked` | ي / و with U+065B, U+0302, sukun or shadda → ⵢ / ⵡ | all | derived | T1 marks; Tawalt: sukun on ي/و is a semivowel in all 1,466 words |
| `rev.vowel.marked-mode` | unmarked ي / و → ⵉ / ⵓ; word-initial plain ي → ⵢ | ircam, phonetic | derived | T2 (initial ي) |
| `rev.r.emphatic-word` / `rev.r.plain-word` | ر → ⵕ in a word with ض ص ط ظ ژ, else ⵔ | readable | documented | IRCAM rule |
| `rev.r.as-written` | ر → ⵔ, ڔ (or ر + U+05B6) → ⵕ | ircam, phonetic | derived | T1 |
| `rev.shadda` | letter + ّ → doubled letter | all | documented | IRCAM rule |
| `rev.schwa.between-identical` | two adjacent copies of a consonant letter → CⴻC (not ي / و) | readable (`doubledLetters: 'schwa'`) | derived | geminates are written with shadda; Tawalt: 605 of 606 |
| `rev.damma.labialization` | damma on ك / گ → ⵯ; other dammas ignored (info) | all | documented | T2 |
| `rev.schwa` | kasra (or fatha) after a consonant → ⴻ; on ا → ⴻ alone | phonetic | heuristic | inverse of this library's `phonetic` |
| `rev.nonstandard` | ث ذ پ چ ڤ ة → ⵜ ⴷ ⴱ ⵛ ⴼ ⴰ, ء dropped — with `APPROXIMATED_CHAR` | all | heuristic | — |

Outside words: ، ؛ ؟ ٪ → , ; ? % and Arabic-Indic digits → 0–9 (IRCAM
recommends international punctuation and digits with Tifinagh; `punctuation`
and `digits` options keep them). Tatweel and formatting characters are
removed, presentation forms are folded (NFKC) and decomposed hamza / madda
recomposed (NFC). Other scripts, URLs, e-mails and code are untouched.

**What Tawalt does not tell us.** Its Tifinagh never writes ⵕ (0 of 27,921
words) or ⵯ, although its Arabic often has a damma on ك / گ. The ⵕ rule
and the damma → ⵯ reading therefore rest on IRCAM alone; the evaluation
reports scores with and without these letters.

**Exactness.** Arabic written by this library's `ircam` profile (words
without ⴻ) and `phonetic` profile reads back to the same Tifinagh, and
`readable` text reads back to Tifinagh with the same `readable` spelling —
property-tested on random words, excluding the documented ambiguities
(vowel sequences, ⵔⵕ, word-initial ⵉⵢ / ⵓⵡ; see limitations).

