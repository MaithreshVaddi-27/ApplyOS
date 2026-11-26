// Phase 7.7 — applyos tracker list|set|migrate, over the shared contract.
import { expect, test } from "bun:test";
import { loadTrackerFile, migrateTracker, readTracker, TRACKER_COLUMNS, writeTracker } from "@applyos/core";

const HEADER = TRACKER_COLUMNS.join(",");
const ROW = "2026-11-20,Acme,tech,Engineer,full-time,portal,applied,c,8,n,cv,,,2026-12-01";

test("list reads the tracker without changing it", () => {
  const doc = readTracker(`${HEADER}\n${ROW}\n`);
  expect(doc.rows).toHaveLength(1);
  expect(doc.rows[0].status).toBe("applied");
  expect(doc.version).toBe(1);
});

test("set is byte-preserving and idempotent through the shared writer", () => {
  const once = writeTracker(readTracker(`${HEADER}\n${ROW}\n`), { company: "Acme", role: "Engineer", status: "interview" });
  const twice = writeTracker(readTracker(once), { company: "Acme", role: "Engineer", status: "interview" });
  expect(twice).toBe(once);
  expect(once.split("\n")[1]).toContain(",interview,");
});

test("migrate is dry-run by default (pure) and versioned", () => {
  const csv = `${HEADER}\n${ROW}\n`;
  expect(migrateTracker(1, 2, csv)).toBe(csv);
  expect(() => migrateTracker(3, 4, csv)).toThrow(/no migration/);
});

test("a missing version sidecar means version 1", () => {
  const doc = loadTrackerFile("no-such-tracker.csv", "no-such-sidecar");
  expect(doc.version).toBe(1);
  expect(doc.rows).toHaveLength(0);
});
