import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { compare, corpusHash, runAll, updateBaseline } from "../runner";
import { runGatesEval } from "../runners/gates";
import { runDedupeEval } from "../runners/dedupe";
import { runDocumentsEval } from "../runners/documents";
import { runRankingEval } from "../runners/ranking";

const load = (s: string) => JSON.parse(readFileSync(`evals/corpus/${s}.json`, "utf8"));

test("every suite runs offline against the committed corpus", () => {
  expect(runGatesEval(load("gates")).labels).toBe(12);
  expect(runDedupeEval(load("dedupe")).labels).toBe(7);
  expect(runDocumentsEval(load("documents")).labels).toBe(3);
  expect(runRankingEval(load("ranking")).labels).toBe(6);
});

test("the headline gate metric is measured, not assumed", () => {
  const r = runGatesEval(load("gates"));
  expect(r.metrics.falseRejectRate).toBe(0);
  // The corpus contains a false accept the gates did not veto — proof the
  // evaluation measures the contract rather than rubber-stamping it.
  expect(r.metrics.falseAcceptRate).toBeGreaterThan(0);
  expect(r.distribution.eligibility).toEqual([0, 1, 0]);
});

test("the dedupe corpus exposes the false-merge edge", () => {
  const r = runDedupeEval(load("dedupe"));
  expect(r.metrics.recall).toBe(1);
  expect(r.distribution["shared-id-different-company"][1]).toBe(1);
  expect(r.distribution["date-shaped-segment"][1]).toBe(1);
});

test("the document metrics come from manifests and extracted text", () => {
  const r = runDocumentsEval(load("documents"));
  expect(r.metrics.claimInPdfRate).toBeCloseTo(0.8);
  expect(r.metrics.ungroundedRate).toBeGreaterThan(0);
  expect(r.metrics.pageBudgetCompliance).toBeCloseTo(2 / 3);
});

test("ranking is invariant to input row order", () => {
  const r = runRankingEval(load("ranking"));
  expect(r.metrics.spearman).toBe(1);
  expect(r.metrics.topKOverlap).toBe(1);
  expect(r.metrics.bandChurn).toBe(0);
  expect(r.metrics.scoreSigma).toBe(0);
});

test("the committed baseline matches a fresh run with no breaches", () => {
  const { results, baseline, breaches } = runAll();
  expect(results).toHaveLength(4);
  expect(breaches).toEqual([]);
  expect(baseline.corpusHash).toBe(corpusHash());
  expect(updateBaseline(results).corpusHash).toBe(baseline.corpusHash);
});

test("a metric outside its tolerance is a breach", () => {
  const { results, baseline } = runAll();
  const moved = structuredClone(baseline);
  moved.suites.gates.metrics.falseRejectRate = 0.5;
  expect(compare(results, moved).some((b) => b.includes("gates.falseRejectRate"))).toBe(true);
  expect(compare(results, baseline)).toEqual([]);
});
