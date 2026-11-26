// Origin: clean-room 2026-10-07, own fixtures, stubbed pool (no network). Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { runRank } from "../src/rank";
import type { JobPosting } from "@applyos/core";

const pool: JobPosting[] = [
  {
    id: "1", title: "Python Backend Intern", company: "A", location: "Bengaluru",
    postedDate: new Date().toISOString().slice(0, 10), url: "https://a/1", portal: "mock", source: "adapter",
  },
  {
    id: "2", title: "Java Senior Engineer", company: "B", location: "Mumbai",
    postedDate: new Date().toISOString().slice(0, 10), url: "https://b/2", portal: "mock", source: "adapter",
  },
  {
    id: "3", title: "Python Backend Engineer", company: "C", location: "Bengaluru",
    postedDate: "2020-01-01", url: "https://c/3", portal: "mock", source: "adapter",
  },
];

describe("runRank", () => {
  test("gates then scores survivors in order", async () => {
    const r = await runRank({
      stage: "fresher",
      skills: ["python", "backend"],
      locations: ["Bengaluru"],
      searchFn: async () => ({ results: pool }),
    });
    expect(r.ranked.length).toBe(2);
    expect(r.ranked[0].posting.id).toBe("1");
    // Staleness is a flag in the spec, not a veto: posting 3 is old but
    // otherwise fit, so it stays on the shortlist with an advisory.
    const old = r.ranked.find((x) => x.posting.id === "3")!;
    expect(old.explanation.notes.some((n) => /freshness advisory/.test(n))).toBe(true);
    expect(r.rejected.length).toBe(1);
    expect(r.rejected.map((x) => x.posting.id)).toEqual(["2"]);
    expect(r.ranked[0].explanation.modelVersion).toBe("1.0.0");
  });
  test("JSON output carries the explanation and the model version", async () => {
    const r = await runRank({
      stage: "fresher",
      skills: ["python"],
      locations: ["Bengaluru"],
      searchFn: async () => ({ results: pool.slice(0, 1) }),
    });
    const json = JSON.parse(JSON.stringify({ ranked: r.ranked, rejected: r.rejected, elapsedMs: r.elapsedMs }));
    const row = json.ranked[0];
    expect(row.modelVersion).toBe("1.0.0");
    expect(row.explanation.band.name).toBe(row.verdict);
    expect(row.explanation.dimensions).toHaveLength(4);
    expect(row.explanation.modelVersion).toBe("1.0.0");
  });
});
