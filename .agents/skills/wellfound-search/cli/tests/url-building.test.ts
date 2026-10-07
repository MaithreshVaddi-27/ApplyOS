import { describe, expect, test } from "bun:test"
import { slugifyLocation } from "../src/helpers.js"
import { buildSearchUrls } from "../src/commands/search.js"

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
