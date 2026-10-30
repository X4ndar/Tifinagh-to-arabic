
## moroccan (n = 7)

| system | exact | exact or listed alternative | exact ignoring diacritics | CER |
|---|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 5/7 (71.4%) | 71.4% | 71.4% | 0.108 |
| baseline: dictionary-style 1:1 map | 5/7 (71.4%) | 71.4% | 71.4% | 0.081 |
| ours: readable (default) | 7/7 (100.0%) | 100.0% | 100.0% | 0.000 |
| ours: ircam | 5/7 (71.4%) | 85.7% | 85.7% | 0.054 |
| ours: phonetic | 6/7 (85.7%) | 100.0% | 100.0% | 0.027 |
| ablation: readable − positional rules | 5/7 (71.4%) | 71.4% | 71.4% | 0.108 |
| ablation: readable − gemination rule | 6/7 (85.7%) | 85.7% | 85.7% | 0.027 |
| ablation: readable − all context | 5/7 (71.4%) | 71.4% | 71.4% | 0.135 |

## toponyms (n = 192)

| system | exact | exact or listed alternative | exact ignoring diacritics | CER |
|---|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 34/192 (17.7%) | 17.7% | 17.7% | 0.214 |
| baseline: dictionary-style 1:1 map | 39/192 (20.3%) | 20.3% | 20.3% | 0.196 |
| ours: readable (default) | 39/192 (20.3%) | 33.9% | 26.6% | 0.204 |
| ours: ircam | 29/192 (15.1%) | 28.6% | 18.8% | 0.265 |
| ours: phonetic | 29/192 (15.1%) | 28.6% | 23.4% | 0.265 |
| ablation: readable − positional rules | 40/192 (20.8%) | 33.9% | 27.1% | 0.207 |
| ablation: readable − gemination rule | 39/192 (20.3%) | 33.9% | 20.3% | 0.203 |
| ablation: readable − all context | 40/192 (20.8%) | 33.9% | 20.8% | 0.207 |

## albane (n = 3)

| system | exact | exact or listed alternative | exact ignoring diacritics | CER |
|---|---:|---:|---:|---:|
| baseline: naive Table I (1:1) | 0/3 (0.0%) | 0.0% | 0.0% | 0.538 |
| baseline: dictionary-style 1:1 map | 0/3 (0.0%) | 0.0% | 0.0% | 0.615 |
| ours: readable (default) | 0/3 (0.0%) | 0.0% | 0.0% | 0.385 |
| ours: ircam | 0/3 (0.0%) | 0.0% | 0.0% | 0.385 |
| ours: phonetic | 0/3 (0.0%) | 0.0% | 0.0% | 0.462 |
| ablation: readable − positional rules | 0/3 (0.0%) | 0.0% | 0.0% | 0.385 |
| ablation: readable − gemination rule | 0/3 (0.0%) | 0.0% | 0.0% | 0.385 |
| ablation: readable − all context | 0/3 (0.0%) | 0.0% | 0.0% | 0.385 |

## coverage

```json
{
  "ircamUnits": 33,
  "ircamUnitsMapped": 33,
  "dglai": {
    "words": 18846,
    "tifinaghChars": 104100,
    "unsupportedChars": 0,
    "unsupportedRate": 0,
    "wordsWithWarnings": 0,
    "warningCodes": {},
    "ms": 91.724247
  }
}
```

## preservation

0 failures in 2000 synthetic mixed-script documents

readable vs official toponyms — mismatch explanations:
{
  'other (consonant or lexical difference)': 30,
  'diacritics (shadda / damma / kasra)': 12,
  'vowel letters omitted or added (lexicalized spelling)': 40,
  'word-initial vowel spelling (ئ ؤ أ إ آ ا)': 54,
  'final -a as ة / ى': 12,
  'letter choice for g/ẓ/ṛ (ڭ گ ك · ژ ظ ز · ڔ ر)': 5
}

readable vs official toponyms — by phenomenon (exact):
{
  'vowel i/u': '25/135',
  semivowel: '7/56',
  gemination: '0/36',
  emphatic: '5/34',
  'initial vowel': '1/72',
  g: '0/27',
  labialization: '0/5'
}
