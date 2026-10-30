# Notices and attributions

## Code

This project is a fork of **tifinagh-convert** by Hamza BOUQSSIM
(<https://github.com/hamza-bouqssim/tifinagh-convert>, commit
`1f0f31ad6910b47ce93c28c251f03956a2dd0579`, MIT License). The upstream
files `src/converters/*`, `src/data/mapping.ts`, parts of `src/types/index.ts`,
the `convert`/`detect`/`alphabet` API in `src/index.ts`, and
`tests/upstream.test.ts` derive from it. The upstream license is reproduced
verbatim in [`LICENSE.upstream`](LICENSE.upstream); the combined work is MIT
([`LICENSE`](LICENSE)).

## Linguistic sources (cited, not copied)

- F. Ataa Allah, J. Frain, Y. Ait Ouguengay, *Amazigh Language Desktop
  Converter*, IRCAM (SITACAM 2013) — Tables I and II. Character
  correspondences (facts) were transcribed after visual verification; no text
  or figures are reproduced.
- S. Albane, H. Slimani, H. Kheddouci, *An approach for transliterating
  Tifinagh Berber texts into Latin and Arabic alphabets*, Revue Iles d Imesli
  17(1), 2025 — six correspondences for non-IRCAM letters and three short
  worked examples quoted for comparison (`data/gold/albane2025-examples.json`).

## Fonts shipped with the demo

`demo/fonts/` contains Noto Sans (Latin, variable), Noto Sans Tifinagh and
Noto Naskh Arabic as WOFF2 files from the Fontsource packages (5.3.0), by
the Noto Project Authors, under the SIL Open Font License 1.1
(`demo/fonts/OFL-*.txt`). They let the demo work offline.

## Data shipped in this repository

| File | Origin | License |
|---|---|---|
| `data/gold/wikidata-lexemes.json` | Wikidata lexemes L1215185, L309611, L675101 | CC0 |
| `data/gold/wikidata-toponyms.json` | Wikidata item labels (zgh / ar / fr) | CC0 |
| `data/gold/specification-examples.json` | three examples confirmed by the project specification | — (facts) |
| `data/gold/albane2025-examples.json` | three examples quoted from Albane et al. (2025) | quotation for research |

## Data deliberately NOT shipped

- `mustapharajaa/tamazight-Transliterating-en-ar` — no license file
  (all rights reserved by default); only its 1:1 character map is described
  and re-implemented as a baseline (`benchmarks/baselines.mjs`).
- `Tamazight-NLP/ircam-dglai` (Hugging Face) — CC-BY-NC-4.0, scraped from
  IRCAM's DGLAI. Used locally for coverage statistics only
  (`node benchmarks/evaluate.mjs --dglai <file>`); never bundled.
- `abdelhaqueidali/Tawalt-Amazigh-Arabic-Dictionary` (Hugging Face) — license
  unspecified. Used locally for evaluation only
  (`node benchmarks/evaluate.mjs --tawalt <tawalt_ar.json>`); only aggregate
  scores and convention counts appear in this repository.
- `Tamazight-NLP/TAWNZA_TIFINAGH_ARABIC_DATASET` (CC-BY-4.0) — Tifinagh
  subtitles used locally as a robustness corpus; not bundled.
