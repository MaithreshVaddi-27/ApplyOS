// The four hosted-ATS platforms, as thin surfaces over the provider SDK.
//
// The board endpoints, fetch policy and neutral parsers live ONCE in
// applyos/packages/provider/src/{greenhouse,lever,ashby,smartrecruiters}.ts.
// Phase 4.7 stage six. What stays here is this CLI's own row conventions:
// 1200-character descriptions, the "Remote" place for a remote-only Ashby job,
// per-board URL fallbacks and the detail strings readers have always seen.
import type { CompanyBoard, NormalizedJob, Connector } from "../types.js"
import {
  fetchGreenhouseJobs,
  fetchGreenhousePayload,
  mapGreenhouseJob,
} from "../../../../../../applyos/packages/provider/src/greenhouse.js"
import {
  fetchLeverPostings,
  mapLeverJob,
} from "../../../../../../applyos/packages/provider/src/lever.js"
import {
  fetchAshbyPostings,
  mapAshbyJob,
  ashbyBody,
} from "../../../../../../applyos/packages/provider/src/ashby.js"
import {
  fetchSmartRecruitersPage,
  fetchSmartRecruitersPayload,
  mapSmartRecruitersJob,
} from "../../../../../../applyos/packages/provider/src/smartrecruiters.js"
import {
  decodeHtmlEntities,
  stripHtmlTags,
} from "../../../../../../applyos/packages/provider/src/text.js"
import { clean, sleep, toIsoDate } from "../helpers.js"

// (helpers are imported once; the board parsers come from the SDK above)

// ── Greenhouse ──────────────────────────────────────────────────────────────

export const greenhouseSearch: Connector = async (board, { query, maxPages }) => {
  const out: NormalizedJob[] = []
  let offset = 0
  const page = 100
  const maxLoops = maxPages > 0 ? maxPages : 500
  for (let i = 0; i < maxLoops; i++) {
    const data = await fetchGreenhouseJobs(board.slug, offset, true)
    const jobs = data.jobs ?? []
    for (const j of jobs) {
      const row = mapGreenhouseJob(board.slug, j)
      if (!row) continue
      if (query) {
        const target = `${row.title} ${row.location ?? ""}`.toLowerCase()
        if (!target.includes(query.toLowerCase())) continue
      }
      out.push({
        id: row.id,
        title: row.title,
        company: board.company,
        location: row.location,
        // The SDK carries the board's raw timestamp; this CLI has always
        // shortened it to YYYY-MM-DD.
        date: toIsoDate(row.date),
        url: row.url || `https://job-boards.greenhouse.io/${board.slug}/jobs/${row.id}`,
        description: j.content ? stripHtmlTags(j.content).slice(0, 1200) : undefined,
        board: "greenhouse",
        slug: board.slug,
      })
    }
    offset += jobs.length
    const total = data.meta?.total ?? 0
    if (offset >= total || jobs.length === 0) break
    await sleep(300)
  }
  return out
}

export async function greenhouseDetail(board: CompanyBoard, id: string): Promise<string> {
  const data = await fetchGreenhousePayload(board.slug, id)
  // Greenhouse returns content as double-encoded HTML: decode entities first.
  const body = data.content ? stripHtmlTags(decodeHtmlEntities(data.content)) : "(no content returned)"
  return `${data.title ?? "Posting"}\n\n${body}`
}

// ── Lever ───────────────────────────────────────────────────────────────────

export const leverSearch: Connector = async (board, { query }) => {
  const postings = await fetchLeverPostings(board.slug)
  const out: NormalizedJob[] = []
  for (const j of postings) {
    const row = mapLeverJob(board.slug, j)
    if (!row) continue
    if (query) {
      const target = `${row.title} ${clean(j.categories?.location)} ${clean(j.categories?.team)} ${j.descriptionPlain ?? ""}`.toLowerCase()
      if (!target.includes(query.toLowerCase())) continue
    }
    out.push({
      id: row.id,
      title: row.title,
      company: board.company,
      location: row.location,
      date: row.date,
      url: row.url || `https://jobs.lever.co/${board.slug}/${row.id}`,
      description: (j.descriptionPlain || (j.description ? stripHtmlTags(j.description) : "")).slice(0, 1200) || undefined,
      board: "lever",
      slug: board.slug,
    })
  }
  return out
}

/** Build readable plain text from a Lever posting's HTML fields. */
function leverText(job: {
  description?: string
  descriptionPlain?: string
  lists?: Array<{ text?: string; content?: string }>
}): string {
  const parts: string[] = []
  if (job.descriptionPlain) parts.push(job.descriptionPlain)
  else if (job.description) parts.push(stripHtmlTags(job.description))
  for (const list of job.lists ?? []) {
    if (!list.content) continue
    const heading = list.text ? `## ${list.text}\n` : ""
    parts.push(`${heading}${stripHtmlTags(list.content)}`)
  }
  return parts.filter((p) => p.trim().length > 0).join("\n\n")
}

export async function leverDetail(board: CompanyBoard, id: string): Promise<string> {
  const postings = await fetchLeverPostings(board.slug)
  const job = postings.find((j) => String(j.id) === id)
  if (!job) throw new Error(`posting ${id} not found on lever board ${board.slug}`)
  const body = leverText(job)
  return `${job.text ?? "Posting"}\n\n${body || "(no description returned)"}`
}

// ── Ashby ───────────────────────────────────────────────────────────────────

export const ashbySearch: Connector = async (board, { query }) => {
  const postings = await fetchAshbyPostings(board.slug)
  const out: NormalizedJob[] = []
  for (const j of postings) {
    const row = mapAshbyJob(board.slug, j)
    if (!row) continue
    if (query) {
      const target = `${row.title} ${row.location ?? ""} ${row.description ?? ""}`.toLowerCase()
      if (!target.includes(query.toLowerCase())) continue
    }
    out.push({
      id: row.id,
      title: row.title,
      company: board.company,
      // The CLI's long-standing convention: a remote-only posting reads
      // "Remote" when the board stated no place. The SDK keeps both facts.
      location: row.location || (row.remote ? "Remote" : null),
      date: row.date,
      url: row.url,
      description: row.description ?? undefined,
      board: "ashby",
      slug: board.slug,
    })
  }
  return out
}

export async function ashbyDetail(board: CompanyBoard, id: string): Promise<string> {
  const postings = await fetchAshbyPostings(board.slug)
  const job = postings.find((j) => String(j.id) === id)
  if (!job) throw new Error(`posting ${id} not found on ashby board ${board.slug}`)
  return ashbyBody(job)
}

// ── SmartRecruiters ─────────────────────────────────────────────────────────

export const smartrecruitersSearch: Connector = async (board, { query, maxPages }) => {
  const out: NormalizedJob[] = []
  let offset = 0
  const limit = 50
  const maxLoops = maxPages > 0 ? maxPages : 500
  for (let i = 0; i < maxLoops; i++) {
    const data = await fetchSmartRecruitersPage(board.slug, offset, query ?? "")
    const rows = data.content ?? []
    for (const j of rows) {
      const mapped = mapSmartRecruitersJob(board.slug, j)
      if (!mapped) continue
      const loc = [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(", ")
      out.push({
        id: mapped.id,
        title: mapped.title,
        // The CLI takes the tenant's own company name when the board states one.
        company: clean(j.company?.name) || board.company,
        location: loc || null,
        date: j.releasedDate ? toIsoDate(j.releasedDate) : null,
        url: mapped.url,
        board: "smartrecruiters",
        slug: board.slug,
      })
    }
    offset += rows.length
    if (rows.length < limit) break
    if (data.totalFound && offset >= data.totalFound) break
    await sleep(300)
  }
  return out
}

export async function smartrecruitersDetail(board: CompanyBoard, id: string): Promise<string> {
  const data = await fetchSmartRecruitersPayload(board.slug, id)
  const sections = data.jobAd?.sections ?? {}
  const parts: string[] = []
  for (const [key, sec] of Object.entries(sections)) {
    if (sec.text) {
      parts.push(`## ${sec.title ?? key}\n${stripHtmlTags(sec.text)}`)
    }
  }
  const loc = [data.location?.city, data.location?.country].filter(Boolean).join(", ")
  return `${data.name ?? "Posting"}${loc ? ` — ${loc}` : ""}${data.releasedDate ? ` (released ${data.releasedDate})` : ""}\n\n${parts.join("\n\n")}`
}
