import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"

interface SearchResponse {
  meta: {
    count: number
    page: number
  }
  results: Array<{
    id: string
    title: string
    company: string
    location: string
    date: string
    url: string
    salary?: string
  }>
}

interface DetailResponse {
  id: string
  url: string
  title: string
  company: string
  location: string
  salary: string
  description: string
  skills: string[]
  whoCanApply: string
  numberOfOpenings: string
}

describe("internshala-cli search & detail live smoke tests", () => {
  test("searches jobs with json format", async () => {
    const res = await runCLI(["search", "-q", "python", "--limit", "3", "--format", "json"])
    expect(res.exitCode).toBe(0)
    const data = parseJSON<SearchResponse>(res)
    expect(data.meta).toBeDefined()
    expect(data.meta.count).toBeGreaterThan(0)
    expect(data.results.length).toBeGreaterThan(0)

    const first = data.results[0]
    expect(first.id).toBeTruthy()
    expect(first.title).toBeTruthy()
    expect(first.url).toContain("internshala.com")
  })

  test("searches internships with table format", async () => {
    const res = await runCLI([
      "search",
      "-q",
      "data science",
      "--type",
      "internships",
      "--limit",
      "2",
      "--format",
      "table",
    ])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("TITLE")
    expect(res.stdout).toContain("COMPANY")
  })

  test("fetches detail for a real listing", async () => {
    // Search first to get a live ID
    const searchRes = await runCLI(["search", "-q", "developer", "--limit", "1", "--format", "json"])
    expect(searchRes.exitCode).toBe(0)
    const searchData = parseJSON<SearchResponse>(searchRes)
    if (searchData.results.length === 0) return

    const target = searchData.results[0]
    const detailRes = await runCLI(["detail", target.id, "--format", "json"])
    expect(detailRes.exitCode).toBe(0)
    const detail = parseJSON<DetailResponse>(detailRes)
    expect(detail.id).toBe(target.id)
    expect(detail.title).toBeTruthy()
    expect(detail.url).toContain("internshala.com")
  }, 15000)
})
