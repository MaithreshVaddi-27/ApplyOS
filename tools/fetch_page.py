#!/usr/bin/env python3
"""Fetch a page with browser headers when the honest request is WAF-blocked.

Phase 11 (T-M4). The old spec used `cd "$SCRATCHPAD" && curl …`, which is
POSIX-only and fails on Windows, a supported platform. This helper is one
cross-platform implementation: Python is already a hard prerequisite, so no new
dependency is introduced and there is no platform branch in a spec.

The caller must have already checked robots.txt and decided that a browser
retry is permitted. This tool does not make that decision. It writes the body
to a path the caller names (normally the session scratchpad, never the repo)
and prints one status line to stdout.

Stdlib only. Never follows a redirect to a file:// or data:// URL.
"""

import argparse
import gzip
import sys
import urllib.error
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-GB,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
}


def fetch(url: str, out: Path, timeout: float = 45) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"refusing non-HTTP URL scheme: {parsed.scheme!r}")
    request = urllib.request.Request(url, headers=HEADERS, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            status = response.status
    except urllib.error.HTTPError as exc:
        # An HTTP error still has a body that can show a challenge page.
        raw = exc.read()
        status = exc.code
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    elif raw[:1] == b"\x78":
        try:
            raw = zlib.decompress(raw)
        except zlib.error:
            pass
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(raw)
    return f"HTTP {status} size={len(raw)}"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Fetch one page with browser headers, cross-platform.")
    parser.add_argument("url", help="http(s) URL to fetch")
    parser.add_argument("--out", required=True, type=Path, help="where to write the body")
    parser.add_argument("--timeout", type=float, default=45, help="per-request timeout in seconds")
    args = parser.parse_args(argv)
    try:
        print(fetch(args.url, args.out, args.timeout))
    except (ValueError, OSError, urllib.error.URLError) as exc:
        print(f"fetch failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
