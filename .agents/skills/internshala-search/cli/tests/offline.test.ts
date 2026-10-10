import { describe, expect, test } from "bun:test"
import { filterByLocation, isEmptyPage } from "../src/commands/search.js"
import {
  normalizeCardDate,
  parseJobCards,
  parsePostedAgo,
  type JobCard,
} from "../src/helpers.js"

// Offline unit tests for P-M11 (404-empty page is an outage, never "no
// jobs"), P-M15 (relative dates → ISO, never raw text), and P-M17 (a
// location filter that matches nothing yields empty, never the unfiltered
// board). No network access.

const card = (over: Partial<JobCard>): JobCard => ({
  id: "1",
  title: "Software Development",
  company: "TEN",
  location: "Bengaluru",
  date: null,
  url: "https://internshala.com/x",
  ...over,
})

describe("isEmptyPage (P-M11)", () => {
  test("404-empty page is an outage", () => {
    expect(isEmptyPage("")).toBe(true)
    expect(isEmptyPage("   ")).toBe(true)
  })

  test("any real page body is not an outage", () => {
    expect(isEmptyPage("<html><body>jobs</body></html>")).toBe(false)
  })
})

describe("filterByLocation (P-M17)", () => {
  const cards = [
    card({ id: "1", location: "Bengaluru" }),
    card({ id: "2", location: "Mumbai" }),
  ]

  test("zero matches yield empty, never the unfiltered board", () => {
    expect(filterByLocation(cards, "Reykjavik")).toEqual([])
  })

  test("matching location still filters correctly", () => {
    expect(filterByLocation(cards, "bengaluru").map((c) => c.id)).toEqual(["1"])
  })

  test("cards without a location never match a location filter", () => {
    expect(filterByLocation([card({ id: "9", location: null })], "bengaluru")).toEqual([])
  })
})

describe("normalizeCardDate (P-M15)", () => {
  const dayMs = 86_400_000
  const todayIso = () => new Date().toISOString().slice(0, 10)

  test("'30+ Days Ago' resolves to the ISO date 30 days back", () => {
    const expected = new Date(Date.now() - 30 * dayMs).toISOString().slice(0, 10)
    expect(normalizeCardDate("30+ Days Ago")).toBe(expected)
  })

  test("relative labels resolve to ISO dates", () => {
    expect(normalizeCardDate("Just now")).toBe(todayIso())
    const twoWeeks = new Date(Date.now() - 14 * dayMs).toISOString().slice(0, 10)
    expect(normalizeCardDate("2 weeks ago")).toBe(twoWeeks)
  })

  test("absolute dates pass through as YYYY-MM-DD", () => {
    expect(normalizeCardDate("2026-09-10")).toBe("2026-09-10")
  })

  test("unparseable labels (status text, garbage) become null", () => {
    expect(normalizeCardDate("Actively hiring")).toBeNull()
    expect(normalizeCardDate("garbage")).toBeNull()
    expect(normalizeCardDate(null)).toBeNull()
    expect(normalizeCardDate("")).toBeNull()
  })
})

describe("parsePostedAgo '+' suffix", () => {
  test("'30+ days ago' parses like '30 days ago'", () => {
    const now = Date.now()
    const diff = now - parsePostedAgo("30+ days ago")
    expect(diff).toBeGreaterThanOrEqual(30 * 86_400_000)
    expect(diff).toBeLessThan(30 * 86_400_000 + 5_000)
  })
})

describe("parseJobCards date (P-M15 end-to-end)", () => {
  test("card dates are ISO, never raw relative text", () => {
    const html = `
      <div id="individual_internship_12345">
        <a class="job-title-href" data-href="/internship/detail/software-dev-12345">Software Dev</a>
        <div class="status-container"><span>3 days ago</span></div>
      </div>`
    const cards = parseJobCards(html)
    expect(cards).toHaveLength(1)
    expect(cards[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(cards[0].date).not.toContain("ago")
  })
})
