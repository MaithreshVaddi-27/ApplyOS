import { describe, expect, test } from "bun:test"
import { isOutageEmpty, renderTable, type WayupJobResult } from "../src/commands/search.js"

// Offline unit tests for P-M11 (outage must exit 1, never read as "no jobs")
// and the table-ID truncation fix (a cut id can't round-trip into `detail`).
// No network access.

describe("isOutageEmpty (P-M11)", () => {
  test("every fetch failed, zero rows → outage", () => {
    expect(isOutageEmpty(2, false, 0)).toBe(true)
  })

  test("all fetches ok, zero rows → genuine empty, not outage", () => {
    expect(isOutageEmpty(0, false, 0)).toBe(false)
  })

  test("rows were parsed but filtered to zero → not outage", () => {
    expect(isOutageEmpty(1, true, 0)).toBe(false)
  })

  test("non-empty result → never outage", () => {
    expect(isOutageEmpty(0, true, 3)).toBe(false)
  })
})

describe("renderTable id round-trip", () => {
  const row = (over: Partial<WayupJobResult>): WayupJobResult => ({
    id: "x",
    title: "Software Engineer",
    company: "Acme",
    location: "Remote",
    date: "2026-10-01",
    url: "https://www.wayup.com/x/",
    ...over,
  })

  test("long ids are never truncated (detail needs the full id)", () => {
    const longId = "i-j-senior-software-engineer-backend-developer-abc123xyz"
    const out = renderTable([row({ id: longId })])
    expect(out).toContain(longId)
    expect(out).not.toContain("…")
  })

  test("empty table still reports no jobs", () => {
    expect(renderTable([])).toContain("No jobs found")
  })
})
