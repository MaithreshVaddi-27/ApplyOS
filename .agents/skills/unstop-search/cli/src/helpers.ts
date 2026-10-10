// Helpers for unstop-cli: fetching with backoff, parsing API responses, sanitization.

export const BASE_URL = "https://unstop.com"
export const API_URL = "https://unstop.com/api/public/opportunity/search-result"
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  type: string | null
  /** Full-time / part-time / flexible (jobDetail.timing), so remote & part-time internships filter without a detail fetch. */
  employmentType: string | null
  /** Remote / hybrid / on-site (jobDetail.type). */
  workplaceType: string | null
}

export interface JobDetail {
  id: string
  url: string
  title: string
  company: string | null
  location: string | null
  salary: string | null
  employmentType: string | null
  workplaceType: string | null
  deadline: string | null
  skills: string[]
  description: string
  eligibility: string[]
}

export function writeError(message: string, code: string): void {
  process.stderr.write(JSON.stringify({ error: message, code }) + "\n")
}

/**
 * Normalize a card salary string to an [minLpa, maxLpa] range. Unstop cards
 * mix monthly INR ("₹ 25,000 - 40,000") and annual LPA ("6-8 LPA") figures;
 * comparing raw numbers against the --salary LPA range never filtered.
 * Returns null when no usable figure exists (caller keeps the card).
 */
export function salaryToLpaRange(salary: string): [number, number] | null {
  const nums = (salary.match(/[\d,]+(?:\.\d+)?/g) ?? [])
    .map((n) => parseFloat(n.replace(/,/g, "")))
    .filter((n) => !isNaN(n))
  if (nums.length === 0) return null
  const s = salary.toLowerCase()
  const annualMarkers = /(lpa|lakh|per annum|per year|\/yr|\/year|annual|p\.?\s*a\.?)/
  const monthlyMarkers = /(per month|\/month|monthly|p\.?\s*m\.?|stipend)/
  // Shared rupee→LPA conversion: raw figures >1000 are rupees, small
  // numbers are already LPA (e.g. "6-8", "4.5").
  const toAnnualLpa = (v: number) => (v > 1000 ? v / 100000 : v)
  let min: number
  let max: number
  if (annualMarkers.test(s)) {
    // Annual figure: raw rupees (>1000) need /100000; small numbers are LPA already.
    min = toAnnualLpa(nums[0])
    max = toAnnualLpa(nums.length > 1 ? nums[nums.length - 1] : nums[0])
  } else if (monthlyMarkers.test(s)) {
    // Monthly INR only when an explicit month indicator is present:
    // annualize, then convert to LPA. A bare figure (even <₹5L) is an
    // annual amount — inferring monthly from magnitude misclassified
    // annual ₹ figures below ₹5,00,000 (P-M8).
    min = (nums[0] * 12) / 100000
    max = ((nums.length > 1 ? nums[nums.length - 1] : nums[0]) * 12) / 100000
  } else {
    // Unmarked figure: assume annual in the stated currency.
    min = toAnnualLpa(nums[0])
    max = toAnnualLpa(nums.length > 1 ? nums[nums.length - 1] : nums[0])
  }
  return [Math.min(min, max), Math.max(min, max)]
}

export async function fetchWithBackoff(url: string, retries = 3): Promise<Response> {
  let attempt = 0
  let delay = 300

  while (true) {
    attempt++
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json, text/plain, */*",
        },
        // A hung portal must never hang /scrape: 15s per attempt, then retry/fail.
        signal: AbortSignal.timeout(15000),
      })

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        if (attempt >= retries) return res
        const jitter = Math.random() * 200
        await new Promise((resolve) => setTimeout(resolve, delay + jitter))
        delay *= 2
        continue
      }

      return res
    } catch (e) {
      if (attempt >= retries) throw e
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2
    }
  }
}

export function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
}

export function stripHtmlTags(raw: string): string {
  return decodeHtmlEntities(
    raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li>/gi, "• ")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export interface UnstopOpportunityItem {
  id: number
  title?: string
  public_url?: string
  type?: string
  subtype?: string
  updated_at?: string
  end_date?: string
  details?: string
  organisation?: {
    name?: string
  }
  locations?: Array<{
    city?: string
    state?: string
    country?: string
  }>
  jobDetail?: {
    min_salary?: number
    max_salary?: number
    currency?: string
    type?: string
    timing?: string
    locations?: string[]
  }
  required_skills?: Array<{
    skill?: string
    skill_name?: string
  }>
  filters?: Array<{
    name?: string
    type?: string
  }>
}

export function formatSalary(jobDetail?: UnstopOpportunityItem["jobDetail"]): string | null {
  if (!jobDetail) return null
  const min = jobDetail.min_salary
  const max = jobDetail.max_salary
  const currencySymbol = jobDetail.currency === "fa-rupee" ? "₹" : jobDetail.currency || ""

  if (min && max) {
    if (min === max) {
      return `${currencySymbol} ${min.toLocaleString("en-IN")}`
    }
    return `${currencySymbol} ${min.toLocaleString("en-IN")} - ${max.toLocaleString("en-IN")}`
  }
  if (min) return `${currencySymbol} ${min.toLocaleString("en-IN")}`
  if (max) return `${currencySymbol} ${max.toLocaleString("en-IN")}`
  return null
}

export function parseOpportunityCard(item: UnstopOpportunityItem): JobCard {
  const id = String(item.id)
  const title = item.title || "Untitled"
  const company = item.organisation?.name || null

  let location: string | null = null
  if (item.jobDetail?.locations && item.jobDetail.locations.length > 0) {
    location = item.jobDetail.locations.join(", ")
  } else if (item.locations && item.locations.length > 0) {
    const locNames = item.locations.map((l) => l.city || l.state || l.country).filter(Boolean)
    location = locNames.length > 0 ? locNames.join(", ") : null
  }

  // P-M16: `date` is sourced from `updated_at` deliberately. The search API
  // payload carries no publication/posted field (only `updated_at` and the
  // application `end_date`, which is a deadline, not a posting date), so
  // there is nothing truer to prefer — an edit-bump can refresh it, but
  // inventing a date would be worse. Kept, documented here.
  let date: string | null = null
  if (item.updated_at) {
    const d = new Date(item.updated_at)
    if (!isNaN(d.getTime())) {
      date = d.toISOString().split("T")[0]
    }
  }

  const path = item.public_url ? item.public_url.replace(/^\/+/, "") : `jobs/${id}`
  const url = `${BASE_URL}/${path}`
  const salary = formatSalary(item.jobDetail)

  return {
    id,
    title,
    company,
    location,
    date,
    url,
    salary,
    type: item.type || item.subtype || "job",
    employmentType: item.jobDetail?.timing ?? null,
    workplaceType: item.jobDetail?.type ?? null,
  }
}

export function parseOpportunityDetail(item: UnstopOpportunityItem): JobDetail {
  const card = parseOpportunityCard(item)
  const skills = (item.required_skills || [])
    .map((s) => s.skill_name || s.skill)
    .filter((s): s is string => Boolean(s))

  const eligibility = (item.filters || [])
    .filter((f) => f.type === "eligible")
    .map((f) => f.name)
    .filter((n): n is string => Boolean(n))

  const description = item.details ? stripHtmlTags(item.details) : ""

  return {
    id: card.id,
    url: card.url,
    title: card.title,
    company: card.company,
    location: card.location,
    salary: card.salary,
    employmentType: item.jobDetail?.timing || item.type || null,
    workplaceType: item.jobDetail?.type || null,
    deadline: item.end_date ? item.end_date.split("T")[0] : null,
    skills,
    description,
    eligibility,
  }
}
