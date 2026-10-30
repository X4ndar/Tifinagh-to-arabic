"""Smoke tests for the Python bridge. Run: python3 -m unittest discover -s python/tests"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from amazigh_transliterate import Transliterator, TransliterationError, to_arabic  # noqa: E402


class BridgeTest(unittest.TestCase):
    def test_one_shot(self):
        self.assertEqual(to_arabic("ⴰⵣⵓⵍ"), "أزول")

    def test_persistent_batch(self):
        with Transliterator() as tr:
            self.assertEqual(tr.convert_many(["ⵜⴰⵎⴰⵣⵉⵖⵜ", "ⴰⵎⵖⴰⵔ", "ⵉⴼⴰⵙⵙⵏ"]), ["تامازيغت", "أمغار", "ئفاسّن"])
            self.assertEqual(tr.convert("line1\nⴰⵣⵓⵍ"), "line1\nأزول")

    def test_profile_and_options(self):
        with Transliterator(profile="ircam", options={"gemination": "shadda"}) as tr:
            self.assertEqual(tr.convert("ⵉⴼⴰⵙⵙⵏ"), "ئفاسّن")

    def test_warnings_and_strict(self):
        with Transliterator() as tr:
            rec = tr.convert_detailed("ⵯ")
            self.assertEqual(rec["warnings"][0]["code"], "ORPHAN_LABIALIZATION")
        with Transliterator(strict=True) as tr:
            with self.assertRaises(TransliterationError):
                tr.convert("ⵯ")


if __name__ == "__main__":
    unittest.main()
