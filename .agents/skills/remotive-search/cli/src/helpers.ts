// Helper utilities for remotive-cli

export const BASE_URL = "https://remotive.com"
export const API_URL = "https://remotive.com/api/remote-jobs"
export const USER_AGENT = "Mozilla/5.0 (compatible; remotive-cli/1.0)"

export interface RemotiveRawJob {
  id: number | string
  url: string
  title: string
  company_name: string
  company_logo?: string
  company_logo_url?: string
  category?: string
  tags?: string[]
  job_type?: string
  publication_date?: string
  candidate_required_location?: string
  salary?: string
  description?: string
}

export interface RemotiveJob {
  id: string
  title: string
  company: string
  location: string
  date: string
  url: string
  salary: string | null
  category?: string
  jobType?: string
  tags?: string[]
  description?: string
}

export function writeError(message: string, code = "ERROR"): void {
  const payload = {
    error: message,
    code: code.toUpperCase(),
  }
  process.stderr.write(JSON.stringify(payload) + "\n")
}

export async function fetchWithBackoff(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
): Promise<Response | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/json, text/plain, */*",
    ...(options.headers || {}),
  }

  let delay = 1000
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // A hung portal must never hang /scrape: 15s per attempt, then retry/fail.
      // A caller-passed signal wins over the default timeout.
      const res = await fetch(url, { ...options, headers, signal: options.signal ?? AbortSignal.timeout(15000) })
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        if (attempt < maxRetries) {
          const jitter = Math.random() * 500
          await new Promise((r) => setTimeout(r, delay + jitter))
          delay *= 2
          continue
        }
      }
      return res
    } catch (err) {
      if (attempt < maxRetries) {
        const jitter = Math.random() * 500
        await new Promise((r) => setTimeout(r, delay + jitter))
        delay *= 2
        continue
      }
      return null
    }
  }
  return null
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return ""
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
}

export function stripHtmlTags(html: string): string {
  if (!html) return ""
  return decodeHtmlEntities(
    html
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  )
}

export async function fetchRemotiveJobs(opts: {
  search?: string
  category?: string
  candidate_required_location?: string
  company_name?: string
  limit?: number
}): Promise<RemotiveJob[]> {
  const params = new URLSearchParams()
  if (opts.search) params.set("search", opts.search)
  if (opts.category) params.set("category", opts.category)
  if (opts.candidate_required_location)
    params.set("candidate_required_location", opts.candidate_required_location)
  if (opts.company_name) params.set("company_name", opts.company_name)
  if (opts.limit && opts.limit > 0) params.set("limit", String(opts.limit))

  const queryString = params.toString()
  const targetUrl = queryString ? `${API_URL}?${queryString}` : API_URL

  const res = await fetchWithBackoff(targetUrl)
  if (!res || !res.ok) {
    throw new Error(`Failed to fetch Remotive API: HTTP ${res?.status || "network error"}`)
  }

  const data = (await res.json()) as { jobs?: RemotiveRawJob[] }
  if (!data || !Array.isArray(data.jobs)) {
    return []
  }

  return data.jobs
    .filter((j) => j && j.id && j.title)
    .map((j) => ({
      id: String(j.id),
      title: decodeHtmlEntities(j.title || ""),
      company: decodeHtmlEntities(j.company_name || "").trim(),
      location: j.candidate_required_location && j.candidate_required_location.trim()
        ? j.candidate_required_location.trim()
        : "Worldwide",
      date: j.publication_date || "",
      url: j.url || `${BASE_URL}/remote-jobs/${j.id}`,
      salary: j.salary && j.salary.trim() ? j.salary.trim() : null,
      category: j.category || undefined,
      jobType: j.job_type || undefined,
      tags: Array.isArray(j.tags) ? j.tags : [],
      description: j.description ? stripHtmlTags(j.description) : undefined,
    }))
}
