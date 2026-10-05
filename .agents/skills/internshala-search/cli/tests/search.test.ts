import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"
import { filterByQuery, type JobCard } from "../src/helpers.js"

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

describe("filterByQuery", () => {
  const card = (over: Partial<JobCard>): JobCard => ({
    id: "1",
    title: "Software Development",
    company: "TEN",
    location: "Work from home",
    date: null,
    url: "https://internshala.com/x",
    ...over,
  })

  test("drops cards irrelevant to the query", () => {
    const cards = [
      card({ id: "1", title: "Marketing & Sales", company: "Reliance Nippon" }),
      card({ id: "2", title: "Software Development", company: "TEN" }),
    ]
    expect(filterByQuery(cards, "software developer").map((c) => c.id)).toEqual(["2"])
  })

  test("stem-prefix match: developer query keeps Development titles", () => {
    const cards = [card({ id: "2", title: "Software Development", company: "TEN" })]
    expect(filterByQuery(cards, "software developer").map((c) => c.id)).toEqual(["2"])
  })

  test("all words must match: Business Development fails a web development query", () => {
    const cards = [
      card({ id: "1", title: "Business Development (Sales)", company: "Yatra" }),
      card({ id: "2", title: "Web Development Internship", company: "Acme" }),
    ]
    expect(filterByQuery(cards, "web development").map((c) => c.id)).toEqual(["2"])
  })

  test("matches on company name too", () => {
    const cards = [card({ id: "1", title: "Software Development", company: "Salesforce" })]
    expect(filterByQuery(cards, "salesforce")).toHaveLength(1)
  })

  test("returns empty when nothing matches (hard filter)", () => {
    const cards = [card({ id: "1", title: "Sales", company: "Titan" })]
    expect(filterByQuery(cards, "python developer")).toEqual([])
  })

  test("keeps c++ as one token rather than stripping the +", () => {
    const cpp = [card({ id: "1", title: "C++ Developer Intern", company: "Acme" })]
    expect(filterByQuery(cpp, "c++ developer").map((c) => c.id)).toEqual(["1"])
    // "c++" does not match a plain "C" title — the + is meaningful.
    expect(filterByQuery([card({ id: "2", title: "C Developer Intern", company: "Acme" })], "c++ developer")).toEqual([])
  })

  test("does not match internship against international", () => {
    const cards = [card({ id: "3", title: "International Business Development", company: "MantraCare" })]
    expect(filterByQuery(cards, "internship")).toEqual([])
  })
})
