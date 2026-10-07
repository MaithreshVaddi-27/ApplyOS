import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"
import { parseOpportunityCard, salaryToLpaRange, type UnstopOpportunityItem } from "../src/helpers.js"

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
  deadline: string
}

describe("unstop-cli search & detail live smoke tests", () => {
  test("searches jobs with json format", async () => {
    const res = await runCLI(["search", "-q", "software", "--limit", "3", "--format", "json"])
    expect(res.exitCode).toBe(0)
    const data = parseJSON<SearchResponse>(res)
    expect(data.meta).toBeDefined()
    expect(data.meta.count).toBeGreaterThan(0)
    expect(data.results.length).toBeGreaterThan(0)

    const first = data.results[0]
    expect(first.id).toBeTruthy()
    expect(first.title).toBeTruthy()
    expect(first.url).toContain("unstop.com")
  })

  test("searches internships with table format", async () => {
    const res = await runCLI([
      "search",
      "-q",
      "intern",
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

  test("fetches detail for a real opportunity", async () => {
    // Search first to get a live ID
    const searchRes = await runCLI(["search", "-q", "engineer", "--limit", "1", "--format", "json"])
    expect(searchRes.exitCode).toBe(0)
    const searchData = parseJSON<SearchResponse>(searchRes)
    if (searchData.results.length === 0) return

    const target = searchData.results[0]
    const detailRes = await runCLI(["detail", target.id, "--format", "json"])
    expect(detailRes.exitCode).toBe(0)
    const detail = parseJSON<DetailResponse>(detailRes)
    expect(detail.id).toBe(target.id)
    expect(detail.title).toBeTruthy()
    expect(detail.url).toContain("unstop.com")
  }, 15000)
})

describe("parseOpportunityCard", () => {
  test("surfaces employment and workplace type from jobDetail", () => {
    const item: UnstopOpportunityItem = {
      id: 1765373,
      title: "AI Backend Developer Internship",
      public_url: "internships/ai-backend-developer-intern-zizzet-1765373",
      organisation: { name: "Zizzet" },
      jobDetail: { timing: "part_time", type: "wfh" },
    }
    const card = parseOpportunityCard(item)
    expect(card.employmentType).toBe("part_time")
    expect(card.workplaceType).toBe("wfh")
    expect(card.url).toContain("unstop.com")
  })

  test("nulls when jobDetail is absent", () => {
    const item: UnstopOpportunityItem = { id: 1, title: "X" }
    const card = parseOpportunityCard(item)
    expect(card.employmentType).toBeNull()
    expect(card.workplaceType).toBeNull()
  })
})

describe("salaryToLpaRange", () => {
  test("monthly INR annualizes to LPA", () => {
    expect(salaryToLpaRange("₹ 25,000 - 40,000")).toEqual([3, 4.8])
    expect(salaryToLpaRange("₹ 30,000 per month")).toEqual([3.6, 3.6])
  })

  test("annual figures pass through as LPA", () => {
    expect(salaryToLpaRange("6-8 LPA")).toEqual([6, 8])
    expect(salaryToLpaRange("₹12,00,000 per annum")).toEqual([12, 12])
  })

  test("unparseable strings return null (card kept)", () => {
    expect(salaryToLpaRange("competitive")).toBeNull()
    expect(salaryToLpaRange("")).toBeNull()
  })
})
