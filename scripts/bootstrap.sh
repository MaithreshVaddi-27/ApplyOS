#!/usr/bin/env bash
# Bootstrap ApplyOS on a fresh machine: check the toolchain, install every
# dependency surface, and verify the repository is green.
#
# Idempotent — running it twice changes nothing the second time.
# It never reads, writes, or moves anything under input/, output/, or
# workspace/: the candidate's personal data is never touched by a setup
# script.
#
# Usage:
#   ./scripts/bootstrap.sh              # check, install, verify
#   ./scripts/bootstrap.sh --skip-tests # check and install only
#
# Exit 0 when every REQUIRED tool is present and the installs succeeded.
# A missing optional tool is a warning, not a failure — but the script says
# exactly what to install.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

SKIP_TESTS=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=1 ;;
    -h|--help)
      sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) printf 'unknown argument: %s\n' "$arg" >&2; exit 1 ;;
  esac
done

MISSING_REQUIRED=0
WARNINGS=0

ok()    { printf '  ok    %s\n' "$1"; }
warn()  { printf '  WARN  %s\n' "$1"; WARNINGS=$((WARNINGS + 1)); }
fail()  { printf '  FAIL  %s\n' "$1"; MISSING_REQUIRED=$((MISSING_REQUIRED + 1)); }
step()  { printf '\n== %s\n' "$1"; }

# ---------------------------------------------------------------- toolchain

step "Checking the toolchain"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  PY=""
fi

if [ -n "$PY" ]; then
  PY_VERSION="$("$PY" --version 2>&1 | awk '{print $2}')"
  PY_MAJOR="$(printf '%s' "$PY_VERSION" | cut -d. -f1)"
  PY_MINOR="$(printf '%s' "$PY_VERSION" | cut -d. -f2)"
  if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]; }; then
    fail "python $PY_VERSION — 3.10+ is required (tools/ and tests/)"
  else
    ok "python $PY_VERSION"
  fi
else
  fail "python — not found. Install Python 3.10+ (https://www.python.org/downloads/)"
  PY=""
fi

# Resolve a command, accepting the Windows .exe form too. Git Bash inherits
# the Windows PATH; WSL does not, so `bun` may only exist as `bun.exe`.
resolve() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi
  if command -v "$name.exe" >/dev/null 2>&1; then
    command -v "$name.exe"
    return 0
  fi
  return 1
}

BUN_BIN=""
if BUN_BIN="$(resolve bun)"; then
  BUN_VERSION="$("$BUN_BIN" --version 2>/dev/null | tr -d 'v')"
  PINNED=""
  if [ -f "applyos/.bun-version" ]; then
    PINNED="$(tr -d '[:space:]' < applyos/.bun-version)"
  fi
  if [ -n "$PINNED" ] && [ "$BUN_VERSION" != "$PINNED" ]; then
    warn "bun $BUN_VERSION — the repository pins $PINNED (applyos/.bun-version)"
  else
    ok "bun $BUN_VERSION"
  fi
else
  fail "bun — not found. Install Bun (https://bun.sh) — the engine and every portal CLI need it"
fi

if command -v lualatex >/dev/null 2>&1; then
  ok "lualatex — $(lualatex --version 2>&1 | head -n 1)"
else
  fail "lualatex — not found. /apply cannot compile documents. See SETUP.md#latex"
fi

if command -v kpsewhich >/dev/null 2>&1 && kpsewhich moderncv.cls >/dev/null 2>&1; then
  ok "moderncv.cls"
else
  fail "moderncv.cls — not found. Install texlive-latex-extra, texlive-fonts-extra and texlive-fonts-recommended"
fi

if command -v pdftotext >/dev/null 2>&1; then
  ok "pdftotext (poppler)"
elif [ -n "$PY" ] && "$PY" -c "import pypdf" >/dev/null 2>&1; then
  ok "pypdf (PDF text layer)"
else
  fail "no PDF text extractor — install poppler-utils, or run: pip install pypdf"
fi

# ---------------------------------------------------------------- installs

if [ -n "$BUN_BIN" ]; then
  step "Installing the engine"
  if (cd applyos && "$BUN_BIN" install --frozen-lockfile); then
    ok "applyos/ workspace links resolve"
  else
    fail "bun install failed inside applyos/"
  fi

  step "Installing the portal CLIs"
  CLI_COUNT=0
  for d in .agents/skills/*-search/cli; do
    [ -d "$d" ] || continue
    CLI_COUNT=$((CLI_COUNT + 1))
    if (cd "$d" && "$BUN_BIN" install >/dev/null 2>&1); then
      ok "$(basename "$(dirname "$d")")"
    else
      fail "bun install failed in $d"
    fi
  done
  ok "$CLI_COUNT portal CLI(s) installed"
fi

# ------------------------------------------------------------ verification

if [ "$SKIP_TESTS" -eq 0 ]; then
  step "Verifying the repository"

  if [ -n "$PY" ]; then
    if "$PY" -m unittest discover -s tests -t . >/dev/null 2>&1; then
      ok "python test suite"
    else
      fail "python test suite — run: python -m unittest discover -s tests -t ."
    fi
  fi

  if [ -n "$BUN_BIN" ]; then
    if (cd applyos && "$BUN_BIN" run test >/dev/null 2>&1); then
      ok "engine test suite"
    else
      fail "engine test suite — run: cd applyos && bun run test"
    fi
    if (cd applyos && "$BUN_BIN" run --filter "*" typecheck >/dev/null 2>&1); then
      ok "engine typecheck"
    else
      fail "engine typecheck — run: cd applyos && bun run --filter \"*\" typecheck"
    fi
  fi

  if [ -n "$PY" ]; then
    if "$PY" tools/lint_skills.py >/dev/null 2>&1; then
      ok "lint_skills"
    else
      fail "lint_skills"
    fi
    if "$PY" tools/security_guards.py >/dev/null 2>&1; then
      ok "security_guards"
    else
      fail "security_guards"
    fi
    if "$PY" tools/check_links.py --quiet >/dev/null 2>&1; then
      ok "check_links"
    else
      fail "check_links"
    fi
  fi
fi

# ---------------------------------------------------------------- summary

step "Summary"
if [ "$MISSING_REQUIRED" -gt 0 ]; then
  printf '%d required check(s) failed. Fix them above, then re-run this script.\n\n' "$MISSING_REQUIRED"
  printf 'Next: run "applyos doctor" for the full report.\n'
  exit 1
fi

printf 'Everything required is present.\n'
if [ "$WARNINGS" -gt 0 ]; then
  printf '%d warning(s) above — they are advisory.\n' "$WARNINGS"
fi
printf '\nNext: run "applyos doctor", then "/setup" inside your AI coding agent.\n'
exit 0
