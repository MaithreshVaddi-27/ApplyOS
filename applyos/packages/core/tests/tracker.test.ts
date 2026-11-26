// Phase 7.1–7.3 — the one tracker schema, byte-preserving writer and migration.
import { expect, test } from "bun:test";
import {
  FINAL_STATUSES,
  isFinalStatus,
  LEGACY_STATUS_ALIASES,
  migrateTracker,
  normalizeStatus,
  readTracker,
  splitCsvLine,
  TRACKER_SCHEMA_VERSION,
  writeTracker,
} from "../src/tracker";
import { TRACKER_COLUMNS, TRACKER_STATUSES } from "../src/contract";

const HEADER = TRACKER_COLUMNS.join(",");
const ROW = "2026-11-20,Acme,tech,Engineer,full-time,portal,applied,contact@example,8,\"has, comma\",cv.pdf,,https://x,2026-12-01";
const CSV = `${HEADER}\n${ROW}\n`;

test("the 14 columns and their order are frozen", () => {
  expect(TRACKER_COLUMNS).toHaveLength(14);
  expect(TRACKER_COLUMNS[11]).toBe("cover_letter_file");
  expect(TRACKER_COLUMNS[13]).toBe("deadline");
  expect(TRACKER_STATUSES).toHaveLength(9);
  for (const s of Object.values(LEGACY_STATUS_ALIASES)) expect(TRACKER_STATUSES).toContain(s);
  expect(TRACKER_STATUSES).not.toContain("interview_only");
  expect(FINAL_STATUSES).toHaveLength(5);
  expect(isFinalStatus("no response")).toBe(true);
  expect(isFinalStatus("drafted")).toBe(false);
});

test("legacy spellings normalise on read and are never written", () => {
  expect(normalizeStatus(" no response ")).toBe("no_response");
  expect(normalizeStatus("Offer Declined")).toBe("offer_declined");
  expect(normalizeStatus("applied")).toBe("applied");
  const doc = readTracker(`${HEADER}\n2026-11-20,Acme,t,r,f,p,no response,c,8,n,cv,,,`);
  expect(doc.rows[0].status).toBe("no_response");
  expect(doc.lines[1]).toContain("no response");
});

test("the writer touches only the named columns, byte for byte", () => {
  const doc = readTracker(CSV);
  const out = writeTracker(doc, { company: "Acme", role: "Engineer", status: "interview" });
  // Compare with a CSV-aware split: a naive split breaks inside quoted commas.
  const beforeFields = splitCsvLine(ROW);
  const afterFields = splitCsvLine(out.split("\n")[1]);
  for (let i = 0; i < beforeFields.length; i++) {
    if (i !== 6) expect(afterFields[i]).toBe(beforeFields[i]);
  }
  expect(afterFields[10]).toBe("cv.pdf");
  expect(afterFields[11]).toBe("");
  expect(afterFields[9]).toBe("has, comma");
  // The raw encoding of the untouched quoted field survives exactly.
  expect(out.split("\n")[1]).toContain('"has, comma"');
  // A deliberately odd field that a re-encode would normalise stays verbatim.
  const odd = `${HEADER}\n2026-11-20,Acme,t,r,f,p,applied,c,8,  padded  ,cv,,,`;
  const oddOut = writeTracker(readTracker(odd), { company: "Acme", role: "r", status: "offer" });
  expect(oddOut.split("\n")[1]).toContain(",  padded  ,");
});

test("updates are idempotent", () => {
  const once = writeTracker(readTracker(CSV), { company: "Acme", role: "Engineer", status: "offer" });
  const twice = writeTracker(readTracker(once), { company: "Acme", role: "Engineer", status: "offer" });
  expect(twice).toBe(once);
});

test("an unknown status and an absent row fail loudly", () => {
  expect(() => writeTracker(readTracker(CSV), { company: "Acme", role: "Engineer", status: "maybe" })).toThrow(/not one of/);
  expect(() => writeTracker(readTracker(CSV), { company: "Other", role: "Engineer", status: "offer" })).toThrow(/no row for/);
  expect(() => readTracker("a,b,c\n1,2,3")).toThrow(/14 canonical columns/);
});

test("migrations are pure, explicit and refuse to lose information", () => {
  expect(migrateTracker(1, 1, CSV)).toBe(CSV);
  expect(migrateTracker(1, 2, CSV)).toBe(CSV);
  expect(migrateTracker(1, 2, CSV)).toBe(migrateTracker(1, 2, CSV));
  expect(() => migrateTracker(2, 1, CSV)).toThrow(/cannot migrate/);
  expect(() => migrateTracker(1, 3, CSV)).toThrow(/no migration/);
  const unknown = `${HEADER}\n2026-11-20,Acme,t,r,f,p,possibly,c,8,n,cv,,,`;
  expect(() => migrateTracker(1, 2, unknown)).toThrow(/unknown status/);
});
