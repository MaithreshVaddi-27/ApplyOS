// Phase 5.2 — the explanation is a first-class, machine-checkable artifact.
import { expect, test } from "bun:test";
import {
  explainedScore,
  explainDimensions,
  notEvaluated,
  type ScoreExplanation,
} from "../src/explain";

const zeroBand = { name: "Poor Fit", min: 0 };

test("contributions sum to the score, with one decimal of slack before rounding", () => {
  const dimensions = explainDimensions([
    { name: "technical", canonicalWeight: 0.3, raw: 0.9, evidence: "python appears in the posting" },
    { name: "experience", canonicalWeight: 0.2, raw: 0.6, evidence: "Backend Engineer" },
    { name: "behavioral", canonicalWeight: 0.15, raw: 0.8, evidence: "collaborative team" },
    { name: "career", canonicalWeight: 0.35, raw: 0.7, evidence: "backend trajectory" },
  ]);
  const explanation: ScoreExplanation = { dimensions, band: zeroBand, gates: [], modelVersion: "1.0.0", notes: [] };
  expect(dimensions.reduce((n, d) => n + d.weight, 0)).toBeCloseTo(1);
  expect(explainedScore(explanation)).toBe(76);
  expect(explainedScore(explanation)).toBe(Math.round(100 * dimensions.reduce((n, d) => n + d.contribution, 0)));
});

test("an unevaluated dimension is removed from the denominator, not scored zero", () => {
  const dimensions = explainDimensions([
    { name: "technical", canonicalWeight: 0.3, raw: 1, evidence: "python" },
    { name: "experience", canonicalWeight: 0.2, raw: 1, evidence: "" },
    { name: "behavioral", canonicalWeight: 0.15, raw: 1, evidence: "" },
    { name: "career", canonicalWeight: 0.35, raw: 1, evidence: "backend" },
  ]);
  const experience = dimensions.find((d) => d.name === "experience")!;
  expect(experience.status).toBe("not evaluated");
  expect(experience.weight).toBe(0);
  expect(experience.canonicalWeight).toBe(0.2);
  expect(experience.contribution).toBe(0);
  expect(experience.evidence).toMatch(/not evaluated/);
  const technical = dimensions.find((d) => d.name === "technical")!;
  expect(technical.weight).toBeCloseTo(0.3 / 0.65);
  expect(dimensions.reduce((n, d) => n + d.weight, 0)).toBeCloseTo(1);
});

test("a not-evaluated row never invents evidence", () => {
  const row = notEvaluated("career", 0.3);
  expect(row.evidence).toMatch(/not evaluated/);
  expect(row.raw).toBe(0);
  expect(row.canonicalWeight).toBe(0.3);
});
