// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import {
  runGates,
  staleGate,
  locationGate,
  languageGate,
  batchGate,
  stipendGate,
  ctcGate,
  bondGate,
  type Candidate,
} from "../src/gates";
import { scorePosting, skillOverlap, titleMatch, weightsFor } from "../src/score";
import type { JobPosting } from "@applyos/core";

const posting = (over: Partial<JobPosting> = {}): JobPosting => ({
  id: "1",
  title: "Backend Intern (Python)",
  company: "Example",
  location: "Bengaluru",
  postedDate: daysAgo(2),
  url: "https://example.com/1",
  portal: "mock",
  source: "adapter",
  ...over,
});

/** ISO date N days before today — fixtures never rot as the calendar moves. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

const student: Candidate = { stage: "student", skills: ["python", "backend"], locations: ["Bengaluru"], gradYear: 2026, stipendFloor: 20000 };

describe("gates", () => {
  test("staleness is an advisory flag, never a veto (Phase 5)", () => {
    expect(staleGate(posting(), 30).verdict).toBe("PASS");
    expect(staleGate(posting({ postedDate: daysAgo(90) }), 30).verdict).toBe("FLAG");
    expect(staleGate(posting({ postedDate: null }), 30).verdict).toBe("FLAG");
    // runGates() runs only the nine gates in framework/scoring.json.
    expect(runGates(posting({ postedDate: daysAgo(90) }), "python role", student, 30).gates.some((g) => g.gate === "stale")).toBe(false);
  });
  test("location gate respects accepted set and spelling variants", () => {
    expect(locationGate(posting(), student).verdict).toBe("PASS");
    expect(locationGate(posting({ location: "Mumbai" }), student).verdict).toBe("FAIL");
    expect(locationGate(posting({ location: "Bangalore" }), student).verdict).toBe("PASS");
    expect(locationGate(posting(), { ...student, locations: [] }).verdict).toBe("PASS");
  });
  test("unstated location fails loudly instead of matching by accident", () => {
    const g = locationGate(posting({ location: null }), student);
    expect(g.verdict).toBe("FAIL");
    expect(g.note).toMatch(/unstated/);
  });
  test("language gate fails non-English requirements", () => {
    expect(languageGate("must be fluent Hindi for client work").verdict).toBe("FAIL");
    expect(languageGate("great communication skills").verdict).toBe("PASS");
    expect(languageGate("must have fluent English communication").verdict).toBe("PASS");
    expect(languageGate("fluent English required, German essential").verdict).toBe("FAIL");
  });
  test("batch gate enforces exclusive windows", () => {
    expect(batchGate("open to 2026 batch only", student).verdict).toBe("PASS");
    expect(batchGate("2025 batch only", student).verdict).toBe("FAIL");
    expect(batchGate("2024/2025 batch preferred", student).verdict).toBe("FLAG");
  });
  test("batch gate passes non-students, missing years, and out-of-window exclusives", () => {
    const experienced: Candidate = { ...student, stage: "experienced" };
    expect(batchGate("2025 batch only", experienced).verdict).toBe("PASS");
    expect(batchGate("2025 batch only", { ...student, gradYear: undefined }).verdict).toBe("PASS");
    expect(batchGate("great team, apply now", student).verdict).toBe("PASS");
    expect(batchGate("class of 2026 welcome", student).verdict).toBe("PASS");
    // An exclusivity word in a *different sentence* is not a batch restriction,
    // however close it sits to the batch clause.
    const otherSentence = "Only 30 engineers work here. We hire 2025 batch grads.";
    expect(batchGate(otherSentence, student).verdict).toBe("FLAG");
  });
  test("batch gate ignores incidental years with no batch word beside them", () => {
    // "2020" here is a rewrite date, not a batch year — it must not gate anyone out.
    const prose = "Our team of only 30 engineers built this. The platform was rewritten in 2020 and we still maintain the legacy service.";
    expect(batchGate(prose, student).verdict).toBe("PASS");
    expect(batchGate("Founded in 2019, we are a 500 person company hiring 2025 batch talent.", student).verdict).toBe("FLAG");
  });
  test("batch gate still fails a genuine exclusive restriction", () => {
    expect(batchGate("Only 2024 batch graduates are eligible for this internship.", student).verdict).toBe("FAIL");
    expect(batchGate("This role is exclusively open to the 2023 batch.", student).verdict).toBe("FAIL");
  });
  test("stipend gate fails below floor, flags unstated", () => {
    expect(stipendGate("stipend ₹15000 per month", student).verdict).toBe("FAIL");
    expect(stipendGate("stipend ₹30000 per month", student).verdict).toBe("PASS");
    expect(stipendGate("great team, apply now", student).verdict).toBe("FLAG");
  });
  test("stipend gate reads a clock time as no stipend, never as an amount", () => {
    // "3 p.m." must never parse as a stipend of 3, which would FAIL the gate.
    const g = stipendGate("Interviews happen at 3 p.m. Sharp. Full-time role.", student);
    expect(g.verdict).toBe("FLAG");
    expect(g.note).toBe("no stipend stated");
  });
  test("stipend gate reads the unit-before-amount phrasing", () => {
    expect(stipendGate("Monthly stipend of INR 20000 for the duration.", student).verdict).toBe("PASS");
    expect(stipendGate("a monthly stipend of 5,000", student).verdict).toBe("FAIL");
  });
  test("ctc gate flags (never fails)", () => {
    const c: Candidate = { stage: "experienced", skills: [], locations: [], ctcFloor: 12 };
    expect(ctcGate("CTC 8 LPA fixed", c).verdict).toBe("FLAG");
    expect(ctcGate("CTC 20 LPA", c).verdict).toBe("PASS");
  });
  test("ctc gate converts a rupee figure and never invents one", () => {
    const c: Candidate = { stage: "experienced", skills: [], locations: [], ctcFloor: 12 };
    expect(ctcGate("CTC of 8,00,000 per annum", c).verdict).toBe("FLAG");
    expect(ctcGate("CTC of 20,00,000 per annum", c).verdict).toBe("PASS");
    // "p.a." here is prose, not a pay unit: the gate must say nothing stated,
    // not fabricate a 0.0 LPA figure.
    const p = ctcGate("Experience in 3 p.a. startups preferred.", c);
    expect(p.verdict).toBe("FLAG");
    expect(p.note).toBe("no CTC stated");
  });
  test("text gates report 'not evaluated' rather than a finding when there is no description", () => {
    // The rank search pass carries no description. Claiming "no stipend stated"
    // there would be a fabricated finding on every ranked posting.
    const c: Candidate = { stage: "student", skills: [], locations: [], gradYear: 2026, stipendFloor: 20000, ctcFloor: 6 };
    for (const g of [languageGate(""), batchGate("   ", c), stipendGate("", c), ctcGate("", c), bondGate("")]) {
      expect(g.verdict).toBe("PASS");
      expect(g.note).toMatch(/not evaluated/);
    }
  });
  test("bond gate flags quoted terms", () => {
    const r = bondGate("2 year service agreement applies");
    expect(r.verdict).toBe("FLAG");
    expect(r.note).toContain("service agreement");
  });
  test("bond gate note stays one table-safe line", () => {
    const r = bondGate("2 year service agreement\nspanning multiple | lines applies");
    expect(r.verdict).toBe("FLAG");
    expect(r.note).not.toContain("\n");
    expect(r.note).not.toMatch(/(?<!\\)\|/);
  });
  test("runGates aggregates pass/fail", () => {
    const ok = runGates(posting(), "python backend role", student, 30);
    expect(ok.pass).toBe(true);
    const bad = runGates(posting({ location: "Mumbai" }), "python role", student, 30);
    expect(bad.pass).toBe(false);
    expect(bad.gates.find((g) => g.gate === "location")?.verdict).toBe("FAIL");
  });
});

describe("score", () => {
  test("weights come from the one canonical table and shift by stage", () => {
    expect(weightsFor("student")).toEqual({ technical: 0.3, experience: 0.15, behavioral: 0.15, career: 0.4 });
    expect(weightsFor("experienced").experience).toBeGreaterThan(weightsFor("student").experience);
    expect(weightsFor("student").freshness).toBeUndefined();
  });
  test("overlap splits hit/miss", () => {
    expect(skillOverlap(["python", "cobol"], "python role")).toEqual({ hit: ["python"], miss: ["cobol"] });
  });
  test("title match echoes target words", () => {
    expect(titleMatch("Backend Intern (Python)", ["python", "backend"])).toBeGreaterThan(0.5);
  });
  test("strong fit on matching survivor", () => {
    const g = runGates(posting(), "python backend developer with great pay", student, 60);
    const s = scorePosting(g, student);
    expect(s.verdict).toBe("Strong Fit");
    expect(s.strengths.length).toBeGreaterThan(0);
  });
  test("weak fit on thin match carries gaps", () => {
    const aged = posting({ postedDate: daysAgo(60) });
    const cand: Candidate = { stage: "student", skills: ["python", "go", "rust"], locations: ["Bengaluru"] };
    const g = runGates(aged, "unrelated work", cand, 90);
    expect(g.pass).toBe(true);
    const s = scorePosting(g, cand);
    expect(s.verdict).toBe("Weak Fit");
    expect(s.gaps.length).toBeGreaterThan(0);
  });
  test("the explanation sums to the score and names the model version", () => {
    const g = runGates(posting(), "python backend developer", student, 60);
    const s = scorePosting(g, student);
    expect(s.modelVersion).toBe("1.0.0");
    expect(s.explanation.modelVersion).toBe(s.modelVersion);
    const sum = s.explanation.dimensions.reduce((n, d) => n + d.contribution, 0);
    expect(Math.round(100 * sum)).toBe(s.score);
    expect(s.explanation.dimensions.map((d) => d.name)).toEqual(["technical", "experience", "behavioral", "career"]);
  });
  test("every scored dimension quotes the posting; unevaluated ones say so", () => {
    const g = runGates(posting(), "python backend developer", student, 60);
    const s = scorePosting(g, student);
    const technical = s.explanation.dimensions.find((d) => d.name === "technical")!;
    expect(technical.evidence.toLowerCase()).toContain("python");
    for (const d of s.explanation.dimensions.filter((x) => x.status === "scored")) {
      expect(d.evidence.trim().length).toBeGreaterThan(0);
      expect(d.contribution).toBeCloseTo(d.weight * d.raw);
    }
    const behavioral = s.explanation.dimensions.find((d) => d.name === "behavioral")!;
    expect(behavioral.status).toBe("not evaluated");
    expect(behavioral.evidence).toMatch(/not evaluated/);
    expect(behavioral.contribution).toBe(0);
    expect(s.gaps.some((x) => x.startsWith("behavioral:"))).toBe(true);
  });
  test("judgment is combined, echoed, and never re-derived", () => {
    const g = runGates(posting(), "python backend developer", student, 60);
    const judgment = {
      version: "rubric-2",
      dimensions: {
        behavioral: { score: 0.8, reason: "works well in a small team" },
        career: { score: 0.9, reason: "the role matches a backend trajectory" },
      },
    };
    const s = scorePosting(g, student, judgment);
    expect(s.explanation.judgmentVersion).toBe("rubric-2");
    expect(s.explanation.dimensions.find((d) => d.name === "behavioral")?.raw).toBe(0.8);
    expect(s.explanation.dimensions.find((d) => d.name === "career")?.raw).toBe(0.9);
    expect(s.explanation.dimensions.filter((d) => d.status === "scored")).toHaveLength(4);
    // Without judgment only the two deterministic dimensions are scored.
    expect(scorePosting(g, student).explanation.dimensions.filter((d) => d.status === "scored")).toHaveLength(2);
    // A judge dimension absent from the input stays unevaluated, not zero.
    const partial = scorePosting(g, student, { version: "rubric-2", dimensions: { behavioral: judgment.dimensions.behavioral } });
    expect(partial.explanation.dimensions.find((d) => d.name === "career")?.status).toBe("not evaluated");
  });
});
