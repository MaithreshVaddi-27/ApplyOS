import { describe, expect, test } from "bun:test"
import { decodeHtmlEntities, parseOpportunityCard, salaryToLpaRange } from "../src/helpers.js"
import { extractOpportunityId } from "../src/commands/detail.js"

// Offline unit tests for P-M8 (monthly inference), P-M14 (id extraction),
// and the fromCharCode → fromCodePoint fix. No network access.

describe("salaryToLpaRange (P-M8)", () => {
  test("explicit monthly marker still annualizes", () => {
    expect(salaryToLpaRange("₹50000/month")).toEqual([6, 6])
    expect(salaryToLpaRange("₹ 30,000 per month")).toEqual([3.6, 3.6])
  })

  test("annual ₹ figure below ₹5L is NOT misclassified as monthly", () => {
    // Old magnitude inference (max < 500000 ⇒ monthly) turned ₹4.5L/yr
    // into 54 LPA. A bare/low annual figure must stay annual.
    expect(salaryToLpaRange("₹4,50,000")).toEqual([4.5, 4.5])
    expect(salaryToLpaRange("₹4.5L/yr")).toEqual([4.5, 4.5])
  })

  test("LPA and per-annum markers pass through", () => {
    expect(salaryToLpaRange("6-8 LPA")).toEqual([6, 8])
    expect(salaryToLpaRange("₹12,00,000 per annum")).toEqual([12, 12])
  })

  test("$ figures read as annual, never ×12 monthly", () => {
    expect(salaryToLpaRange("$80,000")).toEqual([0.8, 0.8])
    expect(salaryToLpaRange("$80,000 per year")).toEqual([0.8, 0.8])
  })

  test("unparseable strings return null (card kept)", () => {
    expect(salaryToLpaRange("competitive")).toBeNull()
    expect(salaryToLpaRange("")).toBeNull()
  })
})

describe("extractOpportunityId (P-M14)", () => {
  test("standard slug URL yields the trailing id", () => {
    expect(
      extractOpportunityId(
        "https://unstop.com/jobs/software-engineer-visheneracom-1739954",
      ),
    ).toBe("1739954")
  })

  test("prefers the LAST numeric segment, not the first", () => {
    // Old first-match regex grabbed "111" here.
    expect(extractOpportunityId("https://unstop.com/jobs/team-111/finale-222")).toBe(
      "222",
    )
  })

  test("trailing slash and query strings still work", () => {
    expect(
      extractOpportunityId(
        "https://unstop.com/internships/ai-backend-developer-intern-zizzet-1765373/",
      ),
    ).toBe("1765373")
    expect(
      extractOpportunityId(
        "https://unstop.com/jobs/software-engineer-visheneracom-1739954?ref=abc",
      ),
    ).toBe("1739954")
  })

  test("bare ids pass through untouched", () => {
    expect(extractOpportunityId("1739954")).toBe("1739954")
    expect(extractOpportunityId("  1765373  ")).toBe("1765373")
  })
})

describe("decodeHtmlEntities supplementary-plane (fromCodePoint)", () => {
  test("decimal emoji entity decodes to the real emoji", () => {
    expect(decodeHtmlEntities("&#128512;")).toBe("😀")
    expect(decodeHtmlEntities("&#128512;")).toBe(String.fromCodePoint(128512))
  })
})

describe("parseOpportunityCard date (P-M16)", () => {
  test("date comes from updated_at as YYYY-MM-DD (no posted field exists)", () => {
    expect(
      parseOpportunityCard({ id: 1739954, updated_at: "2026-09-01T15:22:02+05:30" }).date,
    ).toBe("2026-09-01")
  })

  test("missing/unparseable updated_at → null date (never invented)", () => {
    expect(parseOpportunityCard({ id: 1 }).date).toBeNull()
    expect(parseOpportunityCard({ id: 2, updated_at: "not-a-date" }).date).toBeNull()
  })
})
