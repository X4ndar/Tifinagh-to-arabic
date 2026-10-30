# Limitations

Read this before relying on the output.

## Linguistic

1. **Reference data is limited and convention-dependent.** The largest
   independent reference (Tawalt dictionary, 27,921 words) cannot be shipped
   (no license) and follows its own editorial choices (أ, گ, irregular sukun).
   There is still no published, licensed, reviewed Moroccan gold standard;
   running text (sentences, inflected forms in context) is not covered by any
   reference set (see [evaluation.md](evaluation.md)).
2. **Arabic script loses distinctions.** In `readable`: ⵔ/ⵕ → ر, ⵓ/ⵡ → و,
   ⵉ/ⵢ → ي, and the schwa disappears. Use `phonetic` (or `ircam`) to keep
   them, at the cost of rarer characters.
3. **IRCAM's marks are not Unicode-encodable as printed.** Table I marks ṛ
   with a three-dots-below sign (Hebrew segol in the PDF text layer) and
   semivowels with "^" (Latin circumflex in the text layer). `ircam` and
   `phonetic` use ڔ (U+0694) and U+065B instead; `ircam-literal` options emit
   the exact PDF code points. Neither rendering is an IRCAM-published Unicode
   convention.
4. **Schwa as kasra (`phonetic`)** is a project proposal.
5. **Word-initial geminates** (ⵍⵍⵓⵖⵎ, ⵎⵎⵓⵎⵎⵉ) get a shadda on the first letter
   (لّوغم), as in Tawalt (يّزيمّر). Readers of Arabic may find it unusual;
   `gemination: 'double'` or `'single'` are alternatives.
6. **Labialization not written in the Tifinagh** cannot be recovered: Tawalt
   writes damma for labialized consonants that its Tifinagh spells plainly
   (ⵉⴳⴳⴰ → ئگُّا); the converter only marks what the input marks (ⵯ).
7. **Vowel hiatus** is written with plain letters (ئوسر), as Tawalt does;
   such sequences are rare (none in IRCAM's lexicon, 87 in Tawalt).
8. **Lexicalized spellings** (official place names: أكادير, وجدة, الحسيمة)
   are not reproduced by rules. Add them through a lexicon if you need them;
   none is shipped.
9. **Varieties.** The converter writes what the Tifinagh says, following
   IRCAM standard orthography. It does not model Tarifit, Central Atlas or
   Tachelhit pronunciation differences, nor Kabyle conventions (ⵝ ⴸ ⵞ are
   accepted with a warning).
10. **Not a translator.** Output is the same Amazigh words in another script.
   It does not check that the input is real Amazigh.
11. **Latin → Arabic** goes through upstream's Latin → Tifinagh converter,
    which guesses digraphs (`gh`, `ch`, `kh`); prefer Tifinagh input.
12. **Arabic → Tifinagh** is not implemented: Arabic script does not encode
    vowels/schwa/emphasis reliably.

## Technical

1. Positions are UTF-16 offsets (JavaScript string indices). Upstream
   Tifinagh → Latin warnings use code-point indices (kept for compatibility).
2. URL/e-mail protection works on whitespace-delimited chunks: a URL runs to
   the next whitespace, including trailing punctuation (harmless, since it is
   not Tifinagh).
3. Markdown protection covers inline code and ``` / ~~~ fences, not indented
   code blocks or HTML.
4. In streaming mode a Tifinagh word must not be split across chunks; the
   CLI splits at line breaks, which is always safe.
5. The Python package is a thin bridge to the Node.js CLI (Node ≥ 18 needed).
6. Sources B′ (IRCAM transliterator web page and documentation page) could not
   be reached; their behaviour was not compared.
