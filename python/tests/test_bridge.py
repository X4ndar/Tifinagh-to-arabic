"""Smoke tests for the Python bridge. Run: python3 -m unittest discover -s python/tests"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from amazigh_transliterate import HttpTransliterator, Transliterator, TransliterationError, from_arabic, to_arabic  # noqa: E402


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

    def test_arabic_to_tifinagh(self):
        self.assertEqual(from_arabic("أزول"), "ⴰⵣⵓⵍ")
        self.assertEqual(from_arabic("تامازيغت", target="latin"), "tamaziɣt")
        with Transliterator(source="arabic") as tr:
            self.assertEqual(tr.convert_many(["أمغار", "ئفاسّن", "براير"]), ["ⴰⵎⵖⴰⵔ", "ⵉⴼⴰⵙⵙⵏ", "ⴱⵔⴰⵢⵔ"])
        with Transliterator(source="arabic", profile="ircam", options={"semivowels": "context"}) as tr:
            self.assertEqual(tr.convert("اوال"), "ⴰⵡⴰⵍ")
        with self.assertRaises(ValueError):
            Transliterator(source="arabic", target="arabic")

    def test_warnings_and_strict(self):
        with Transliterator() as tr:
            rec = tr.convert_detailed("ⵯ")
            self.assertEqual(rec["warnings"][0]["code"], "ORPHAN_LABIALIZATION")
        with Transliterator(strict=True) as tr:
            with self.assertRaises(TransliterationError):
                tr.convert("ⵯ")


class HttpClientTest(unittest.TestCase):
    """Starts the real server (dist/server/bin.js) on a free port."""

    @classmethod
    def setUpClass(cls):
        import socket
        import subprocess
        import time
        import urllib.request

        root = os.path.join(os.path.dirname(__file__), "..", "..")
        with socket.socket() as s:
            s.bind(("127.0.0.1", 0))
            cls.port = s.getsockname()[1]
        env = dict(os.environ, PORT=str(cls.port), HOST="127.0.0.1", LOG_REQUESTS="false")
        cls.proc = subprocess.Popen(["node", os.path.join(root, "dist", "server", "bin.js")], env=env)
        for _ in range(50):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{cls.port}/healthz", timeout=1)
                break
            except Exception:
                time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(timeout=10)

    def test_http_client(self):
        tr = HttpTransliterator(f"http://127.0.0.1:{self.port}")
        self.assertEqual(tr.convert("ⴰⵣⵓⵍ"), "أزول")
        self.assertEqual(tr.convert_many(["ⵜⴰⵎⴰⵣⵉⵖⵜ", "ⴰⵎⵖⴰⵔ"] * 3, batch_size=2), ["تامازيغت", "أمغار"] * 3)
        self.assertEqual(HttpTransliterator(f"http://127.0.0.1:{self.port}", profile="ircam").convert("ⵉⴼⴰⵙⵙⵏ"), "ئفاسسن")

    def test_http_arabic_source(self):
        url = f"http://127.0.0.1:{self.port}"
        self.assertEqual(HttpTransliterator(url, source="arabic").convert("أزول"), "ⴰⵣⵓⵍ")
        self.assertEqual(HttpTransliterator(url, source="arabic", target="latin").convert_many(["أمغار"]), ["amɣar"])

    def test_http_errors(self):
        with self.assertRaises(TransliterationError):
            HttpTransliterator(f"http://127.0.0.1:{self.port}", profile="nope").convert("ⴰ")


if __name__ == "__main__":
    unittest.main()
