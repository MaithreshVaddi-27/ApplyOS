import { describe, expect, test } from "bun:test"
import { toIsoDate, applyClientFilters, dedupeByUrl, stripHtmlTags } from "../src/helpers.js"
import type { NormalizedJob } from "../src/types.js"

function job(partial: Partial<NormalizedJob>): NormalizedJob {
  return {
    id: "1",
    title: "Software Engineer",
    company: "TestCo",
    location: "Bengaluru, India",
    date: "2026-09-01",
    url: "https://example.com/jobs/1",
    board: "greenhouse",
    slug: "testco",
    ...partial,
  }
}

describe("toIsoDate", () => {
  test("passes through ISO dates", () => {
    expect(toIsoDate("2026-09-30")).toBe("2026-09-30")
    expect(toIsoDate("2026-09-30T12:00:00Z")).toBe("2026-09-30")
  })
  test("converts epoch seconds and millis", () => {
    expect(toIsoDate(1780000000)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(toIsoDate(1780000000000)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  test("returns null for junk rather than inventing", () => {
    expect(toIsoDate("not a date")).toBeNull()
    expect(toIsoDate("")).toBeNull()
    expect(toIsoDate(undefined)).toBeNull()
  })
})

describe("applyClientFilters", () => {
  const jobs = [
    job({ id: "1", title: "Software Engineer", location: "Bengaluru, India", date: "2026-09-28" }),
    job({ id: "2", title: "Data Scientist", location: "Remote, India", date: "2026-09-20" }),
    job({ id: "3", title: "SDE Intern", location: "Hyderabad, India", date: null }),
  ]

  test("query filters on title words (all must match)", () => {
    expect(applyClientFilters(jobs, { query: "software engineer" }).map((j) => j.id)).toEqual(["1"])
  })
  test("location filter is case-insensitive substring", () => {
    expect(applyClientFilters(jobs, { location: "bengaluru" }).map((j) => j.id)).toEqual(["1"])
  })
  test("remote/any/all location filters are no-ops", () => {
    expect(applyClientFilters(jobs, { location: "remote" })).toHaveLength(3)
  })
  test("jobage keeps unknown dates, drops old ones", () => {
    expect(applyClientFilters(jobs, { jobage: 7 }).map((j) => j.id)).toEqual(["1", "3"])
  })
})

describe("dedupeByUrl", () => {
  test("drops duplicate URLs, keeps order", () => {
    const jobs = [
      job({ id: "1", url: "https://x.com/jobs/1" }),
      job({ id: "2", url: "https://x.com/jobs/1#frag" }),
      job({ id: "3", url: "https://x.com/jobs/2" }),
    ]
    expect(dedupeByUrl(jobs).map((j) => j.id)).toEqual(["1", "3"])
  })
})

describe("stripHtmlTags", () => {
  test("strips tags, decodes entities, keeps bullet structure", () => {
    const html = "<p>About</p><ul><li>First</li><li>Second &amp; third</li></ul><script>evil()</script>"
    const text = stripHtmlTags(html)
    expect(text).toContain("• First")
    expect(text).toContain("Second & third")
    expect(text).not.toContain("evil()")
    expect(text).not.toContain("<p>")
  })
})
