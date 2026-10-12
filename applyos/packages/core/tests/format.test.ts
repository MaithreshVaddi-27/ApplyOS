// Origin: clean-room 2026-10-11, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { toTable, toPlain, parseIsoDate, isoDateOnly } from "../src/format";
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

describe("format display fallbacks", () => {
  test("null location renders unspecified, never null or empty", () => {
    const table = toTable([row({ location: null })]);
    expect(table).toContain("unspecified");
    expect(table).not.toContain("null");
    const plain = toPlain([row({ location: null })]);
    expect(plain).toContain("unspecified");
  });
  test("table cells escape pipes and fold newlines (golden)", () => {
    const table = toTable([row({ title: "A|B", company: "C\nD" })]);
    const lines = table.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe("A\\|B | C D | Bengaluru | 2026-10-01 | https://example.com/jobs/abc-123");
  });
});

describe("parseIsoDate vs isoDateOnly", () => {
  test("parseIsoDate accepts anything Date.parse accepts", () => {
    expect(parseIsoDate("2026-10-05T00:00:00Z")).toBe("2026-10-05");
    expect(parseIsoDate("Sun, 05 Oct 2026 00:00:00 GMT")).toBe("2026-10-05");
    expect(parseIsoDate(undefined)).toBeNull();
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("not-a-date")).toBeNull();
  });
  test("isoDateOnly stays strict where parseIsoDate is lenient", () => {
    expect(isoDateOnly("2026-10-05T00:00:00Z")).toBe("2026-10-05");
    // Explicit-GMT input: midnight is unambiguous, so this holds in every TZ
    // (a bare "Oct 5, 2026" means midnight *local* and would shift the date).
    expect(isoDateOnly("Sun, 05 Oct 2026 00:00:00 GMT")).toBeNull();
    expect(parseIsoDate("Sun, 05 Oct 2026 00:00:00 GMT")).toBe("2026-10-05");
  });
});
