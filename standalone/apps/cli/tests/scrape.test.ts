// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { applyStageFilters } from "../src/scrape";
import { collapseReqSpread } from "../../../packages/core/src/dedupe";
import type { JobPosting } from "../../../packages/core/src/index";

const row = (over: Partial<JobPosting> = {}): JobPosting => ({
  id: "1",
  title: "SDE Intern",
  company: "Example",
  location: "Bengaluru",
  postedDate: "2026-10-01",
  url: "https://example.com/jobs/11111111",
  portal: "mock",
  source: "adapter",
  ...over,
});

describe("applyStageFilters", () => {
  const rows = [
    row(),
    row({ id: "2", title: "Senior Backend", url: "https://example.com/jobs/22222222" }),
    row({ id: "3", title: "Frontend Intern", location: "Remote", url: "https://example.com/jobs/33333333" }),
  ];
  test("student keeps internships only", () => {
    expect(applyStageFilters(rows, { stage: "student" })).toHaveLength(2);
  });
  test("remote-global keeps remote rows", () => {
    expect(applyStageFilters(rows, { stage: "remote-global" })).toHaveLength(1);
  });
  test("explicit location overrides remote-global", () => {
    expect(applyStageFilters(rows, { stage: "remote-global", location: "bengaluru" })).toHaveLength(2);
  });
  test("jobage flags stale rows", () => {
    const now = new Date("2026-10-07T00:00:00Z");
    void now;
    expect(applyStageFilters([row({ postedDate: "2026-01-01" })], { jobage: 30 })).toHaveLength(0);
  });
  test("type jobs overrides student default", () => {
    expect(applyStageFilters(rows, { stage: "student", type: "jobs" })).toHaveLength(3);
  });
});

describe("interleave", () => {
  test("round-robins pools so no source starves the slice", async () => {
    const { interleave } = await import("../src/scrape");
    const a = [row({ id: "a1" }), row({ id: "a2" }), row({ id: "a3" })];
    const b = [row({ id: "b1" })];
    const [out] = interleave([a, b]);
    expect(out.map((r) => r.id)).toEqual(["a1", "b1", "a2", "a3"]);
  });
});

describe("collapseReqSpread company guard", () => {
  test("same numeric id on different companies stays separate", () => {
    const rows = [
      row({ company: "Alpha", url: "https://a.com/jobs/12345678" }),
      row({ company: "Beta", url: "https://b.com/jobs/12345678", id: "2" }),
    ];
    const { rows: out, collapsed } = collapseReqSpread(rows);
    expect(out).toHaveLength(2);
    expect(collapsed).toBe(0);
  });
});
