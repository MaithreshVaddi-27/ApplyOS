// Origin: clean-room 2026-10-11, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { wantsInternships, applyStageFilters } from "../src/stages";
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

describe("wantsInternships", () => {
  test("explicit type wins over stage", () => {
    expect(wantsInternships({ type: "internships", stage: "experienced" })).toBe(true);
    expect(wantsInternships({ type: "jobs", stage: "student" })).toBe(false);
  });
  test("students default to internships, others do not", () => {
    expect(wantsInternships({ stage: "student" })).toBe(true);
    expect(wantsInternships({ stage: "fresher" })).toBe(false);
    expect(wantsInternships({})).toBe(false);
  });
});

describe("applyStageFilters", () => {
  const rows = [
    row(),
    row({ id: "2", title: "Senior Backend", url: "https://example.com/jobs/def-456" }),
    row({ id: "3", title: "Frontend Intern", location: "Remote", url: "https://example.com/jobs/ghi-789" }),
  ];
  test("student keeps internships only", () => {
    expect(applyStageFilters(rows, { stage: "student" })).toHaveLength(2);
  });
  test("null location never matches and never passes remote-global", () => {
    const nullRow = row({ id: "9", title: "Backend Dev", location: null, url: "https://example.com/jobs/null-1" });
    expect(applyStageFilters([nullRow], { location: "bengaluru" })).toHaveLength(0);
    expect(applyStageFilters([nullRow], { stage: "remote-global" })).toHaveLength(0);
    expect(applyStageFilters([nullRow], {})).toHaveLength(1);
  });
});
