// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { dedupeKey, mergePools, collapseReqSpread, normalizeUrl } from "../src/dedupe";
import type { JobPosting } from "../src/types";

const row = (over: Partial<JobPosting> = {}): JobPosting => ({
  id: "1",
  title: "SDE Intern",
  company: "Example",
  location: "Bengaluru",
  postedDate: "2026-10-01",
  url: "https://example.com/jobs/abc-123",
  portal: "mock",
  source: "adapter",
  ...over,
});

describe("dedupeKey", () => {
  test("strips tracking params and fragments", () => {
    expect(dedupeKey(row({ url: "https://example.com/jobs/abc-123?utm_source=x#frag" }))).toBe(
      dedupeKey(row({ url: "https://example.com/jobs/abc-123" })),
    );
  });
  test("falls back to company/title/location when url is empty", () => {
    expect(dedupeKey(row({ url: "" }))).toBe("example|sde intern|bengaluru");
  });
});

describe("mergePools", () => {
  test("first-seen wins and duplicates are counted", () => {
    const a = row();
    const b = row({ portal: "other" });
    const c = row({ id: "2", url: "https://example.com/jobs/other" });
    const { merged, duplicates } = mergePools([[a, c], [b]]);
    expect(merged).toHaveLength(2);
    expect(merged[0].portal).toBe("mock");
    expect(duplicates).toBe(1);
  });
});

describe("collapseReqSpread", () => {
  test("collapses same-req multi-city rows with a spread note", () => {
    const rows = [row({ location: "Bengaluru" }), row({ id: "2", location: "Pune" })];
    const { rows: out, collapsed } = collapseReqSpread(rows);
    expect(out).toHaveLength(1);
    expect(collapsed).toBe(1);
    expect(out[0].location).toContain("+1 cities");
  });
});

describe("normalizeUrl", () => {
  test("empty input stays empty", () => {
    expect(normalizeUrl("")).toBe("");
  });
});
