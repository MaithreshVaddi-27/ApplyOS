import { describe, expect, test } from "bun:test"
import { applyWellfoundFilters, type SearchOpts } from "../src/commands/search.js"
import type { JobCard } from "../src/helpers.js"

const cards: JobCard[] = [
  { id: "a", title: "Backend Engineer", company: "Acme", location: "Bengaluru", date: "2026-10-01", url: "https://wellfound.com/a" },
  { id: "b", title: "Designer", company: "Beta", location: "Mumbai", date: "2026-10-02", url: "https://wellfound.com/b" },
] as JobCard[]

const base: SearchOpts = { page: 1, format: "json" }

describe("wellfound filter honesty (P-B3)", () => {
  test("query with zero matches returns empty, never the unfiltered board", () => {
    expect(applyWellfoundFilters(cards, { ...base, query: "quantum-astrophysicist" })).toHaveLength(0)
  })
  test("location with zero matches returns empty, never the unfiltered board", () => {
    expect(applyWellfoundFilters(cards, { ...base, location: "Reykjavik" })).toHaveLength(0)
  })
  test("matching query still filters correctly", () => {
    const out = applyWellfoundFilters(cards, { ...base, query: "backend" })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe("a")
  })
})
