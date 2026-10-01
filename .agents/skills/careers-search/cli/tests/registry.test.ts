// Guard tests for the company seed registry (companies.ts).
// These run offline: they pin structural invariants so a bad one-line
// addition cannot silently corrupt search runs, and so companies that were
// evaluated-and-declined (with recorded evidence) cannot be re-seeded by
// accident. Live endpoint verification is a manual probe step recorded in
// docs/COMPANY_PORTAL_SCRAPER.md — never a network call in tests.

import { describe, expect, test } from "bun:test"
import { COMPANIES, BOARD_HINTS, findCompany, companiesForBoard } from "../src/companies.js"
import { CONNECTORS } from "../src/connectors/index.js"
import { detectBoards } from "../src/detect.js"
import type { BoardKind } from "../src/types.js"

describe("careers-cli company registry", () => {
  test("has no duplicate company+slug rows", () => {
    const seen = new Set<string>()
    for (const c of COMPANIES) {
      const key = `${c.company.toLowerCase()}|${c.slug.toLowerCase()}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  test("every row has company, valid board kind, and a clean slug", () => {
    for (const c of COMPANIES) {
      expect(c.company.length).toBeGreaterThan(0)
      expect(Object.keys(CONNECTORS)).toContain(c.board)
      expect(c.slug).toMatch(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/)
    }
  })

  test("every registry board kind has a registered connector", () => {
    const used = new Set<BoardKind>(COMPANIES.map((c) => c.board))
    for (const kind of used) {
      expect(CONNECTORS[kind]).toBeDefined()
    }
  })

  test("region and category values stay in the documented vocabulary", () => {
    const regions = new Set(["india", "global"])
    const categories = new Set(["mega-cap", "india-product", "gcc", "startup"])
    for (const c of COMPANIES) {
      if (c.region) expect(regions.has(c.region)).toBe(true)
      if (c.category) expect(categories.has(c.category)).toBe(true)
    }
  })

  test("declined boards stay unseeded (see docs/COMPANY_PORTAL_SCRAPER.md)", () => {
    // Goldman Sachs Eightfold: tenant has no public DNS (2026-10-01 probe).
    // JPMorgan Oracle ORC: CX 503, careers API 301s to marketing pages.
    // Ashby: non-authed API answers 401. Google/Microsoft: dead APIs.
    expect(companiesForBoard("eightfold")).toEqual([])
    expect(findCompany("goldman sachs")).toEqual([])
    expect(findCompany("jpmorgan")).toEqual([])
    expect(findCompany("google")).toEqual([])
    expect(findCompany("microsoft")).toEqual([])
  })

  test("seeds include the verified India expansion batch (2026-10-01)", () => {
    for (const name of ["Paytm", "Meesho", "Zeta", "Nium", "Okta", "Coinbase", "Twilio", "MongoDB", "Coursera"]) {
      expect(findCompany(name).length).toBe(1)
    }
    expect(findCompany("paytm")[0]?.board).toBe("lever")
    expect(findCompany("okta")[0]?.board).toBe("greenhouse")
  })

  test("board hints cover every connector board", () => {
    const hinted = new Set(BOARD_HINTS.map((h) => h.kind))
    for (const kind of Object.keys(CONNECTORS)) {
      if (kind === "salesforce") continue // detected via careers.salesforce.com pattern elsewhere
      expect(hinted.has(kind)).toBe(true)
    }
  })

test("detect routes eightfold careers URLs to the eightfold board", () => {
  const d = detectBoards("https://acme.eightfold.ai/careers/job/12345_6789")
  expect(d.length).toBe(1)
  expect(d[0].board).toBe("eightfold")
  expect(d[0].slug).toBe("acme")
  expect(d[0].id).toBe("12345_6789")
})
})
