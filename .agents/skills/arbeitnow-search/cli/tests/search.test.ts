import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

interface SearchResponse {
  meta: { count: number; page: number; total: number }
  results: Array<{ id: string; title: string; url: string; remote: boolean }>
}

describe.skipIf(!process.env.APPLYOS_LIVE_TESTS)("arbeitnow-cli live smoke", () => {
  test("searches jobs as json", async () => {
    const res = await runCLI(["search", "-q", "engineer", "--limit", "3", "--format", "json"])
    expect(res.exitCode).toBe(0)
    const data = parseJSON<SearchResponse>(res)
    expect(data.results.length).toBeGreaterThan(0)
    expect(data.results[0].url).toContain("arbeitnow")
  })
  test("searches as table", async () => {
    const res = await runCLI(["search", "--limit", "2", "--format", "table"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("TITLE")
  })
  test("fetches detail for a real slug", async () => {
    const res = await runCLI(["search", "--limit", "1", "--format", "json"])
    const data = parseJSON<SearchResponse>(res)
    if (!data.results.length) return
    const detail = await runCLI(["detail", data.results[0].id, "--format", "json"])
    expect(detail.exitCode).toBe(0)
    expect(JSON.parse(detail.stdout).id).toBe(data.results[0].id)
  }, 30000)
})
