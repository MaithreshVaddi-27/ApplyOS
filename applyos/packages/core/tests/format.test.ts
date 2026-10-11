// Origin: clean-room 2026-10-11, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { toTable, toPlain } from "../src/format";
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
});
