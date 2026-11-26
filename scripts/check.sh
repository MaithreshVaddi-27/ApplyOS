#!/usr/bin/env bash
# Thin wrapper over the cross-platform contribution check (Phase 12.4).
# The logic lives in tools/check_contribution.py so it works on every OS;
# this script only finds a Python interpreter and calls it.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
else echo "python 3.10+ is required" >&2; exit 1; fi
exec "$PY" tools/check_contribution.py "$@"
