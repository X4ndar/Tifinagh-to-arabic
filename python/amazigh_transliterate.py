"""Python bridge to the amazigh-transliterate CLI (the TypeScript engine is authoritative).

No re-implementation of the rules lives here: every conversion is done by the
Node.js CLI, so Python and JavaScript always give identical results.

Usage
-----
    from amazigh_transliterate import Transliterator, to_arabic

    to_arabic("ⴰⵣⵓⵍ")                       # 'ازول'  (one-shot, spawns a process)

    with Transliterator(profile="readable") as tr:   # persistent process, fast for batches
        tr.convert("ⵜⴰⵎⴰⵣⵉⵖⵜ")              # 'تامازيغت'
        tr.convert_many(["ⴰⵎⵖⴰⵔ", "ⵉⴼⴰⵙⵙⵏ"])  # ['امغار', 'ئفاسّن']
        tr.convert_detailed("ⵯ")             # {'output': 'ⵯ', 'warnings': [...]}

The CLI is located via, in order: the `cli` argument, the AMAZIGH_TRANSLITERATE_CLI
environment variable, `node_modules/.bin/amazigh-transliterate`, the repository's
`dist/cli/bin.js`, and finally `amazigh-transliterate` on PATH.
Requires Node.js >= 18. Works offline.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

__all__ = ["Transliterator", "TransliterationError", "to_arabic", "find_cli"]

_HERE = os.path.dirname(os.path.abspath(__file__))


class TransliterationError(RuntimeError):
    """Raised when the CLI reports an error for a record (e.g. strict mode)."""

    def __init__(self, message: str, warnings: Optional[list] = None):
        super().__init__(message)
        self.warnings = warnings or []


def find_cli(cli: Optional[str] = None) -> List[str]:
    """Return the command (argv prefix) that runs the CLI."""
    candidates = [cli, os.environ.get("AMAZIGH_TRANSLITERATE_CLI")]
    for c in candidates:
        if c:
            return _as_command(c)
    for path in (
        os.path.join(os.getcwd(), "node_modules", ".bin", "amazigh-transliterate"),
        os.path.join(_HERE, "..", "dist", "cli", "bin.js"),
    ):
        if os.path.exists(path):
            return _as_command(os.path.abspath(path))
    exe = shutil.which("amazigh-transliterate")
    if exe:
        return [exe]
    raise FileNotFoundError(
        "amazigh-transliterate CLI not found. Run `npm install && npm run build` in the repository, "
        "install the npm package, or set AMAZIGH_TRANSLITERATE_CLI."
    )


def _as_command(path: str) -> List[str]:
    if path.endswith(".js"):
        node = shutil.which("node")
        if not node:
            raise FileNotFoundError("Node.js (`node`) is required but was not found on PATH")
        return [node, path]
    return [path]


def _options_args(profile: str, options: Optional[Mapping[str, Any]], strict: bool, alternatives: bool, trace: bool, lexicon: Optional[str]) -> List[str]:
    args = ["--profile", profile]
    for key, value in (options or {}).items():
        if isinstance(value, bool):
            value = "true" if value else "false"
        args += ["--option", f"{key}={value}"]
    if strict:
        args.append("--strict")
    if alternatives:
        args.append("--alternatives")
    if trace:
        args.append("--trace")
    if lexicon:
        args += ["--lexicon", lexicon]
    return args


class Transliterator:
    """A persistent CLI process in --jsonl mode. Thread-safe; use as a context manager."""

    def __init__(
        self,
        profile: str = "readable",
        options: Optional[Mapping[str, Any]] = None,
        *,
        strict: bool = False,
        alternatives: bool = False,
        trace: bool = False,
        lexicon: Optional[str] = None,
        cli: Optional[str] = None,
    ) -> None:
        cmd = find_cli(cli) + ["--jsonl"] + _options_args(profile, options, strict, alternatives, trace, lexicon)
        self._proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            encoding="utf-8",
            bufsize=1,
        )
        self._lock = threading.Lock()
        self._next_id = 0

    # -- core -------------------------------------------------------------
    def convert_detailed(self, text: str) -> Dict[str, Any]:
        """Return the full JSON record: output, warnings (and alternatives/trace if enabled)."""
        if not isinstance(text, str):
            raise TypeError("text must be a str")
        with self._lock:
            if self._proc.poll() is not None:
                raise RuntimeError("CLI process has exited: " + (self._proc.stderr.read() if self._proc.stderr else ""))
            self._next_id += 1
            rid = self._next_id
            assert self._proc.stdin and self._proc.stdout
            self._proc.stdin.write(json.dumps({"id": rid, "text": text}, ensure_ascii=False) + "\n")
            self._proc.stdin.flush()
            line = self._proc.stdout.readline()
        if not line:
            err = self._proc.stderr.read() if self._proc.stderr else ""
            raise RuntimeError("CLI produced no output" + (": " + err if err else ""))
        rec = json.loads(line)
        if rec.get("id") != rid:
            raise RuntimeError(f"protocol error: expected id {rid}, got {rec.get('id')}")
        if "error" in rec:
            raise TransliterationError(rec["error"], rec.get("warnings"))
        return rec

    def convert(self, text: str) -> str:
        return self.convert_detailed(text)["output"]

    def convert_many(self, texts: Iterable[str]) -> List[str]:
        return [self.convert(t) for t in texts]

    # -- lifecycle --------------------------------------------------------
    def close(self) -> None:
        if self._proc.poll() is None:
            try:
                if self._proc.stdin:
                    self._proc.stdin.close()
                self._proc.wait(timeout=10)
            except Exception:
                self._proc.kill()
        for stream in (self._proc.stdout, self._proc.stderr):
            if stream:
                stream.close()

    def __enter__(self) -> "Transliterator":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def __del__(self) -> None:  # pragma: no cover - best effort
        try:
            self.close()
        except Exception:
            pass


def to_arabic(text: str, profile: str = "readable", options: Optional[Mapping[str, Any]] = None, *, cli: Optional[str] = None) -> str:
    """One-shot conversion (spawns one process). Prefer Transliterator for batches."""
    cmd = find_cli(cli) + ["--json"] + _options_args(profile, options, False, False, False, None)
    res = subprocess.run(cmd, input=text, capture_output=True, encoding="utf-8", check=False)
    if res.returncode != 0:
        raise TransliterationError(res.stderr.strip())
    return json.loads(res.stdout)["output"]


def convert_file(src: str, dst: str, profile: str = "readable", extra_args: Sequence[str] = (), *, cli: Optional[str] = None) -> None:
    """Stream a UTF-8 text file through the CLI (line breaks preserved)."""
    cmd = find_cli(cli) + ["--profile", profile, *extra_args, "-o", dst, src]
    res = subprocess.run(cmd, capture_output=True, encoding="utf-8", check=False)
    if res.returncode != 0:
        raise TransliterationError(res.stderr.strip())


if __name__ == "__main__":  # pragma: no cover
    import sys

    with Transliterator() as tr:
        for line in sys.stdin:
            print(tr.convert(line.rstrip("\n")))
