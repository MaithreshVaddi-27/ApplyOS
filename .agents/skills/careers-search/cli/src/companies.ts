// The company seed registry. Each row is one public job board we know how to
// fetch. The connectors are generic per ATS platform, so adding a company is
// one line here — the board must expose a public, unauthenticated endpoint.
//
// Every row marked "verified live" was probed with a real HTTP request on
// 2026-09-30. Rows marked "unverified" have a connector but the endpoint
// failed during the probe; they stay visible (as per-run error lines) so the
// failure is loud, not silent — see docs/COMPANY_PORTAL_SCRAPER.md.

import type { CompanyBoard } from "./types.js"

export const COMPANIES: CompanyBoard[] = [
  // ── Mega-cap direct portals ────────────────────────────────────────────
  // Amazon.jobs: public search.json API — verified live (2026-09-30).
  // Google/Microsoft careers: evaluated and declined — JS-only pages with
  // obfuscated state; their documented search APIs are gone (see the MD doc).
  { company: "Amazon", board: "amazon", slug: "india", region: "india", category: "mega-cap" },
  { company: "Amazon", board: "amazon", slug: "global", region: "global", category: "mega-cap" },
  // Salesforce Phenom widgets endpoint returned 503 (DNS) during the probe —
  // unverified; kept so its status surfaces on every run until stable.
  { company: "Salesforce", board: "salesforce", slug: "salesforce", region: "india", category: "mega-cap" },

  // ── Indian product companies (verified live ATS boards) ────────────
  // Groww, CRED, Freshworks verified 2026-09-30. The 2026-10-01 expansion
  // batch was probed live: Paytm/Meesho/Zeta/Nium on Lever; Okta, Coinbase,
  // Twilio, MongoDB, Coursera on Greenhouse (all carry India locations).
  { company: "Groww", board: "greenhouse", slug: "groww", region: "india", category: "india-product" },
  { company: "CRED", board: "lever", slug: "cred", region: "india", category: "india-product" },
  { company: "Freshworks", board: "smartrecruiters", slug: "Freshworks", region: "india", category: "india-product" },
  { company: "Paytm", board: "lever", slug: "paytm", region: "india", category: "india-product" },
  { company: "Meesho", board: "lever", slug: "meesho", region: "india", category: "india-product" },
  { company: "Zeta", board: "lever", slug: "zeta", region: "india", category: "india-product" },
  { company: "Nium", board: "lever", slug: "nium", region: "india", category: "india-product" },

  // ── Global companies with active India hiring (verified live) ─────────
  // India-role counts on probe day: Okta 108, Stripe 35, MongoDB 17,
  // Twilio 12, Coinbase 11, Coursera 4.
  { company: "Okta", board: "greenhouse", slug: "okta", region: "global", category: "startup" },
  { company: "Coinbase", board: "greenhouse", slug: "coinbase", region: "global", category: "startup" },
  { company: "Twilio", board: "greenhouse", slug: "twilio", region: "global", category: "startup" },
  { company: "MongoDB", board: "greenhouse", slug: "mongodb", region: "global", category: "startup" },
  { company: "Coursera", board: "greenhouse", slug: "coursera", region: "global", category: "startup" },

  // ── Global startups (verified live; several hire India-remote) ─────────
  { company: "Stripe", board: "greenhouse", slug: "stripe", region: "global", category: "startup" },
  { company: "Figma", board: "greenhouse", slug: "figma", region: "global", category: "startup" },
  { company: "Airbnb", board: "greenhouse", slug: "airbnb", region: "global", category: "startup" },
  { company: "Databricks", board: "greenhouse", slug: "databricks", region: "global", category: "startup" },
]

/** Boards recognized by URL detection / discover, beyond the seeded slugs. */
export const BOARD_HINTS: Array<{ kind: string; pattern: RegExp; note: string }> = [
  { kind: "amazon", pattern: /amazon\.jobs/i, note: "amazon.jobs search API" },
  { kind: "greenhouse", pattern: /job-boards\.greenhouse\.io/i, note: "Greenhouse boards API — add the slug to companies.ts to search it" },
  { kind: "lever", pattern: /jobs\.(eu\.)?lever\.co/i, note: "Lever postings API — add the slug to companies.ts to search it" },
  { kind: "ashby", pattern: /jobs\.ashbyhq\.com/i, note: "Ashby board — public API currently returns 401 (see MD doc)" },
  { kind: "smartrecruiters", pattern: /jobs\.smartrecruiters\.com|careers\.smartrecruiters\.com/i, note: "SmartRecruiters public API" },
  { kind: "workday", pattern: /\.myworkdayjobs\.com/i, note: "Workday CXS API — add tenant/site to companies.ts to search it" },
  { kind: "eightfold", pattern: /\.eightfold\.ai/i, note: "Eightfold careers API — connector exists; verify the tenant resolves publicly before seeding (Goldman Sachs does not — see enterprise.ts)" },
]

export function findCompany(name: string): CompanyBoard[] {
  const q = name.toLowerCase().trim()
  return COMPANIES.filter((c) => c.company.toLowerCase().includes(q))
}

export function companiesForBoard(board: string): CompanyBoard[] {
  return COMPANIES.filter((c) => c.board === board)
}

export function companiesByCategory(category: string): CompanyBoard[] {
  const q = category.toLowerCase().trim()
  return COMPANIES.filter((c) => (c.category ?? "").toLowerCase() === q)
}

export function companiesByRegion(region: string): CompanyBoard[] {
  const q = region.toLowerCase().trim()
  return COMPANIES.filter((c) => (c.region ?? "").toLowerCase() === q)
}
