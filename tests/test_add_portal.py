"""Phase 4.9: /add-portal scaffolds an SDK-based provider.

The generator used to point at linkedin-search as a copy-paste reference, which
produced one parser per skill. ADR-0008 requires one board implementation in the
provider SDK with thin CLI/engine surfaces. This test derives its assertions
from the canonical spec, so a drift between the spec and that decision fails
here rather than producing a new duplicate parser.

The portal-skill contract (ADR-0006) is deliberately NOT re-asserted here: it is
unchanged, and its own tests cover it. This file guards only the internal shape.
"""

import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SPEC = REPO_ROOT / ".claude" / "commands" / "add-portal.md"
POINTER = REPO_ROOT / ".opencode" / "command" / "add-portal.md"
SDK_EXAMPLE = REPO_ROOT / "applyos" / "packages" / "provider" / "src" / "remoteok.ts"
CLI_EXAMPLE = REPO_ROOT / ".agents" / "skills" / "remoteok-search" / "cli" / "src" / "helpers.ts"
REGISTRY = REPO_ROOT / "applyos" / "packages" / "provider" / "registry.yaml"


class AddPortalSdkTests(unittest.TestCase):
    def setUp(self):
        self.text = SPEC.read_text(encoding="utf-8")

    def test_canonical_examples_are_the_sdk_and_a_thin_cli(self):
        self.assertIn("applyos/packages/provider/src/remoteok.ts", self.text)
        self.assertIn(".agents/skills/remoteok-search/cli/src/helpers.ts", self.text)

    def test_step_3a_requires_one_sdk_implementation(self):
        self.assertIn("Step 3a", self.text)
        self.assertIn("applyos/packages/provider/src/<board>.ts", self.text)
        self.assertIn("create<Board>Provider", self.text)
        self.assertIn("Export it from `applyos/packages/provider/src/index.ts`", self.text)

    def test_the_cli_imports_the_sdk_by_relative_path(self):
        self.assertIn("../../../../../applyos/packages/provider/src/<board>.js", self.text)
        self.assertIn("dependency-free", self.text)

    def test_registration_targets_the_unified_registry(self):
        self.assertIn("applyos/packages/provider/registry.yaml", self.text)
        self.assertIn("Do not add a second registry entry elsewhere", self.text)

    def test_the_shared_contract_gate_is_mandatory(self):
        self.assertIn("contractSuite", self.text)
        self.assertIn("cd applyos && bun test", self.text)

    def test_the_spec_no_longer_says_to_copy_linkedin_parsing(self):
        # linkedin-search may still be named as a worked example of the CLI
        # contract, but it must not be the canonical reference to copy from.
        self.assertNotIn("Canonical reference:** read `.agents/skills/linkedin-search/`", self.text)

    def test_the_thin_pointer_still_delegates_to_the_canonical_spec(self):
        pointer = POINTER.read_text(encoding="utf-8")
        self.assertIn(".claude/commands/add-portal.md", pointer)
        self.assertIn("exactly", pointer)

    def test_the_canonical_examples_actually_exist(self):
        self.assertTrue(SDK_EXAMPLE.is_file())
        self.assertTrue(CLI_EXAMPLE.is_file())
        self.assertTrue(REGISTRY.is_file())


if __name__ == "__main__":
    unittest.main()
