// Origin: clean-room 2026-10-07, own fixtures, stubbed pool (no network). Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { runRank } from "../src/rank";
import type { JobPosting } from "../../../packages/core/src/index";

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
    expect(r.ranked.length).toBe(1);
    expect(r.ranked[0].posting.id).toBe("1");
    expect(r.rejected.length).toBe(2);
    expect(r.rejected.map((x) => x.posting.id).sort()).toEqual(["2", "3"]);
    expect(r.ranked[0].score).toBeGreaterThanOrEqual(r.ranked[0].score);
  });
});
