/**
 * Bibliographic sources referenced by mappings and rules.
 * Every mapping/rule in this library cites one or more of these keys.
 * See docs/research.md for the full audit of each source.
 */
export interface SourceRef {
  id: SourceId
  title: string
  url?: string
  note: string
}

export type SourceId =
  | 'IRCAM-T1'
  | 'IRCAM-T2'
  | 'IRCAM-RULES'
  | 'IRCAM-INVENTORY'
  | 'UNICODE'
  | 'WIKIDATA-SHI'
  | 'ALBANE-2025'
  | 'TAWALT'
  | 'PROJECT'

export const SOURCES: Record<SourceId, SourceRef> = {
  'IRCAM-T1': {
    id: 'IRCAM-T1',
    title:
      'Ataa Allah, Frain, Ait Ouguengay — "Amazigh Language Desktop Converter" (IRCAM, SITACAM 2013), Table I "Tifinaghe-IRCAM alphabet"',
    url: 'https://tal.ircam.ma/talam/Articles/SITACAM13.pdf',
    note:
      'Verified visually at 600 dpi from the PDF (archived copy, web.archive.org 2022-01-08) and cross-checked against the PDF text layer. ' +
      'Several Arabic cells are empty or font-specific glyphs in the text layer; see docs/research.md.',
  },
  'IRCAM-T2': {
    id: 'IRCAM-T2',
    title: 'Same paper, Table II "Proposed Arabic correspondance" (inspired by M. Chafik)',
    url: 'https://tal.ircam.ma/talam/Articles/SITACAM13.pdf',
    note:
      'Replaces gaf by ڭ (U+06AD) for ⴳ, the quote mark by damma for labialization, and gives word-initial forms for ⵉ (ئ), ⵓ (ؤ), ⵢ (ي).',
  },
  'IRCAM-RULES': {
    id: 'IRCAM-RULES',
    title: 'Same paper, orthographic rules for Arabic → Tifinagh (Section III.B.2)',
    url: 'https://tal.ircam.ma/talam/Articles/SITACAM13.pdf',
    note:
      'Stated for the Arabic → Tifinagh direction. Used here only as evidence of how Arabic-script Amazigh is written ' +
      '(e.g. shadda marks gemination; ي/و serve both vowels and semivowels), never inverted mechanically.',
  },
  'IRCAM-INVENTORY': {
    id: 'IRCAM-INVENTORY',
    title: 'Same paper, Section II.B: 33 letters (27 consonants incl. ⴳⵯ ⴽⵯ, 2 semi-consonants, 4 vowels incl. schwa)',
    url: 'https://tal.ircam.ma/talam/Articles/SITACAM13.pdf',
    note: 'IRCAM basic set encoded at U+2D30…U+2D65 plus U+2D6F.',
  },
  UNICODE: {
    id: 'UNICODE',
    title: 'The Unicode Standard, Tifinagh block U+2D30–U+2D7F (character names via Unicode 15.1 data)',
    url: 'https://www.unicode.org/charts/PDF/U2D30.pdf',
    note: 'Code points and names checked programmatically.',
  },
  'WIKIDATA-SHI': {
    id: 'WIKIDATA-SHI',
    title: 'Wikidata Tachelhit lexemes with Tifinagh, Latin and Arabic-script representations (L1215185, L309611, L675101)',
    url: 'https://www.wikidata.org/wiki/Lexeme:L1215185',
    note: 'CC0 community data. ⴰⴼⵓⵙ→افوس, ⵉⴼⴰⵙⵙⵏ→ئفاسّن, ⵓⴽⵙⵓⵎ→ؤكسوم, ⴱⵔⴰⵢⵔ→براير.',
  },
  'ALBANE-2025': {
    id: 'ALBANE-2025',
    title:
      'Albane, Slimani, Kheddouci — "An approach for transliterating Tifinagh Berber texts into Latin and Arabic alphabets", Revue Iles d Imesli 17(1), 2025',
    url: 'https://asjp.cerist.dz/en/downArticle/397/17/1/284878',
    note:
      'Algerian/Kabyle-oriented table (Figure 2) and rules R1/R2. R2 (geminate → shadda) adopted; R1 (full vowels → short-vowel diacritics) rejected for Moroccan Amazigh.',
  },
  TAWALT: {
    id: 'TAWALT',
    title: 'Tawalt Amazigh–Arabic dictionary (field `tifinagh_in_arabic`), as published on Hugging Face: abdelhaqueidali/Tawalt-Amazigh-Arabic-Dictionary',
    url: 'https://huggingface.co/datasets/abdelhaqueidali/Tawalt-Amazigh-Arabic-Dictionary',
    note:
      '27,921 unambiguous single-word Tifinagh/Arabic-script pairs, written by people (the Arabic carries information absent from the Tifinagh). ' +
      'License unspecified → used locally for evaluation only, never shipped. Conventions: أ ئ ؤ word-initially, گ for ⴳ, ژ for ⵥ, shadda, plain و/ي in hiatus.',
  },
  PROJECT: {
    id: 'PROJECT',
    title: 'This project (proposed heuristic, not an external standard)',
    note: 'Documented in docs/linguistic-rules.md; candidates for human linguistic validation.',
  },
}
