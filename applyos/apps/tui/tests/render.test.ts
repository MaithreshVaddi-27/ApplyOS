// Phase 10.3 — the TUI is pure and read-only.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderDetail, renderEmpty, renderPipeline, renderShortlist, type ShortlistRow } from "../src/render";
import { buildSnapshot } from "@applyos/core";

const snapshot = buildSnapshot("no-such-tracker.csv");
const rows: ShortlistRow[] = [
  { id: "1", title: "Backend Engineer", company: "A", score: 82, band: "Strong Fit", gaps: ["kubernetes"] },
  { id: "2", title: "Frontend Engineer", company: "B", score: 50, band: "Moderate Fit", gaps: ["sql"] },
];

test("pipeline groups by status from the shared schema", () => {
  const out = renderPipeline(snapshot).join("\n");
  expect(out).toContain("PIPELINE");
  expect(out).toContain("0 row(s)");
});

test("shortlist filter by band and gap is read-only", () => {
  expect(renderShortlist(rows).join("\n")).toContain("2 of 2");
  expect(renderShortlist(rows, { band: "Strong Fit" }).join("\n")).toContain("1 of 2");
  expect(renderShortlist(rows, { gap: "kubernetes" }).join("\n")).toContain("Backend Engineer");
  expect(renderShortlist(rows, { gap: "kubernetes" }).join("\n")).not.toContain("Frontend Engineer");
});

test("detail shows dimensions, gates, quoted evidence and gaps", () => {
  const out = renderDetail(rows[0], {
    dimensions: [{ name: "technical", raw: 0.9, contribution: 0.27, evidence: "python", status: "scored" }],
    gates: [{ gate: "eligibility", verdict: "PASS", note: "" }],
    modelVersion: "1.0.0",
  }).join("\n");
  for (const token of ["DIMENSIONS", '"python"', "GATES", "eligibility", "model 1.0.0", "kubernetes"]) {
    expect(out).toContain(token);
  }
});

test("an empty tracker renders a setup hint, not a crash", () => {
  const out = renderEmpty().join("\n");
  expect(out).toContain("/setup");
  expect(out).toContain("read-only");
});

test("the snapshot is deterministic: no wall clock in its shape", () => {
  expect(snapshot.generatedAt).toBeNull();
  expect(JSON.stringify(buildSnapshot("no-such-tracker.csv"))).toBe(JSON.stringify(snapshot));
});

test("the TUI source has no write path", () => {
  const text = readFileSync(new URL("../src/index.ts", import.meta.url), "utf8");
  for (const banned of ["writeFile", "appendFile", "mkdir", "unlink", "tracker set"]) {
    expect(text).not.toContain(banned);
  }
});
