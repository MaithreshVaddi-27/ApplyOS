# Bootstrap ApplyOS on a fresh machine: check the toolchain, install every
# dependency surface, and verify the repository is green.
#
# Idempotent — running it twice changes nothing the second time.
# It never reads, writes, or moves anything under input/, output/, or
# workspace/: the candidate's personal data is never touched by a setup
# script.
#
# Usage:
#   .\scripts\bootstrap.ps1              # check, install, verify
#   .\scripts\bootstrap.ps1 -SkipTests   # check and install only
#
# Exit 0 when every REQUIRED tool is present and the installs succeeded.

[CmdletBinding()]
param(
  [switch]$SkipTests
)

$ErrorActionPreference = 'Continue'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$script:MissingRequired = 0
$script:Warnings = 0

function Step($name) { Write-Host ""; Write-Host "== $name" }
function Ok($name)   { Write-Host "  ok    $name" }
function Warn($name) { Write-Host "  WARN  $name"; $script:Warnings++ }
function Fail($name) { Write-Host "  FAIL  $name"; $script:MissingRequired++ }

# ---------------------------------------------------------------- toolchain

Step "Checking the toolchain"

$Py = $null
foreach ($candidate in @('python3', 'python')) {
  if (Get-Command $candidate -ErrorAction SilentlyContinue) {
    $raw = & $candidate --version 2>&1
    if ($raw -match 'Python\s+(\d+)\.(\d+)') {
      $major = [int]$Matches[1]
      $minor = [int]$Matches[2]
      if ($major -gt 3 -or ($major -eq 3 -and $minor -ge 10)) {
        $Py = $candidate
        Ok "python $raw"
      } else {
        Fail "python $raw - 3.10+ is required (tools/ and tests/)"
        $Py = $candidate
      }
      break
    }
  }
}
if (-not $Py) {
  Fail "python - not found. Install Python 3.10+ (https://www.python.org/downloads/)"
}

if (Get-Command bun -ErrorAction SilentlyContinue) {
  $BunVersion = (& bun --version 2>$null) -replace '^v', ''
  $Pinned = ''
  if (Test-Path "applyos\.bun-version") {
    $Pinned = (Get-Content "applyos\.bun-version" -Raw).Trim()
  }
  if ($Pinned -and $BunVersion -ne $Pinned) {
    Warn "bun $BunVersion - the repository pins $Pinned (applyos\.bun-version)"
  } else {
    Ok "bun $BunVersion"
  }
} else {
  Fail "bun - not found. Install Bun (https://bun.sh) - the engine and every portal CLI need it"
}

if (Get-Command lualatex -ErrorAction SilentlyContinue) {
  Ok "lualatex - $((& lualatex --version 2>&1 | Select-Object -First 1))"
} else {
  Fail "lualatex - not found. /apply cannot compile documents. See SETUP.md#latex"
}

if (Get-Command kpsewhich -ErrorAction SilentlyContinue) {
  if (kpsewhich moderncv.cls 2>$null) {
    Ok "moderncv.cls"
  } else {
    Fail "moderncv.cls - not found. Install texlive-latex-extra, texlive-fonts-extra and texlive-fonts-recommended"
  }
} else {
  Fail "moderncv.cls - kpsewhich not found. A LaTeX distribution is required"
}

$Poppler = [bool](Get-Command pdftotext -ErrorAction SilentlyContinue)
$PyPdf = $false
if ($Py) {
  & $Py -c "import pypdf" 2>$null | Out-Null
  $PyPdf = ($LASTEXITCODE -eq 0)
}
if ($Poppler) { Ok "pdftotext (poppler)" }
elseif ($PyPdf) { Ok "pypdf (PDF text layer)" }
else { Fail "no PDF text extractor - install poppler-utils, or run: pip install pypdf" }

# ---------------------------------------------------------------- installs

if (Get-Command bun -ErrorAction SilentlyContinue) {
  Step "Installing the engine"
  Push-Location "applyos"
  & bun install --frozen-lockfile | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "applyos\ workspace links resolve" }
  else { Fail "bun install failed inside applyos\" }
  Pop-Location

  Step "Installing the portal CLIs"
  $cliDirs = Get-ChildItem ".agents\skills" -Directory -ErrorAction SilentlyContinue |
             Where-Object { Test-Path (Join-Path $_.FullName "cli\package.json") }
  foreach ($dir in $cliDirs) {
    Push-Location (Join-Path $dir.FullName "cli")
    & bun install | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok $dir.Name } else { Fail "bun install failed in $($dir.Name)" }
    Pop-Location
  }
  Ok "$($cliDirs.Count) portal CLI(s) installed"
}

# ------------------------------------------------------------ verification

if (-not $SkipTests) {
  Step "Verifying the repository"

  if ($Py) {
    & $Py -m unittest discover -s tests -t . | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "python test suite" }
    else { Fail "python test suite - run: python -m unittest discover -s tests -t ." }

    & $Py tools/lint_skills.py | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "lint_skills" } else { Fail "lint_skills" }

    & $Py tools/security_guards.py | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "security_guards" } else { Fail "security_guards" }

    & $Py tools/check_links.py --quiet | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "check_links" } else { Fail "check_links" }
  }

  if (Get-Command bun -ErrorAction SilentlyContinue) {
    Push-Location "applyos"
    & bun run test | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "engine test suite" } else { Fail "engine test suite - run: cd applyos && bun run test" }
    & bun run --filter "*" typecheck | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "engine typecheck" } else { Fail "engine typecheck" }
    Pop-Location
  }
}

# ---------------------------------------------------------------- summary

Step "Summary"
if ($script:MissingRequired -gt 0) {
  Write-Host "$($script:MissingRequired) required check(s) failed. Fix them above, then re-run this script."
  Write-Host ""
  Write-Host 'Next: run "applyos doctor" for the full report.'
  exit 1
}

Write-Host "Everything required is present."
if ($script:Warnings -gt 0) {
  Write-Host "$($script:Warnings) warning(s) above - they are advisory."
}
Write-Host ""
Write-Host 'Next: run "applyos doctor", then "/setup" inside your AI coding agent.'
exit 0
