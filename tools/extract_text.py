#!/usr/bin/env python3
"""Strip tags from a saved HTML page and print readable text.

Phase 11 (T-M4). The old spec used `cd "$SCRATCHPAD"` plus a multi-line
`python3 -c` string, which is POSIX-only. This helper is one cross-platform
implementation that works unchanged in every shell. Stdlib only.
"""

import html
import re
import sys
from pathlib import Path


def extract(raw: str, limit: int = 6000) -> str:
    text = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", raw)
    text = html.unescape(re.sub(r"(?s)<[^>]+>", " ", text))
    text = re.sub(r"[ \t\xa0]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n", text).strip()[:limit]


def main(argv=None) -> int:
    if len(argv or sys.argv[1:]) != 1:
        print("usage: extract_text.py <page.html>", file=sys.stderr)
        return 1
    path = Path((argv or sys.argv[1:])[0])
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        print(f"could not read {path}: {exc}", file=sys.stderr)
        return 1
    print(extract(raw))
    return 0


if __name__ == "__main__":
    sys.exit(main())
