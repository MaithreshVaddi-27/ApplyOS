#!/usr/bin/env python3
"""One command that runs everything CI runs locally, offline.

Phase 12 (12.4). A contributor adds a board and runs this once; it prints a
clear pass/fail summary of the same checks CI applies. Python is a hard
prerequisite, so this core is Python — not a shell script with `&&` chaining
that breaks on Windows (audit T-M4). Thin wrappers in scripts/ call it.

Network: only `bun install` is allowed to touch the registry. Every check below
it is offline — fixture/mock tests, no live portal, no model call, no telemetry.
LaTeX smoke compiles and the dependency-review job are excluded: they need a
TeX distribution and a GitHub graph respectively, neither of which a
contributor's board change affects. CI still runs them.
"""

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PY = sys.executable


def bun_bin() -> str | None:
    for name in ("bun", "bun.exe"):
        found = shutil.which(name)
        if found:
            return found
    return None


@dataclass(frozen=True)
class Check:
    label: str
    argv: list[str]
    cwd: Path = ROOT
    optional: bool = False


def checks(have_bun: bool) -> list[Check]:
    out: list[Check] = [
        Check("python tool tests", [PY, "-m", "unittest", "discover", "-s", "tests", "-t", "."]),
        Check("lint_skills", [PY, "tools/lint_skills.py"]),
        Check("security_guards", [PY, "tools/security_guards.py"]),
        Check("check_specs (8 conformance rules)", [PY, "tools/check_specs.py"]),
        Check("check_links", [PY, "tools/check_links.py"]),
        Check("spec_parity", [PY, "tools/spec_parity.py", "--quiet"]),
    ]
    if have_bun:
        out += [
            Check("evaluation suites", ["bun", "run", "apps/cli/src/cli.ts", "eval", "--format", "json"], ROOT / "applyos"),
            Check("engine tests", ["bun", "run", "test"], ROOT / "applyos"),
            Check("engine typechecks", ["bun", "run", "--filter", "*", "typecheck"], ROOT / "applyos"),
            Check("worked example tests", ["bun", "run", "test"], ROOT / "examples" / "example-search" / "cli"),
            Check("worked example typecheck", ["bun", "run", "typecheck"], ROOT / "examples" / "example-search" / "cli"),
        ]
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the offline CI checks in one command.")
    parser.add_argument("--skip-install", action="store_true", help="assume bun install has already run")
    args = parser.parse_args(argv)

    bun = bun_bin()
    if not bun:
        print("bun not found — install Bun (https://bun.sh) for the engine and portal checks")
        return 1

    print(f"Using Python {PY} and {bun} from {ROOT}\n")
    if not args.skip_install:
        for sub in ("applyos", "examples/example-search/cli"):
            target = ROOT / sub
            if (target / "package.json").is_file():
                result = subprocess.run([bun, "install"], cwd=target, check=False)
                if result.returncode != 0:
                    print(f"FAIL bun install in {sub}")
                    return 1
                print(f"ok   bun install in {sub}")

    failures: list[str] = []
    passed = 0
    for check in checks(have_bun=True):
        # Resolve `bun` to the absolute path found above; subprocess on Windows
        # does not always inherit the shell's PATH for a bare command name.
        cmd = [bun if part == "bun" else part for part in check.argv]
        result = subprocess.run(cmd, cwd=check.cwd, check=False)
        if result.returncode == 0:
            print(f"ok   {check.label}")
            passed += 1
        else:
            print(f"FAIL {check.label} (exit {result.returncode})")
            failures.append(check.label)

    print(f"\n{passed} passed, {len(failures)} failed")
    if failures:
        for label in failures:
            print(f"  - {label}")
        print("Fix the failures above and re-run. CI applies these same checks.")
        return 1
    print("All offline checks green. This is what CI runs before a merge.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
