// Phase 3 (docs/PROJECT_BLUEPRINT.md) — the shared framework modules.
//
// Three contracts, one file each:
//   scoring.ts — the canonical tables, read from framework/scoring.json
//   errors.ts  — the error vocabulary both layers emit
//   state.ts   — the seen-store format, its version, and its migration
import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SCORING, stageWeights, bandFor, gateDefinition, gateRunsFor, GATES, BANDS, DIMENSIONS,
  isKnownCode, normaliseCode, isRetryable, errorSpec,
  SEEN_STORE_VERSION, migrate, normaliseLegacyLocation, readSeenStore, writeSeenStore,
} from "../src/index";

// --- scoring -------------------------------------------------------------

test("the canonical tables load from framework/scoring.json", () => {
  expect(SCORING.dimensions).toEqual(["technical", "experience", "behavioral", "career"]);
  expect(DIMENSIONS.length).toBe(4);
  expect(Object.keys(SCORING.stageWeights).sort()).toEqual(
    ["experienced", "fresher", "remote-global", "student"],
  );
});

test("every stage's weights sum to one", () => {
  for (const [stage, weights] of Object.entries(SCORING.stageWeights)) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 6);
    expect(Object.keys(weights).sort()).toEqual([...DIMENSIONS].sort());
    expect(stage).toBeTruthy();
  }
});

test("the student row gives career the largest weight, per the spec", () => {
  const student = stageWeights("student");
  expect(student?.career).toBe(0.40);
  expect(student?.technical).toBe(0.30);
  expect(student?.experience).toBe(0.15);
});

test("the bands are the spec's five, strongest first", () => {
  expect(BANDS.map((b) => b.name)).toEqual([
    "Strong Fit", "Good Fit", "Moderate Fit", "Weak Fit", "Poor Fit",
  ]);
  expect(bandFor(80).name).toBe("Strong Fit");
  expect(bandFor(75).name).toBe("Strong Fit");
  expect(bandFor(74).name).toBe("Good Fit");
  expect(bandFor(60).name).toBe("Good Fit");
  expect(bandFor(45).name).toBe("Moderate Fit");
  expect(bandFor(30).name).toBe("Weak Fit");
  expect(bandFor(29).name).toBe("Poor Fit");
  expect(bandFor(0).name).toBe("Poor Fit");
});

test("the canonical gate list is the spec's nine", () => {
  expect(GATES.map((g) => g.id)).toEqual([
    "eligibility", "language", "stipend", "batch", "bond",
    "notice-period", "compensation", "timezone-overlap", "location",
  ]);
});

test("the eligibility gate is a hard stop in the spec", () => {
  expect(gateDefinition("eligibility")?.hardStop).toBe(true);
  expect(gateDefinition("language")?.hardStop).toBe(true);
});

test("the gates are stage-conditional, as the spec states", () => {
  expect(gateRunsFor("stipend", "student", "india")).toBe(true);
  expect(gateRunsFor("stipend", "student", "global")).toBe(false);
  expect(gateRunsFor("stipend", "fresher", "india")).toBe(false);
  expect(gateRunsFor("batch", "fresher", "global")).toBe(true);
  expect(gateRunsFor("notice-period", "experienced", "global")).toBe(true);
  expect(gateRunsFor("notice-period", "fresher", "global")).toBe(false);
  expect(gateRunsFor("timezone-overlap", "remote-global", "global")).toBe(true);
  expect(gateRunsFor("timezone-overlap", "experienced", "global")).toBe(false);
  expect(gateRunsFor("language", "student", "india")).toBe(true);
});

test("a gate the spec does not define never runs", () => {
  expect(gateRunsFor("quantum-levitation", "student", "india")).toBe(false);
});

// --- errors --------------------------------------------------------------

test("both layers' codes are registered", () => {
  expect(isKnownCode("missing-arg")).toBe(true);
  expect(isKnownCode("INVALID_FORMAT")).toBe(true);
  expect(isKnownCode("not-a-real-code")).toBe(false);
});

test("the two conventions normalise to the same form", () => {
  expect(normaliseCode("INVALID_FORMAT")).toBe("invalid-format");
  expect(normaliseCode("invalid-format")).toBe("invalid-format");
  expect(normaliseCode("MISSING_CREDENTIALS")).toBe("missing-credentials");
});

test("retryability is stated, not guessed", () => {
  expect(isRetryable("rate-limited" as string)).toBe(false);
  expect(isRetryable("FETCH_ERROR")).toBe(true);
  expect(isRetryable("INVALID_FORMAT")).toBe(false);
  expect(isRetryable("unknown-code")).toBe(false);
});

test("the credential code is reserved by the contract, not in use", () => {
  const spec = errorSpec("MISSING_CREDENTIALS");
  expect(spec).toBeDefined();
  expect(spec?.reserved).toBe(true);
});

// --- state ---------------------------------------------------------------

test("a store without a version marker is version 1", () => {
  const migrated = migrate({ seen: {} } as never);
  expect(migrated.schemaVersion).toBe(SEEN_STORE_VERSION);
});

test("the legacy location verdict moves to location_verdict", () => {
  const entry = { title: "A", company: "B", location: "PASS" };
  const normalised = normaliseLegacyLocation(entry);
  expect(normalised.location).toBeUndefined();
  expect(normalised.location_verdict).toBe("PASS");
});

test("a real location is left alone", () => {
  const entry = { title: "A", company: "B", location: "Bengaluru, India" };
  const normalised = normaliseLegacyLocation(entry);
  expect(normalised.location).toBe("Bengaluru, India");
  expect(normalised.location_verdict).toBeUndefined();
});

test("a store from a newer version is refused, not misread", () => {
  expect(() => migrate({ schemaVersion: 99, seen: {} } as never)).toThrow(/newer ApplyOS/);
});

test("migrating to an unknown future version is refused", () => {
  expect(() => migrate({ seen: {} } as never, 99)).toThrow(/cannot migrate/);
});

test("a store round-trips through read and write", () => {
  const dir = mkdtempSync(join(tmpdir(), "applyos-state-"));
  const path = join(dir, "seen_jobs.json");
  writeFileSync(path, JSON.stringify({
    seen: { a: { title: "A", company: "B", location: "Bengaluru", posted_date: "2026-10-05" } },
  }), "utf8");

  const store = readSeenStore(path);
  expect(Object.keys(store.seen)).toEqual(["a"]);
  expect(store.schemaVersion).toBe(SEEN_STORE_VERSION);

  writeSeenStore(path, store);
  const written = JSON.parse(readFileSync(path, "utf8"));
  expect(written.seen.a.title).toBe("A");
  expect(written.schemaVersion).toBe(SEEN_STORE_VERSION);
});

test("a missing store reads as empty rather than throwing", () => {
  const dir = mkdtempSync(join(tmpdir(), "applyos-state-"));
  const store = readSeenStore(join(dir, "absent.json"));
  expect(store.seen).toEqual({});
});

test("a malformed store says so", () => {
  const dir = mkdtempSync(join(tmpdir(), "applyos-state-"));
  const path = join(dir, "seen_jobs.json");
  writeFileSync(path, "{not json", "utf8");
  expect(() => readSeenStore(path)).toThrow(/not valid JSON/);
});
