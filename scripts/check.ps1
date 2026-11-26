# Thin wrapper over the cross-platform contribution check (Phase 12.4).
# Logic lives in tools/check_contribution.py; this only finds Python.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $py) { Write-Error "python 3.10+ is required"; exit 1 }
& $py.Source tools/check_contribution.py @args
exit $LASTEXITCODE
