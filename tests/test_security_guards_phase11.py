"""Phase 11.5 — negative tests for the two new guards."""

import json

from tests.test_security_guards import GuardRepoFixture, run_guards


class SpecNetworkGuardTests(GuardRepoFixture):
    def test_direct_curl_in_a_spec_fails(self):
        spec = self.root / ".claude" / "commands" / "demo.md"
        spec.parent.mkdir(parents=True, exist_ok=True)
        spec.write_text("curl https://example.test/page\n", encoding="utf-8")
        result = run_guards(self.root)
        self.assertEqual(result.returncode, 1)
        self.assertIn("direct curl/wget invocation in a spec", result.stdout)

    def test_posix_only_shell_chaining_in_a_spec_fails(self):
        spec = self.root / ".claude" / "skills" / "demo" / "SKILL.md"
        spec.parent.mkdir(parents=True, exist_ok=True)
        spec.write_text('cd "$SCRATCHPAD" && curl https://example.test\n', encoding="utf-8")
        result = run_guards(self.root)
        self.assertEqual(result.returncode, 1)
        self.assertIn("POSIX-only", result.stdout)

    def test_the_cross_platform_helper_is_allowed(self):
        spec = self.root / ".claude" / "commands" / "demo.md"
        spec.parent.mkdir(parents=True, exist_ok=True)
        spec.write_text("python tools/fetch_page.py https://example.test --out page.html\n", encoding="utf-8")
        result = run_guards(self.root)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


class ZeroDependencyGuardTests(GuardRepoFixture):
    def test_a_provider_cli_runtime_dependency_fails(self):
        self.write_manifest({
            "name": "example-cli",
            "scripts": {"start": "bun run src/cli.ts"},
            "dependencies": {"left-pad": "1.0.0"},
        })
        result = run_guards(self.root)
        self.assertEqual(result.returncode, 1)
        self.assertIn("zero-dependency contract", result.stdout)

    def test_a_dev_dependency_is_allowed(self):
        self.write_manifest({
            "name": "example-cli",
            "scripts": {"start": "bun run src/cli.ts"},
            "devDependencies": {"typescript": "5.9.3"},
        })
        result = run_guards(self.root)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
