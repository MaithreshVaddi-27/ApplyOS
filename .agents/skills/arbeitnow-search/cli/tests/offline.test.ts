import { describe, expect, test } from "bun:test"
import {
  arbeitnowDate,
  arbeitnowLocation,
  extractArbeitnowSlug,
  filterArbeitnow,
  parseArbeitnowJob,
  type ArbeitnowRow,
} from "../src/helpers.js"

const row = (over: Partial<ArbeitnowRow> = {}): ArbeitnowRow => ({
  id: "x",
  title: "Backend Dev",
  company: "Acme",
  location: null,
  date: "2026-11-22",
  url: "https://www.arbeitnow.com/jobs/companies/acme/backend-dev-x",
  remote: false,
  tags: [],
  jobTypes: [],
  createdAt: null,
  ...over,
})

describe("arbeitnow offline helpers", () => {
  test("unix seconds become a calendar date", () => {
    expect(arbeitnowDate(1795319723)).toBe("2026-11-22")
    expect(arbeitnowDate("short")).toBeNull()
  })
  test("an empty place is null, remote is separate", () => {
    expect(arbeitnowLocation({ location: "" })).toBeNull()
    expect(arbeitnowLocation({ location: " Berlin " })).toBe("Berlin")
    expect(arbeitnowLocation({ location: "", remote: true })).toBeNull()
  })
  test("the slug is the last path segment", () => {
    expect(extractArbeitnowSlug("https://www.arbeitnow.com/jobs/companies/acme/dev-x")).toBe("dev-x")
    expect(extractArbeitnowSlug("dev-x")).toBe("dev-x")
  })
  test("a row with no slug or url is dropped", () => {
    expect(parseArbeitnowJob({ url: "https://x/1" })).toBeNull()
    expect(parseArbeitnowJob({ slug: "x" })).toBeNull()
  })
  test("query matches title and company", () => {
    const rows = [row({ id: "a", title: "Python Dev" }), row({ id: "b", company: "Python Co" }), row({ id: "c", title: "Java Dev" })]
    expect(filterArbeitnow(rows, { query: "python" }).map((r) => r.id)).toEqual(["a", "b"])
  })
  test("the age filter uses an injected clock and keeps undated rows", () => {
    const now = new Date("2026-11-22T12:00:00Z")
    const rows = [row({ id: "new", date: "2026-11-22" }), row({ id: "old", date: "2026-01-01" }), row({ id: "undated", date: null })]
    expect(filterArbeitnow(rows, { jobAgeDays: 7 }, now).map((r) => r.id)).toEqual(["new", "undated"])
  })
})
