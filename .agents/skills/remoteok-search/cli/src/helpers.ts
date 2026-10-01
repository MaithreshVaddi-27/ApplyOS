// Helper utilities for remoteok-cli: fetching with backoff, parsing, formatting

export const BASE_URL = "https://remoteok.com"
export const API_URL = "https://remoteok.com/api"

export interface RemoteOkRawJob {
  id: string | number
  slug?: string
  epoch?: number
  date?: string
  company?: string
  company_logo?: string
  position?: string
  tags?: string[]
  description?: string
  location?: string
  salary_min?: number
  salary_max?: number
  apply_url?: string
  url?: string
  original?: boolean
}

export interface RemoteOkJob {
  id: string
  slug?: string
  title: string
  company: string
  location: string
  date: string
  url: string
  salary?: string
  tags?: string[]
  description?: string
  applyUrl?: string
}

export function writeError(message: string, code: string): void {
  process.stderr.write(
    JSON.stringify({
      error: message,
      code,
    }) + "\n",
  )
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x3D;/g, "=")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

export function stripHtmlTags(html: string): string {
  if (!html) return ""
  let text = html
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n$1\n")
    .replace(/<[^>]+>/g, "")
  text = decodeHtmlEntities(text)
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function formatSalary(min?: number, max?: number): string | undefined {
  if (!min && !max) return undefined
  if (min && max && min === max) {
    return `$${min.toLocaleString()} / year`
  }
  if (min && max) {
    return `$${min.toLocaleString()} - $${max.toLocaleString()} / year`
  }
  if (min) {
    return `From $${min.toLocaleString()} / year`
  }
  if (max) {
    return `Up to $${max.toLocaleString()} / year`
  }
  return undefined
}

export async function fetchWithBackoff(
  url: string,
  maxRetries = 3,
): Promise<Response | null> {
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; remoteok-cli/1.0)",
    Accept: "application/json, text/html, */*",
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { headers })
      if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
        if (attempt === maxRetries) return res
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 200
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      return res
    } catch {
      if (attempt === maxRetries) return null
      const delay = Math.pow(2, attempt) * 500
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  return null
}

export async function fetchApiJobs(): Promise<RemoteOkJob[]> {
  const res = await fetchWithBackoff(API_URL)
  if (!res || !res.ok) {
    throw new Error(`Failed to fetch RemoteOK API: HTTP ${res?.status || "network error"}`)
  }

  const rawData = (await res.json()) as any[]
  if (!Array.isArray(rawData)) {
    return []
  }

  // First item is legal/notice metadata
  const jobItems = rawData.slice(1) as RemoteOkRawJob[]

  return jobItems
    .filter((item) => item && item.id && item.position)
    .map((item) => {
      const id = String(item.id)
      const slug = item.slug || ""
      const url = item.url || (slug ? `${BASE_URL}/remote-jobs/${slug}` : `${BASE_URL}/remote-jobs/${id}`)
      const salary = formatSalary(item.salary_min, item.salary_max)
      const location = item.location && item.location.trim() ? item.location.trim() : "Worldwide"

      return {
        id,
        slug,
        title: item.position || "",
        company: item.company || "",
        location,
        date: item.date || "",
        url,
        salary,
        tags: Array.isArray(item.tags) ? item.tags : [],
        description: item.description ? stripHtmlTags(item.description) : undefined,
        applyUrl: item.apply_url || url,
      }
    })
}
