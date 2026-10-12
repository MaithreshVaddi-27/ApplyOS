// Data source: Internshala public job/internship listings across India.
// No authentication required. Zero runtime dependencies.
// Personal use only.

export const BASE_URL = "https://internshala.com"

export { writeError } from "../../../cli-shared/src/errors.js"
import { decodeHtmlEntities } from "../../../cli-shared/src/entities.js"
export { decodeHtmlEntities }

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 5
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobCard {
  salary: string | null
  description: string | null
  skills: string[]
  perks: string[]
  numberOfOpenings: string | null
  whoCanApply: string | null
}

/**
 * Client-side query-relevance filter. Internshala's combined keyword+city URL
 * can fall back to a city listing page (e.g. sales roles for any tech query in
 * Hyderabad), so keep only cards whose title or company matches ALL query
 * words. Words match on stem-prefix (>= 5 shared chars) so "developer" matches
 * a "Development" title; generic collisions like "Business Development" for a
 * "web development" query are dropped because the other word doesn't match.
 * Like careers-search's query filter this is a hard filter — if nothing
 * matches, an empty result is more truthful than an unrelated city page.
 */
/**
 * Parse Internshala's relative posting dates ("3 days ago", "30+ days ago",
 * "1 week ago", "2 months ago", "Just now") to a millisecond timestamp.
 * Months approximate to 30 days — the source text's granularity makes that
 * exact enough. Absolute ISO dates (the shape normalizeCardDate emits into
 * `date`) parse directly so jobage filtering keeps working on normalized
 * cards. Returns NaN for anything unreadable; callers keep the card in that
 * case.
 */
export function parsePostedAgo(text: string | null): number {
  if (!text) return NaN
  const t = text.trim().toLowerCase()
  if (t === "just now") return Date.now()
  const m = t.match(/(\d+)\+?\s*(hour|day|week|month)s?\s+ago/)
  if (m) {
    const n = parseInt(m[1], 10)
    const unitMs: Record<string, number> = {
      hour: 3_600_000,
      day: 86_400_000,
      week: 604_800_000,
      month: 2_592_000_000,
    }
    return Date.now() - n * unitMs[m[2]]
  }
  // Absolute-date fallback, deliberately ISO-shaped only: a loose Date.parse
  // here would "read" prose like "some time in 2024" as a real timestamp.
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const abs = Date.parse(text)
    return Number.isNaN(abs) ? NaN : abs
  }
  return NaN
}

/**
 * Normalize a card's raw date label to YYYY-MM-DD for the `date` contract
 * field (P-M15). Relative labels resolve via parsePostedAgo, ISO-shaped
 * strings pass through; anything unparseable (status text like "Actively
 * hiring") is null — never the raw relative text.
 */
export function normalizeCardDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === "number") {
    const ms = raw > 1e12 ? raw : raw * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  const s = String(raw).trim()
  if (!s) return null
  const rel = parsePostedAgo(s)
  if (!Number.isNaN(rel)) return new Date(rel).toISOString().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const abs = new Date(s)
    if (!Number.isNaN(abs.getTime())) return abs.toISOString().slice(0, 10)
  }
  return null
}

export function filterByQuery(cards: JobCard[], query: string): JobCard[] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)
    .filter((w) => w.length > 1)
  if (words.length === 0) return cards
  // Match two tokens when one extends the other (intern ↔ internship) or when
  // they share a >= 7-char stem (developer ↔ development). The stem threshold
  // stays above the 6-char "intern" shared by internship/international so a
  // query for one does not surface the other.
  const stemsMatch = (a: string, b: string): boolean => {
    if (a === b) return true
    const min = Math.min(a.length, b.length)
    let shared = 0
    while (shared < min && a[shared] === b[shared]) shared++
    return (min >= 5 && shared === min) || shared >= 7
  }
  return cards.filter((c) => {
    const tokens = `${c.title} ${c.company ?? ""}`
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter(Boolean)
    return words.every((w) => tokens.some((t) => stemsMatch(w, t)))
  })
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/** Slugify query string for Internshala URL paths. */
export { slugify } from "../../../cli-shared/src/text.js"

/**
 * Parse the search response: a list of job/internship cards.
 * We split on `id="individual_internship_` and parse each chunk independently
 * so one malformed card cannot break the rest.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/id="individual_internship_/).slice(1)

  for (const chunk of chunks) {
    // Title
    const titleMatch =
      chunk.match(/class="job-title-href"[^>]*>([^<]+)<\/a>/i) ||
      chunk.match(/class="job-internship-name"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
      chunk.match(/class="heading_4_5 profile"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)
    if (!titleMatch) continue
    const title = clean(titleMatch[1])
    if (!title) continue

    // URL & ID
    const hrefMatch = chunk.match(/data-href=['"]([^'"]+)['"]/i)
    let rawPath = hrefMatch ? hrefMatch[1].split("?")[0] : ""
    if (!rawPath) {
      const linkMatch = chunk.match(/class="job-title-href"[^>]*href=['"]([^'"]+)['"]/i)
      rawPath = linkMatch ? linkMatch[1].split("?")[0] : ""
    }
    const url = rawPath ? (rawPath.startsWith("http") ? rawPath : `${BASE_URL}${rawPath}`) : ""

    // ID is derived from the URL path slug (e.g. `software-developer-178876`) or the numeric ID
    let id = ""
    if (rawPath) {
      const slugParts = rawPath.replace(/^\/(?:job|internship)\/detail\//, "").replace(/\/$/, "")
      id = slugParts
    }
    if (!id) {
      const numMatch = chunk.match(/^(\d+)/)
      id = numMatch ? numMatch[1] : ""
    }
    if (!id) continue

    // Company
    const compMatch =
      chunk.match(/class="company-name"[^>]*>\s*([\s\S]*?)\s*<\/p>/i) ||
      chunk.match(/class="link_display_like_text"[^>]*>([^<]+)<\/a>/i) ||
      chunk.match(/class="heading_6 company_name"[^>]*>[\s\S]*?<p[^>]*>([^<]+)<\/p>/i)
    const company = compMatch ? clean(compMatch[1]) || null : null

    // Location
    const locMatch =
      chunk.match(/class="[^"]*locations[^"]*"[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
      chunk.match(/class="[^"]*locations[^"]*"[\s\S]*?<span>\s*([^<]+)\s*<\/span>/i)
    const location = locMatch ? clean(locMatch[1]) || null : null

    // Date / recency — normalized to YYYY-MM-DD (P-M15), null when the
    // status text ("Actively hiring") carries no date.
    const dateMatch = chunk.match(
      /class="(?:status-inactive|status-success|status-info|status-warning|status-container)"[^>]*>[\s\S]*?<span>\s*([^<]+)\s*<\/span>/i,
    )
    const date = dateMatch ? normalizeCardDate(clean(dateMatch[1])) : null

    results.push({
      id,
      title,
      company,
      location,
      date,
      url: url || `${BASE_URL}/job/detail/${id}`,
    })
  }

  return results
}

/** Parse a single job/internship detail page. */
export function parseJobDetail(html: string, url: string, id: string): JobDetail {
  // Title
  const titleMatch =
    html.match(/class="profile_on_detail_page"[^>]*>([^<]+)<\/span>/i) ||
    html.match(/class="job-internship-name"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
    html.match(/class="heading_4_5 profile"[^>]*>([^<]+)<\/h[12]>/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
  const title = titleMatch ? clean(titleMatch[1]) : "Job Detail"

  // Company
  const compMatch =
    html.match(/class="link_display_like_text"[^>]*>([^<]+)<\/a>/i) ||
    html.match(/class="company-name"[^>]*>([^<]+)<\/p>/i) ||
    html.match(/class="heading_6 company_name"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)
  const company = compMatch ? clean(compMatch[1]) || null : null

  // Location
  const locMatch =
    html.match(/class="[^"]*locations[^"]*"[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
    html.match(/class="[^"]*locations[^"]*"[\s\S]*?<span>\s*([^<]+)\s*<\/span>/i) ||
    html.match(/id="location_names"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)
  const location = locMatch ? clean(locMatch[1]) || null : null

  // Salary / Stipend
  const stipendMatch =
    html.match(/class=['"]stipend['"][^>]*>([^<]+)<\/span>/i) ||
    html.match(/class=['"]desktop['"][^>]*>([^<]+)<\/span>/i) ||
    html.match(/class=['"]salary_heading['"][^>]*>([^<]+)<\/div>/i)
  const salary = stipendMatch ? clean(stipendMatch[1]) || null : null

  // Description
  let description: string | null = null
  const descMatch =
    html.match(/class="text-container(?:\s+about_job_text)?"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/class="internship_details"[\s\S]*?<div class="text-container"[^>]*>([\s\S]*?)<\/div>/i)
  if (descMatch) {
    description = decodeHtmlEntities(
      descMatch[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s+\n/g, "\n\n")
        .trim(),
    )
  }

  // Skills — the round_tabs_container headed "Skill(s) required". Scoped to
  // that section on purpose: perks use the identical span markup under their
  // own "Perks" heading, and a whole-page sweep leaks them into skills.
  const skills: string[] = []
  const skillsSection =
    html.match(/Skill\(s\) required[\s\S]*?<div class="round_tabs_container"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/class="round_tabs_container"[^>]*>([\s\S]*?)<\/div>/i)
  if (skillsSection) {
    for (const m of skillsSection[1].matchAll(/class="round_tabs"[^>]*>([^<]+)<\/span>/gi)) {
      const s = clean(m[1])
      if (s && !skills.includes(s)) skills.push(s)
    }
  }

  // Perks — the round_tabs_container under the perks_heading ("Perks"). The
  // old anchor (round_tabs_container perks_container) no longer exists in
  // Internshala's markup, which left every detail's perks empty.
  const perks: string[] = []
  const perkSection = html.match(/perks_heading[\s\S]*?<div class="round_tabs_container"[^>]*>([\s\S]*?)<\/div>/i)
  if (perkSection) {
    for (const m of perkSection[1].matchAll(/class="round_tabs"[^>]*>([^<]+)<\/span>/gi)) {
      const p = clean(m[1])
      if (p && !perks.includes(p)) perks.push(p)
    }
  }

  // Number of openings — current markup is a "Number of openings" heading
  // followed by a text-container div; the old other_detail_item_row shape is
  // kept as a fallback for pages that still render it.
  const openingsMatch =
    html.match(/Number of openings[\s\S]*?<div class="text-container"[^>]*>\s*(\d+)\s*</i) ||
    html.match(/class="other_detail_item_row"[\s\S]*?Number of openings[\s\S]*?<div class="text">(\d+)<\/div>/i)
  const numberOfOpenings = openingsMatch ? openingsMatch[1] : null

  // Who can apply — match the class token anywhere in the class attribute:
  // Internshala renders `class="text-container who_can_apply"`, so the old
  // literal `class="who_can_apply"` prefix never matched and the field was
  // always null.
  let whoCanApply: string | null = null
  const whoMatch = html.match(/class="[^"]*who_can_apply[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
  if (whoMatch) {
    whoCanApply = clean(whoMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
  }

  return {
    id,
    title,
    company,
    location,
    date: null,
    salary,
    description,
    skills,
    perks,
    numberOfOpenings,
    whoCanApply,
    url: url || `${BASE_URL}/job/detail/${id}`,
  }
}
