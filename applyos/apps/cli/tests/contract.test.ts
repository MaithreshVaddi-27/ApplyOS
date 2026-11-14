// Phase 2 (docs/PROJECT_BLUEPRINT.md) — the `applyos contract` command.
//
// The contract is how the spec layer reaches the core: an agent reads the
// field names rather than guessing them. A guessed field name produces
// wrong data silently, which is the failure class this project exists to
// prevent.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { contractDocument } from "@applyos/core";

const cliPath = join(import.meta.dir, "..", "src", "cli.ts");
const cliDirectory = join(import.meta.dir, "..");

function runContract(format: string) {
  const result = spawnSync(process.execPath, ["run", cliPath, "contract", "--format", format], {
    cwd: cliDirectory,
    encoding: "utf8",
    timeout: 30_000,
  });
  expect(result.error).toBeUndefined();
  return result;
}

test("the contract document names every boundary shape", () => {
  const doc = contractDocument();
  const shapes = doc.shapes as Record<string, unknown>;
  for (const name of ["providerEnvelope", "providerResult", "jobPosting", "sourceNote", "seenEntry"]) {
    expect(shapes[name]).toBeDefined();
  }
});

test("the contract states the tracker columns and statuses", () => {
  const doc = contractDocument();
  const tracker = doc.tracker as { columns: string[]; statuses: string[] };
  expect(tracker.columns).toContain("cover_letter_file");
  expect(tracker.statuses).toEqual([
    "drafted", "applied", "interview", "offer", "hired", "rejected",
    "no_response", "offer_declined", "withdrawn",
  ]);
});

test("the contract points at the spec for the scoring tables, not at a copy", () => {
  const doc = contractDocument();
  const scoring = doc.scoringSource as Record<string, string>;
  expect(scoring.dimensions).toContain("04-job-evaluation.md");
  expect(scoring.parityCommand).toContain("spec_parity.py");
});

test("applyos contract --format json emits the document", () => {
  const result = runContract("json");
  expect(result.status).toBe(0);
  const parsed = JSON.parse(result.stdout);
  expect(parsed.contractVersion).toBe(1);
  expect(parsed.shapes.providerResult.fields.length).toBeGreaterThan(0);
});

test("applyos contract --format plain lists every field", () => {
  const result = runContract("plain");
  expect(result.status).toBe(0);
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  // providerEnvelope(3) + providerResult(6) + jobPosting(8) + sourceNote(4) + seenEntry(16)
  expect(lines.length).toBeGreaterThan(30);
  for (const line of lines) {
    expect(line.split("\t").length).toBe(4);
  }
});

test("the three date field names are all documented, because they differ", () => {
  const doc = contractDocument();
  const shapes = doc.shapes as Record<string, { fields: { name: string }[] }>;
  const names = (shape: string) => shapes[shape].fields.map((f) => f.name);
  expect(names("providerResult")).toContain("date");
  expect(names("jobPosting")).toContain("postedDate");
  expect(names("seenEntry")).toContain("posted_date");
});
