"""Batch conversion from Python through the CLI (run `npm run build` first).

    python3 examples/python_batch.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))
from amazigh_transliterate import Transliterator  # noqa: E402

corpus = ["ⴰⵣⵓⵍ ⴼⵍⵍⴰⵡⵏ", "ⵜⴰⵎⴰⵣⵉⵖⵜ ⵜⵓⵜⵍⴰⵢⵜ ⵜⴰⵏⴰⵎⵓⵔⵜ", "ASR hypothesis: ⴰⵎⵖⴰⵔ 2026"]

with Transliterator(profile="readable") as tr:
    for text in corpus:
        rec = tr.convert_detailed(text)
        print(rec["output"], [w["code"] for w in rec["warnings"]])
