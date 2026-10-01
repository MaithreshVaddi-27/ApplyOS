// Connectors for the four hosted-ATS platforms with clean public JSON APIs:
// Greenhouse, Lever, Ashby, SmartRecruiters. Endpoint shapes verified against
// career-ops-hq/career-ops provider docs (Sept 2026). All zero-auth.

import { fetchJson, clean, toIsoDate, stripHtmlTags, decodeHtmlEntities, sleep } from "../helpers.js"
import type { CompanyBoard, NormalizedJob, Connector } from "../types.js"

// ── Greenhouse ──────────────────────────────────────────────────────────────

export const greenhouseSearch: Connector = async (board, { query, maxPages }) => {
  const out: NormalizedJob[] = []
  let offset = 0
  const page = 100
  // maxPages <= 0 means "no cap" (bounded by the board being exhausted).
  const maxLoops = maxPages > 0 ? maxPages : 500
  for (let i = 0; i < maxLoops; i++) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs?content=true&offset=${offset}`
    const data = await fetchJson<{
      jobs?: Array<{
        id: number | string
        title: string
        updated_at?: string
        location?: { name?: string }
        absolute_url?: string
        content?: string
      }>
      meta?: { total?: number }
    }>(url)
    const jobs = data.jobs ?? []
    for (const j of jobs) {
      if (query) {
        const target = `${j.title} ${clean(j.location?.name)}`.toLowerCase()
        if (!target.includes(query.toLowerCase())) continue
      }
      out.push({
        id: String(j.id),
        title: clean(j.title),
        company: board.company,
        location: clean(j.location?.name) || "—",
        date: toIsoDate(j.updated_at),
        url: j.absolute_url ?? `https://job-boards.greenhouse.io/${board.slug}/jobs/${j.id}`,
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
  const data = await fetchJson<{ title?: string; content?: string }>(
    `https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs/${encodeURIComponent(id)}?content=true`,
  )
  // Greenhouse returns content as double-encoded HTML: HTML-escaped markup
  // (&lt;div&gt;...), not base64. Decode entities first, then strip tags.
  const body = data.content ? stripHtmlTags(decodeHtmlEntities(data.content)) : "(no content returned)"
  return `${data.title ?? "Posting"}\n\n${body}`
}

// ── Lever ───────────────────────────────────────────────────────────────────

export const leverSearch: Connector = async (board, { query }) => {
  const data = await fetchJson<Array<{
    id?: string
    text?: string
    hostedUrl?: string
    createdAt?: number
    description?: string
    descriptionPlain?: string
    categories?: { location?: string; team?: string; commitment?: string }
  }>>(`https://api.lever.co/v0/postings/${board.slug}?mode=json`)
  const out: NormalizedJob[] = []
  for (const j of data ?? []) {
    if (query) {
      const target = `${j.text ?? ""} ${clean(j.categories?.location)} ${clean(j.categories?.team)} ${j.descriptionPlain ?? ""}`.toLowerCase()
      if (!target.includes(query.toLowerCase())) continue
    }      out.push({
        id: String(j.id ?? ""),
        title: clean(j.text),
        company: board.company,
        location: clean(j.categories?.location) || "—",
        date: toIsoDate(j.createdAt),
        url: j.hostedUrl ?? `https://jobs.lever.co/${board.slug}/${j.id ?? ""}`,
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
  const data = await fetchJson<
    Array<{
      id?: string
      text?: string
      description?: string
      descriptionPlain?: string
      lists?: Array<{ text?: string; content?: string }>
    }>
  >(`https://api.lever.co/v0/postings/${board.slug}?mode=json`)
  const job = (data ?? []).find((j) => String(j.id) === id)
  if (!job) throw new Error(`posting ${id} not found on lever board ${board.slug}`)
  const body = leverText(job)
  return `${job.text ?? "Posting"}\n\n${body || "(no description returned)"}`
}

// ── Ashby ───────────────────────────────────────────────────────────────────

export const ashbySearch: Connector = async (board, { query }) => {
  const data = await fetchJson<{
    jobs?: Array<{
      id?: string
      title?: string
      location?: string
      isRemote?: boolean
      jobUrl?: string
      publishedAt?: string
      descriptionPlain?: string
    }>
  }>(
    `https://api.ashbyhq.com/non-authed/posting-api/job-board/${board.slug}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
  )
  const out: NormalizedJob[] = []
  for (const j of data.jobs ?? []) {
    if (query) {
      const target = `${j.title ?? ""} ${j.location ?? ""} ${j.descriptionPlain ?? ""}`.toLowerCase()
      if (!target.includes(query.toLowerCase())) continue
    }
    out.push({
      id: String(j.id ?? ""),
      title: clean(j.title),
      company: board.company,
      location: clean(j.location) || (j.isRemote ? "Remote" : "—"),
      date: toIsoDate(j.publishedAt),
      url: j.jobUrl ?? `https://jobs.ashbyhq.com/${board.slug}/${j.id ?? ""}`,
      description: j.descriptionPlain?.slice(0, 1200),
      board: "ashby",
      slug: board.slug,
    })
  }
  return out
}

export async function ashbyDetail(board: CompanyBoard, id: string): Promise<string> {
  const data = await fetchJson<{ jobs?: Array<{ id?: string; title?: string; descriptionPlain?: string }> }>(
    `https://api.ashbyhq.com/non-authed/posting-api/job-board/${board.slug}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
  )
  const job = (data.jobs ?? []).find((j) => String(j.id) === id)
  if (!job) throw new Error(`posting ${id} not found on ashby board ${board.slug}`)
  return `${job.title ?? "Posting"}\n\n${job.descriptionPlain ?? "(no description returned)"}`
}

// ── SmartRecruiters ─────────────────────────────────────────────────────────

export const smartrecruitersSearch: Connector = async (board, { query, maxPages }) => {
  const out: NormalizedJob[] = []
  let offset = 0
  const limit = 50
  const maxLoops = maxPages > 0 ? maxPages : 500
  for (let i = 0; i < maxLoops; i++) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (query) params.set("q", query)
    const data = await fetchJson<{
      totalFound?: number
      content?: Array<{
        id?: string
        name?: string
        releasedDate?: string
        location?: { city?: string; region?: string; country?: string }
        company?: { name?: string }
      }>
    }>(`https://api.smartrecruiters.com/v1/companies/${board.slug}/postings?${params.toString()}`)
    const rows = data.content ?? []
    for (const j of rows) {
      const loc = [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(", ")
      out.push({
        id: String(j.id ?? ""),
        title: clean(j.name),
        company: clean(j.company?.name) || board.company,
        location: loc || "—",
        date: toIsoDate(j.releasedDate),
        url: `https://jobs.smartrecruiters.com/${board.slug}/${j.id ?? ""}`,
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
  const data = await fetchJson<{
    name?: string
    location?: { city?: string; country?: string }
    releasedDate?: string
    jobAd?: { sections?: Record<string, { text?: string; title?: string }> }
  }>(`https://api.smartrecruiters.com/v1/companies/${board.slug}/postings/${encodeURIComponent(id)}`)
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
