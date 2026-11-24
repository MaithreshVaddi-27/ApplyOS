// The four enterprise career portals, as thin surfaces over the provider SDK.
//
// Board endpoints, fetch policy and neutral parsers live ONCE in
// applyos/packages/provider/src/{amazon,workday,salesforce,eightfold}.ts.
// Phase 4.7 stage six. This CLI keeps only its own row conventions: id_icims
// for Amazon, the tenant/site/instance slug for Workday, 1200-character
// descriptions, the newline-preserving text rule and its detail strings.
import type { CompanyBoard, NormalizedJob, Connector } from "../types.js"
import { clean, sleep, toIsoDate } from "../helpers.js"
import {
  amazonCliId,
  amazonCliBody,
  fetchAmazonCliDetail,
  fetchAmazonCliPage,
} from "../../../../../../applyos/packages/provider/src/amazon.js"
import {
  fetchWorkdayPage,
  fetchWorkdayJobPayload,
  parseWorkdaySlug,
  workdayCliBody,
  workdayDetailPath,
} from "../../../../../../applyos/packages/provider/src/workday.js"
import {
  fetchSalesforcePage,
  fetchSalesforceDetailHtml,
  mapSalesforceJob,
  salesforceDetailText,
} from "../../../../../../applyos/packages/provider/src/salesforce.js"
import {
  fetchEightfoldPage,
  fetchEightfoldJobPayload,
  mapEightfoldJob,
  eightfoldBody,
} from "../../../../../../applyos/packages/provider/src/eightfold.js"
import { stripHtmlTags } from "../../../../../../applyos/packages/provider/src/text.js"

// ── Eightfold ──────────────────────────────────────────────────────────────

export const eightfoldSearch: Connector = async (board, { query, maxPages }) => {
  const out: NormalizedJob[] = []
  let start = 0
  const num = 100
  const maxLoops = maxPages > 0 ? maxPages : 500
  for (let i = 0; i < maxLoops; i++) {
    const data = await fetchEightfoldPage(board.slug, start, query ?? "")
    const rows = data.positions ?? []
    for (const j of rows) {
      const mapped = mapEightfoldJob(board.slug, j)
      if (!mapped) continue
      out.push({
        id: mapped.id,
        title: clean(j.name),
        company: board.company,
        location: clean(j.location ?? j.sc_city) || null,
        date: toIsoDate(j.date_published),
        url: mapped.url,
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
  const data = await fetchEightfoldJobPayload(board.slug, id)
  const pos = data.position
  if (!pos) throw new Error(`eightfold job ${id} not found (shape may have changed)`)
  return eightfoldBody(pos)
}

// ── Amazon / AWS ───────────────────────────────────────────────────────────

export const amazonSearch: Connector = async (board, { query, maxPages }) => {
  const out: NormalizedJob[] = []
  let offset = 0
  const maxLoops = maxPages > 0 ? maxPages : 500
  const country = board.slug === "india" ? "IND" : undefined
  for (let i = 0; i < maxLoops; i++) {
    const data = await fetchAmazonCliPage(query ?? "", country, offset)
    const rows = data.jobs ?? []
    for (const j of rows) {
      out.push({
        id: String(j.id_icims ?? ""),
        title: clean(j.title),
        company: j.company_name ?? board.company,
        location: clean(j.normalized_location ?? j.location) || null,
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
  const jobId = amazonCliId(idOrPath)
  const data = await fetchAmazonCliDetail(jobId)
  const job = (data.jobs ?? []).find((j) => j.id_icims === jobId)
  if (!job) throw new Error(`amazon job ${jobId} not found in search API`)
  return amazonCliBody(job)
}

// ── Google / Microsoft careers — declined (see docs/COMPANY_PORTAL_SCRAPER.md) ──

// ── Salesforce ─────────────────────────────────────────────────────────────

export const salesforceSearch: Connector = async (board, { query, maxPages }) => {
  const out: NormalizedJob[] = []
  let offset = 0
  const maxLoops = maxPages > 0 ? maxPages : 500
  for (let i = 0; i < maxLoops; i++) {
    const data = await fetchSalesforcePage(query ?? "", Math.floor(offset / 20) + 1)
    const jobs = data.data?.jobs ?? []
    for (const j of jobs) {
      const mapped = mapSalesforceJob(j)
      if (!mapped) continue
      out.push({
        id: mapped.id,
        title: mapped.title,
        company: board.company,
        location: mapped.location,
        date: mapped.date,
        url: mapped.url,
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
  const html = await fetchSalesforceDetailHtml(id)
  return salesforceDetailText(id, html)
}

// ── Workday ────────────────────────────────────────────────────────────────

export const workdaySearch: Connector = async (board, { query, maxPages }) => {
  const target = parseWorkdaySlug(board.slug)
  const out: NormalizedJob[] = []
  let offset = 0
  const maxLoops = maxPages > 0 ? maxPages : 500
  for (let i = 0; i < maxLoops; i++) {
    const data = await fetchWorkdayPage(target, offset, query ?? "")
    const rows = data.jobPostings ?? []
    for (const j of rows) {
      out.push({
        id: String(j.externalPath ?? "").replace(/^\//, ""),
        title: clean(j.title),
        company: board.company,
        location: clean(j.locationsText) || null,
        date: toIsoDate(j.postedOn),
        url: `https://${target.tenant}.${target.instance}.myworkdayjobs.com/en-US/${target.site}${j.externalPath}`,
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
  const target = parseWorkdaySlug(board.slug)
  const path = workdayDetailPath(externalPath, target.site)
  const data = await fetchWorkdayJobPayload(target, path)
  const info = data.jobPostingInfo
  if (!info) throw new Error(`workday job ${externalPath} not found (shape may have changed)`)
  return workdayCliBody(info)
}
