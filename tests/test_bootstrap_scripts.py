"""Tests for the bootstrap scripts (Phase 1 of docs/PROJECT_BLUEPRINT.md).

The bootstrap is the first thing a new contributor runs, so its failure modes
matter more than most: a script that misses a dependency surface leaves the
repository looking broken.

These tests are static — they read the scripts rather than executing them,
because executing them would install packages and run the full suite.
"""

import re
import shutil
import subprocess
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

BASH = REPO / "scripts" / "bootstrap.sh"
POWERSHELL = REPO / "scripts" / "bootstrap.ps1"

# The dependency surfaces a fresh clone needs. Missing any of these is what
# produced the "Cannot find module '@applyos/core'" failure on a fresh clone.
REQUIRED_SURFACES = ("applyos", ".agents/skills/*-search/cli")


class BootstrapScriptsTests(unittest.TestCase):
    def test_both_scripts_exist(self):
        self.assertTrue(BASH.is_file(), f"{BASH} is missing")
        self.assertTrue(POWERSHELL.is_file(), f"{POWERSHELL} is missing")

    def test_bash_script_is_syntactically_valid(self):
        bash = shutil.which("bash")
        if not bash:
            self.skipTest("bash is not available on this machine")
        # Liveness probe first. On Windows, `bash` may be Git Bash (works) or
        # a WSL bash whose service has died ("Catastrophic failure",
        # E_UNEXPECTED) - and that failure is indistinguishable from a syntax
        # error once the script is piped in. Probe before asserting, so a
        # broken shell skips rather than reporting a false failure.
        probe = subprocess.run([bash, "-c", "exit 0"], capture_output=True)
        if probe.returncode != 0:
            self.skipTest(
                "bash is installed but not usable on this machine "
                f"(exit {probe.returncode}); the syntax check is skipped"
            )
        # `bash -n` with the script on stdin parses without executing, and it
        # sidesteps path translation: a native Windows path is not resolvable
        # from WSL bash, and a POSIX path is not resolvable from Git Bash.
        # The script goes in as BYTES: with text=True, Python translates stdin
        # to CRLF on Windows and bash then sees `do\r` — a false failure that
        # has nothing to do with the script.
        result = subprocess.run(
            [bash, "-n"],
            input=BASH.read_bytes(),
            capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", "replace"))

    def test_bash_script_installs_every_dependency_surface(self):
        text = BASH.read_text(encoding="utf-8")
        for surface in REQUIRED_SURFACES:
            self.assertIn(surface, text, f"bootstrap.sh never mentions {surface}")

    def test_powershell_script_installs_every_dependency_surface(self):
        text = POWERSHELL.read_text(encoding="utf-8")
        # The PowerShell script discovers the portal CLIs structurally
        # (`.agents\skills` + a `cli\package.json` probe) rather than with a
        # glob, so assert on the parts.
        for part in (".agents", "skills", "cli", "package.json"):
            self.assertIn(part, text, f"bootstrap.ps1 never mentions {part}")

    def test_bash_script_installs_the_engine(self):
        # The specific fix: the engine is its own Bun workspace and needs its
        # own `bun install`, which the old instructions omitted.
        text = BASH.read_text(encoding="utf-8")
        self.assertRegex(text, r"cd applyos.*bun install|applyos.*install --frozen-lockfile")

    def test_powershell_script_installs_the_engine(self):
        text = POWERSHELL.read_text(encoding="utf-8")
        self.assertRegex(text, r"(?i)applyos")

    def test_neither_script_touches_personal_data(self):
        # The candidate's profile, tracker, and archives must never be read,
        # written, or moved by a setup script.
        destructive = re.compile(r"\brm\s+-[a-z]*[rf]|\bRemove-Item\b|\bunlink\b|\brmdir\b")
        for path in (BASH, POWERSHELL):
            text = path.read_text(encoding="utf-8")
            self.assertIsNone(
                destructive.search(text),
                f"{path.name} may delete files",
            )
            # A write into a personal-data zone is the thing to catch.
            for pattern in (r">\s*workspace/", r">\s*output/", r">\s*input/"):
                self.assertIsNone(
                    re.search(pattern, text),
                    f"{path.name} writes into a personal-data zone ({pattern})",
                )

    def test_both_scripts_report_missing_tools_rather_than_failing_silently(self):
        for path in (BASH, POWERSHELL):
            text = path.read_text(encoding="utf-8")
            self.assertIn("lualatex", text, f"{path.name} does not check for lualatex")
            self.assertIn("moderncv", text, f"{path.name} does not check for moderncv")

    def test_bash_script_resolves_bun_in_its_windows_form(self):
        # Git Bash inherits the Windows PATH; WSL does not. A Windows install
        # may only be reachable as `bun.exe`.
        text = BASH.read_text(encoding="utf-8")
        self.assertIn("bun.exe", text)

    def test_the_scripts_are_referenced_by_the_setup_instructions(self):
        readme = (REPO / "README.md").read_text(encoding="utf-8")
        setup = (REPO / "SETUP.md").read_text(encoding="utf-8")
        self.assertIn("bootstrap.sh", readme)
        self.assertIn("bootstrap.sh", setup)

    def test_the_readme_documents_the_engine_install_step(self):
        readme = (REPO / "README.md").read_text(encoding="utf-8")
        setup = (REPO / "SETUP.md").read_text(encoding="utf-8")
        for text in (readme, setup):
            self.assertIn("applyos", text)
            self.assertIn("--frozen-lockfile", text)


if __name__ == "__main__":
    unittest.main()
