// Origin: clean-room 2026-10-11, offline (flag validation fails before any fetch). Author: OpenCode agent.
// --type/--stage accept only their documented vocabularies; anything else
// fails loudly instead of silently falling through to a default.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const cliPath = join(import.meta.dir, "..", "src", "cli.ts");
const cliDirectory = join(import.meta.dir, "..");

function run(...args: string[]) {
  return spawnSync(process.execPath, ["run", cliPath, ...args], {
    cwd: cliDirectory,
    encoding: "utf8",
    timeout: 30_000,
  });
}

function expectFail(result: ReturnType<typeof run>, error: string, code: string): void {
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr)).toEqual({ error, code });
}

test("scrape --type bogus fails with bad-type", () => {
  expectFail(
    run("scrape", "--type", "bogus", "--format", "json"),
    "--type must be jobs|internships|all (got bogus)",
    "bad-type",
  );
});

test("rank --type bogus fails with bad-type", () => {
  expectFail(
    run("rank", "--type", "bogus", "--format", "json"),
    "--type must be jobs|internships|all (got bogus)",
    "bad-type",
  );
});

test("apply --stage bogus fails with bad-stage before any fetch", () => {
  expectFail(
    run("apply", "https://example.com/jobs/1", "--stage", "bogus", "--format", "json"),
    "--stage must be student|fresher|experienced|remote-global (got bogus)",
    "bad-stage",
  );
});

test("apply --batch --stage bogus fails with bad-stage without touching the file", () => {
  expectFail(
    run("apply", "--batch", "missing.json", "--stage", "bogus", "--format", "json"),
    "--stage must be student|fresher|experienced|remote-global (got bogus)",
    "bad-stage",
  );
});
