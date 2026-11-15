"""Every error code the repository emits must be registered.

Phase 3 of docs/PROJECT_BLUEPRINT.md. The vocabulary lives in
applyos/packages/core/src/errors.ts. Two layers emit errors and they use
different conventions - the engine uses kebab-case, the provider CLIs use
SCREAMING_CASE - and both are preserved. What this test guarantees is that
neither layer can emit a code nobody has documented.

A code that is not registered has no documented meaning, no retryability,
and no layer attribution. A consumer that meets one cannot act on it. So
the registry has to be exhaustive.
"""

import re
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
VOCABULARY = REPO / "applyos" / "packages" / "core" / "src" / "errors.ts"
ENGINE_ROOT = REPO / "applyos"
PROVIDER_CLI_SRC = REPO / ".agents" / "skills"
PROVIDER_SDK_SRC = REPO / "applyos" / "packages" / "provider" / "src"


def registered_codes() -> dict:
    """The codes the vocabulary declares, with their layer."""
    text = VOCABULARY.read_text(encoding="utf-8")
    found = {}
    for m in re.finditer(r'\{\s*code:\s*"([^"]+)",\s*layer:\s*"(engine|provider)"', text):
        found[m.group(1)] = m.group(2)
    return found


def engine_emitted_codes() -> set:
    """Codes the engine emits: cliFail() calls and the apply flow's map.

    Every package's src/ is scanned, not just core's - the company-scraper's
    own CLI emits codes too, and a scanner that misses it would let an
    unregistered code through.
    """
    codes = set()
    for path in sorted(ENGINE_ROOT.glob("packages/*/src/**/*.ts")) + \
            sorted(ENGINE_ROOT.glob("apps/*/src/**/*.ts")):
        text = path.read_text(encoding="utf-8")
        codes.update(re.findall(r'cliFail\(\s*"([a-zA-Z0-9_-]+)"', text))
        # apply.ts maps a thrown error's message prefix to a code.
        codes.update(re.findall(r'\?\s*"([a-zA-Z0-9_-]+)"\s*\n', text))
    return codes


def provider_emitted_codes() -> set:
    """Codes the provider layer emits.

    Three places name a provider code:

    - the provider CLIs, in writeError(message, code) calls
    - the provider SDK, which maps a ProviderError to the CLI code it becomes
      (applyos/packages/provider/src/errors.ts) - this is where a migrated
      board's codes are actually decided
    - the CLI surfaces that pass a code through from a provider error

    All three are scanned. A scanner that only looked at the CLIs would stop
    seeing a code the moment a board moved behind the SDK, which is exactly
    when a code could slip through unregistered.
    """
    codes = set()
    for path in PROVIDER_CLI_SRC.glob("*/cli/src/**/*.ts"):
        text = path.read_text(encoding="utf-8")
        codes.update(re.findall(r'writeError\(\s*[^,]+,\s*"([A-Z_]+)"', text))
        # A surface that forwards a provider error's code: `err.cliCode`.
        codes.update(re.findall(r'\?\s*err\.cliCode\s*:\s*"([A-Z_]+)"', text))
    for path in sorted(PROVIDER_SDK_SRC.glob("**/*.ts")):
        text = path.read_text(encoding="utf-8")
        # The SDK's CLI_CODE map: provider error code -> the CLI code it
        # becomes. The whole map is read, not just its last entry, so every
        # code a migrated board can produce is checked.
        for block in re.findall(r"CLI_CODE[^=]*=\s*\{(.*?)\}", text, re.S):
            codes.update(re.findall(r':\s*"([A-Z_]+)"', block))
    return codes


class VocabularyTests(unittest.TestCase):
    def test_the_vocabulary_exists_and_declares_codes(self):
        self.assertTrue(VOCABULARY.is_file(), "the error vocabulary is missing")
        codes = registered_codes()
        self.assertGreater(len(codes), 20, "the vocabulary looks empty")
        for code, layer in codes.items():
            self.assertIn(layer, ("engine", "provider"), f"{code} has an odd layer")

    def test_every_engine_code_is_registered(self):
        registered = registered_codes()
        for code in sorted(engine_emitted_codes()):
            self.assertIn(code, registered, f"the engine emits '{code}', which is not registered")
            self.assertEqual(registered[code], "engine",
                             f"'{code}' is emitted by the engine but registered as another layer")

    def test_every_provider_code_is_registered(self):
        registered = registered_codes()
        for code in sorted(provider_emitted_codes()):
            self.assertIn(code, registered, f"a provider emits '{code}', which is not registered")
            self.assertEqual(registered[code], "provider",
                             f"'{code}' is emitted by a provider but registered as another layer")

    def test_the_two_layers_keep_their_own_conventions(self):
        registered = registered_codes()
        engine = [c for c, layer in registered.items() if layer == "engine"]
        provider = [c for c, layer in registered.items() if layer == "provider"]
        self.assertTrue(all("-" in c and c.islower() for c in engine),
                        "engine codes are kebab-case")
        self.assertTrue(all(c.isupper() for c in provider),
                        "provider codes are SCREAMING_CASE")

    def test_the_contract_reserved_credential_code_is_recorded(self):
        """The portal-skill contract names MISSING_CREDENTIALS; no provider emits it yet."""
        codes = registered_codes()
        self.assertIn("MISSING_CREDENTIALS", codes)
        text = VOCABULARY.read_text(encoding="utf-8")
        self.assertIn("reserved: true", text,
                      "MISSING_CREDENTIALS must be marked reserved, not implied to be in use")

    def test_a_code_is_never_registered_twice(self):
        text = VOCABULARY.read_text(encoding="utf-8")
        found = re.findall(r'\{\s*code:\s*"([^"]+)"', text)
        duplicates = {c for c in found if found.count(c) > 1}
        self.assertEqual(duplicates, set(), f"duplicate codes: {sorted(duplicates)}")


if __name__ == "__main__":
    unittest.main()
