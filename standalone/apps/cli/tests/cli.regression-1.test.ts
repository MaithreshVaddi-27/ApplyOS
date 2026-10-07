// Regression: ISSUE-001 — list flags must not consume the next option as their value.
// Found by /qa on 2026-10-07
// Report: .gstack/qa-reports/run-20261007T000000Z/qa-report-standalone-apply-2026-10-07.md
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "..", "src", "cli.ts");
const cliDirectory = join(import.meta.dir, "..");

for (const flag of ["--skills", "--locations"]) {
  test(`${flag} without a value is rejected instead of consuming the next flag`, () => {
    const result = spawnSync(
      process.execPath,
      ["run", cliPath, "apply", "https://example.com/jobs/qa-cli", "--description", "synthetic job", flag, "--format", "json"],
      { cwd: cliDirectory, encoding: "utf8", timeout: 30_000 },
    );

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toEqual({
      error: `${flag} requires a value`,
      code: "missing-arg",
    });
  });
}
