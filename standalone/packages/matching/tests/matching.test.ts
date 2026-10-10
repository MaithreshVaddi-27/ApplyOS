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
  test("stale gate fails old rows, flags undated", () => {
    expect(staleGate(posting(), 30).verdict).toBe("PASS");
    expect(staleGate(posting({ postedDate: daysAgo(90) }), 30).verdict).toBe("FAIL");
    expect(staleGate(posting({ postedDate: null }), 30).verdict).toBe("FLAG");
  });
  test("location gate respects accepted set and spelling variants", () => {
    expect(locationGate(posting(), student).verdict).toBe("PASS");
    expect(locationGate(posting({ location: "Mumbai" }), student).verdict).toBe("FAIL");
    expect(locationGate(posting({ location: "Bangalore" }), student).verdict).toBe("PASS");
    expect(locationGate(posting(), { ...student, locations: [] }).verdict).toBe("PASS");
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
  test("stipend gate fails below floor, flags unstated", () => {
    expect(stipendGate("stipend ₹15000 per month", student).verdict).toBe("FAIL");
    expect(stipendGate("stipend ₹30000 per month", student).verdict).toBe("PASS");
    expect(stipendGate("great team, apply now", student).verdict).toBe("FLAG");
  });
  test("ctc gate flags (never fails)", () => {
    const c: Candidate = { stage: "experienced", skills: [], locations: [], ctcFloor: 12 };
    expect(ctcGate("CTC 8 LPA fixed", c).verdict).toBe("FLAG");
    expect(ctcGate("CTC 20 LPA", c).verdict).toBe("PASS");
  });
  test("bond gate flags quoted terms", () => {
    const r = bondGate("2 year service agreement applies");
    expect(r.verdict).toBe("FLAG");
    expect(r.note).toContain("service agreement");
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
  test("weights shift by stage", () => {
    expect(weightsFor("student").freshness).toBeGreaterThan(weightsFor("experienced").freshness);
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
    expect(s.verdict).toBe("strong fit");
    expect(s.strengths.length).toBeGreaterThan(0);
  });
  test("weak fit on thin match carries gaps", () => {
    const aged = posting({ postedDate: daysAgo(60) });
    const cand: Candidate = { stage: "student", skills: ["python", "go", "rust"], locations: ["Bengaluru"] };
    const g = runGates(aged, "unrelated work", cand, 90);
    expect(g.pass).toBe(true);
    const s = scorePosting(g, cand);
    expect(s.verdict).toBe("weak fit");
    expect(s.gaps.length).toBeGreaterThan(0);
  });
});
