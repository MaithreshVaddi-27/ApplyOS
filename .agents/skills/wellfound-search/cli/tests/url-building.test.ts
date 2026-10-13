import { describe, expect, test } from "bun:test"
import { slugifyLocation } from "../src/helpers.js"
import { buildSearchUrls, paginate } from "../src/commands/search.js"

describe("pagination", () => {
  const rows = [1, 2, 3, 4, 5, 6, 7]

  test("page 2 returns the next window, not page 1", () => {
    // REGRESSION: --page was validated and echoed as meta.page while the same
    // page-1 rows were returned, so the envelope reported a page never fetched.
    expect(paginate(rows, 1, 3).pageRows).toEqual([1, 2, 3])
    expect(paginate(rows, 2, 3).pageRows).toEqual([4, 5, 6])
    expect(paginate(rows, 3, 3).pageRows).toEqual([7])
  })

  test("pages do not overlap", () => {
    const seen = new Set<number>()
    for (let p = 1; p <= 3; p++) for (const r of paginate(rows, p, 3).pageRows) seen.add(r)
    expect(seen.size).toBe(rows.length)
  })

  test("a page past the end is empty rather than a repeat of page 1", () => {
    expect(paginate(rows, 99, 3).pageRows).toEqual([])
  })

  test("truncated flags only when rows remain beyond the window", () => {
    expect(paginate(rows, 1, 3).truncated).toBe(true)
    expect(paginate(rows, 2, 4).truncated).toBe(false)
    expect(paginate(rows, 3, 3).truncated).toBe(false)
  })

  test("no limit returns everything on page 1", () => {
    expect(paginate(rows, 1, undefined).pageRows).toEqual(rows)
  })
})

describe("wellfound location mapping", () => {
  test("remote is never country-scoped", () => {
    expect(slugifyLocation("Remote")).toBe("remote")
    expect(slugifyLocation("remote worldwide")).toBe("remote")
  })

  test("indian metros keep their slugs", () => {
    expect(slugifyLocation("Bengaluru")).toBe("bangalore")
    expect(slugifyLocation("Pune")).toBe("pune")
  })

  test("remote queries hit the remote hub, not a country page", () => {
    const urls = buildSearchUrls({ location: "Remote", page: 1, format: "json" })
    expect(urls.some((u) => u.endsWith("/remote"))).toBe(true)
    expect(urls.some((u) => u.endsWith("/india"))).toBe(false)
  })

  test("city queries keep the role/location shape", () => {
    const urls = buildSearchUrls({ query: "backend", location: "Pune", page: 1, format: "json" })
    expect(urls[0]).toContain("/role/l/backend-engineer/pune")
  })
})
