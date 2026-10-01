// Connectors for the mega-cap direct career portals and Workday-hosted boards.
// All public, unauthenticated endpoints. Parse defensively: the portals are
// SPAs whose JSON shapes drift, so every field mapping is explicit and a
// shape change errors loudly instead of emitting garbage.

import { fetchJson, fetchText, clean, toIsoDate, stripHtmlTags, sleep } from "../helpers.js"
import type { CompanyBoard, NormalizedJob, Connector } from "../types.js"

// ── Eightfold (candidate tenant-shape connector, kept unseeded) ──────────

/**
 * Eightfold Talent Intelligence boards. The endpoint shape is public and
 * zero-auth, but on 2026-10-01 the biggest India-GCC tenant (Goldman Sachs)
 * could not be verified: `goldmansachs.eightfold.ai` and `tesla.eightfold.ai`
 * have NO public DNS A records (Google authoritative DNS returns NOERROR with
 * zero answers — the tenants are not publicly resolvable, likely VPN-gated).
 *
 * Kept as code so that a working tenant can be added with one registry line:
 *   { company: "X", board: "eightfold", slug: "x", region: "india", category: "gcc" }
 * Pagination: `start`/`num` off `count` and `total` (never trust flags).
 */
export const eightfoldSearch: Connector = async (board, { query, maxPages }) => {
  const out: NormalizedJob[] = []
  let start = 0
  const num = 100
  const maxLoops = maxPages > 0 ? maxPages : 500
  for (let i = 0; i < maxLoops; i++) {
    const data = await fetchJson<{
      count?: number
      total?: number
      positions?: Array<{
        id?: string
        name?: string
        location?: string | null
        canonicalPositionUrl?: string
        date_published?: string | null
        sc_city?: string
        sc_category?: string | null
      }>
    }>(
      `https://${board.slug}.eightfold.ai/api/apply/v2/jobs?domain=${board.slug}.ai&start=${start}&num=${num}${query ? `&query=${encodeURIComponent(query)}` : ""}`,
    )
    const rows = data.positions ?? []
    for (const j of rows) {
      out.push({
        id: String(j.id ?? ""),
        title: clean(j.name),
        company: board.company,
        location: clean(j.location ?? j.sc_city) || "—",
        date: toIsoDate(j.date_published),
        url: j.canonicalPositionUrl ?? `https://${board.slug}.eightfold.ai/careers/${j.id}`,
        board: "eightfold",
        slug: board.slug,
      })
    }
    start += rows.length
    const total = data.total ?? 0
    if (rows.length === 0 || (total > 0 && start >= total)) break
    await sleep(300)
  }
  return out
}

export async function eightfoldDetail(board: CompanyBoard, id: string): Promise<string> {
  const data = await fetchJson<{
    position?: {
      id?: string
      name?: string
      description?: string
      location?: string | null
    }
  }>(
    `https://${board.slug}.eightfold.ai/api/apply/v2/jobs/${encodeURIComponent(id)}?domain=${board.slug}.ai`,
  )
  const pos = data.position
  if (!pos) throw new Error(`eightfold job ${id} not found (shape may have changed)`)
  const body = pos.description ? stripHtmlTags(pos.description) : "(no description returned)"
  return `${pos.name ?? "Posting"}${pos.location ? ` — ${pos.location}` : ""}\n\n${body}`
}

// ── Amazon / AWS (amazon.jobs public search API) ───────────────────────────

export const amazonSearch: Connector = async (board, { query, maxPages }) => {
  const out: NormalizedJob[] = []
  let offset = 0
  // maxPages <= 0 means "no cap" (bounded by the board being exhausted).
  const maxLoops = maxPages > 0 ? maxPages : 500
  for (let i = 0; i < maxLoops; i++) {
    const params = new URLSearchParams({
      radius: "24km",
      facetedLocale: "true",
      flex_locations: "[]",
      offset: String(offset),
      result_limit: "100",
      sort: "recent",
    })
    if (query) params.set("base_query", query)
    // The "slug" distinguishes india vs global runs via country param.
    if (board.slug === "india") params.set("country", "IND")
    const data = await fetchJson<{
      error?: boolean
      jobs?: Array<{
        id_icims: string
        title: string
        company_name?: string
        normalized_location?: string
        location?: string
        posted_date: string
        job_path: string
        description?: string
      }>
      error_details?: string
    }>(`https://www.amazon.jobs/en/search.json?${params.toString()}`)
    if (data.error) throw new Error(data.error_details ?? "amazon.jobs reported an error")
    const rows = data.jobs ?? []
    for (const j of rows) {
      out.push({
        id: j.id_icims,
        title: clean(j.title),
        company: j.company_name ?? board.company,
        location: clean(j.normalized_location ?? j.location) || "—",
        date: toIsoDate(j.posted_date),
        url: `https://www.amazon.jobs${j.job_path}`,
        description: j.description ? stripHtmlTags(j.description).slice(0, 1200) : undefined,
        board: "amazon",
        slug: board.slug,
      })
    }
    offset += rows.length
    if (rows.length < 100) break
    await sleep(300)
  }
  return out
}

export async function amazonDetail(board: CompanyBoard, idOrPath: string): Promise<string> {
  // Accept either an id_icims or a full amazon.jobs job path/URL.
  let jobId = idOrPath
  if (idOrPath.includes("/")) {
    const m = idOrPath.match(/amazon\.jobs\/(?:en\/)?jobs?\/([a-z0-9]+)/i) ?? idOrPath.match(/([a-z0-9]{6,})/i)
    if (!m) throw new Error(`cannot parse an amazon job id out of "${idOrPath}"`)
    jobId = m[1]
  }
  // The search API accepts the raw id as base_query and returns the full JD
  // (description, qualifications) — the posting HTML page is a JS shell.
  const params = new URLSearchParams({ offset: "0", result_limit: "5", base_query: jobId })
  const data = await fetchJson<{
    jobs?: Array<{
      id_icims: string
      title: string
      description?: string
      normalized_location?: string
      basic_qualifications?: string
      preferred_qualifications?: string
      posted_date?: string
      job_path?: string
    }>
  }>(`https://www.amazon.jobs/en/search.json?${params.toString()}`)
  const job = (data.jobs ?? []).find((j) => j.id_icims === jobId)
  if (!job) throw new Error(`amazon job ${jobId} not found in search API`)
  const parts = [job.title ?? "Posting"]
  if (job.normalized_location) parts.push(job.normalized_location)
  if (job.posted_date) parts.push(`posted ${job.posted_date}`)
  const body = [
    job.description ? stripHtmlTags(job.description) : "",
    job.basic_qualifications ? `BASIC QUALIFICATIONS:\n${stripHtmlTags(job.basic_qualifications)}` : "",
    job.preferred_qualifications ? `PREFERRED QUALIFICATIONS:\n${stripHtmlTags(job.preferred_qualifications)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
  const footer = job.job_path ? `\n\nApply: https://www.amazon.jobs${job.job_path}` : ""
  return `${parts.join(" — ")}\n\n${body || "(no description returned)"}${footer}`
}

// ── Google / Microsoft careers — evaluated and DECLINED (2026-09-30) ──────
// Google: /api/v3/search/ is gone (404 GET+POST), posting pages are JS-only
// with obfuscated AF_initDataCallback state and no JSON-LD. Microsoft:
// gcsservices.careers.microsoft.com requires an APISessionId cookie minted
// by the SPA; a bare POST returns 403. Both would need browser automation or
// cookie handoff, which this CLI refuses by design. See docs/COMPANY_PORTAL_SCRAPER.md.

// ── Salesforce (Phenom People widgets endpoint on salesforce.my.site.com) ──

interface PhenomJob {
  id: string
  name: string
  location: string | null
  postedDate: string | null
  category?: string | null
}

export const salesforceSearch: Connector = async (board, { query, maxPages }) => {
  const out: NormalizedJob[] = []
  let offset = 0
  for (let i = 0; i < maxPages; i++) {
    const data = await fetchJson<{
      data?: {
        widgetSettings?: { id?: string }
        facetValues?: unknown
        jobs?: Array<PhenomJob & { ts?: string }>
        count?: number
        totalcount?: number
      }
    }>(
      "https://salesforce.my.site.com/tpAppTK__JobSearch",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Phenom's widgets API expects the site origin as referer.
          referer: "https://careers.salesforce.com/en/jobs/",
        },
        body: JSON.stringify({
          query: query ?? "",
          keywords: query ?? "",
          locationOption: "2",
          sortBy: "POSTED_DATE",
          page: Math.floor(offset / 20) + 1,
          limit: 20,
          widgetFilter: ["locationMappingFilter"],
          widget: "JobSearchResults",
          locale: "en",
          locationMappings: [],
        }),
      },
    )
    const jobs = data.data?.jobs ?? []
    for (const j of jobs) {
      out.push({
        id: String(j.id),
        title: clean(j.name),
        company: board.company,
        location: clean(j.location) || "—",
        date: toIsoDate(j.postedDate ?? j.ts),
        url: `https://careers.salesforce.com/en/jobs/${j.id}/`,
        board: "salesforce",
        slug: board.slug,
      })
    }
    offset += jobs.length
    const total = data.data?.totalcount ?? data.data?.count ?? 0
    if (jobs.length === 0 || (total > 0 && offset >= total)) break
  }
  return out
}

export async function salesforceDetail(board: CompanyBoard, id: string): Promise<string> {
  // Detail pages render server-side enough text to parse the JD block.
  const html = await fetchText(`https://careers.salesforce.com/en/jobs/${encodeURIComponent(id)}/`)
  const m = html.match(/<div[^>]*(?:class|id)="[^"]*(?:job-?description|jd)[^"]*"[^>]*>([\s\S]{0,60000}?)<\/div>/i)
  if (m) {
    const text = stripHtmlTags(m[1])
    if (text.length > 200) return text
  }
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? `Salesforce posting ${id}`
  return `${clean(title)}\n\n(Salesforce's detail page is client-rendered; open the URL to read the full posting. Search output carries enough for fit evaluation.)`
}

// ── Workday (CXS jobs endpoint, myworkdayjobs.com tenants) ─────────────────

export const workdaySearch: Connector = async (board, { query, maxPages }) => {
  // slug format: "<tenant>/<site>[/<n>]" — instance myworkdayjobs.com implied.
  const parts = board.slug.split("/")
  const tenant = parts[0]
  const site = parts[1]
  if (!tenant || !site) throw new Error(`invalid workday slug "${board.slug}" (want "tenant/site")`)
  const out: NormalizedJob[] = []
  let offset = 0
  const maxLoops = maxPages > 0 ? maxPages : 500
  for (let i = 0; i < maxLoops; i++) {
    const body: Record<string, unknown> = {
      appliedFacets: {},
      limit: 20,
      offset,
      searchText: query ?? "",
    }
    const data = await fetchJson<{
      total?: number
      jobPostings?: Array<{
        title: string
        externalPath: string
        locationsText?: string
        postedOn?: string
        bulletFields?: string[]
      }>
    }>(
      `https://${tenant}.wd${parts[2] ?? "1"}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    )
    const rows = data.jobPostings ?? []
    for (const j of rows) {
      out.push({
        id: j.externalPath.replace(/^\//, ""),
        title: clean(j.title),
        company: board.company,
        location: clean(j.locationsText) || "—",
        date: toIsoDate(j.postedOn),
        url: `https://${tenant}.wd${parts[2] ?? "1"}.myworkdayjobs.com/en-US/${site}${j.externalPath}`,
        board: "workday",
        slug: board.slug,
      })
    }
    offset += rows.length
    if (rows.length === 0 || (data.total && offset >= data.total)) break
    await sleep(300)
  }
  return out
}

export async function workdayDetail(board: CompanyBoard, externalPath: string): Promise<string> {
  const parts = board.slug.split("/")
  const tenant = parts[0]
  const site = parts[1]
  const path = externalPath.startsWith("http")
    ? externalPath.replace(/^https?:\/\/[^/]+/, "").replace(/^\/en-US\/[^/]+/, "")
    : externalPath.startsWith("/") ? externalPath : `/${externalPath}`
  const data = await fetchJson<{
    jobPostingInfo?: {
      title: string
      jobDescription?: string
      location?: string
      startDate?: string
      timeType?: string
    }
  }>(
    `https://${tenant}.wd${parts[2] ?? "1"}.myworkdayjobs.com/wday/cxs/${tenant}/${site}${path}`,
    { headers: { accept: "application/json" } },
  )
  const info = data.jobPostingInfo
  if (!info) throw new Error(`workday job ${externalPath} not found (shape may have changed)`)
  const body = info.jobDescription ? stripHtmlTags(info.jobDescription) : "(no description returned)"
  return `${info.title ?? "Posting"}${info.location ? ` — ${info.location}` : ""}\n\n${body}`
}
