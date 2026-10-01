import {
  BASE_URL,
  fetchWithBackoff,
  stripHtmlTags,
  writeError,
  type JobDetail,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export function buildDetailUrl(input: string): string {
  const trimmed = input.trim()

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.split("?")[0]
  }

  if (trimmed.startsWith("/")) {
    return `${BASE_URL}${trimmed.split("?")[0]}`
  }

  return `${BASE_URL}/jobs/${trimmed}`
}

interface JsonLdPosting {
  "@context"?: string
  "@type"?: string
  title?: string
  hiringOrganization?: {
    name?: string
  }
  employmentType?: string
  datePosted?: string
  description?: string
  experienceRequirements?: string
  jobLocation?: Array<{
    address?: {
      addressLocality?: string
      addressRegion?: string
      addressCountry?: string
    }
  }>
}

export function parseJsonLdDetail(html: string, url: string, rawId: string): JobDetail | null {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
  if (!match) return null

  try {
    const json = JSON.parse(match[1]) as JsonLdPosting
    if (!json.title) return null

    let loc: string | null = null
    if (json.jobLocation && Array.isArray(json.jobLocation) && json.jobLocation.length > 0) {
      const parts = json.jobLocation
        .map((l) => l.address?.addressLocality || l.address?.addressCountry)
        .filter((p): p is string => Boolean(p))
      if (parts.length > 0) {
        loc = parts.join(", ")
      }
    }

    const description = json.description ? stripHtmlTags(json.description) : ""

    return {
      id: rawId,
      url,
      title: json.title,
      company: json.hiringOrganization?.name || null,
      location: loc,
      salary: null,
      employmentType: json.employmentType || null,
      datePosted: json.datePosted || null,
      description,
    }
  } catch {
    return null
  }
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  if (!opts.id || opts.id.trim() === "") {
    writeError("missing required argument <id|url> for detail", "MISSING_ARG")
    return 1
  }

  const url = buildDetailUrl(opts.id)

  try {
    const res = await fetchWithBackoff(url)
    if (!res.ok) {
      writeError(`Job not found for ID or URL: "${opts.id}" (HTTP ${res.status})`, "NOT_FOUND")
      return 1
    }

    const html = await res.text()
    const detail = parseJsonLdDetail(html, url, opts.id)

    if (!detail) {
      writeError(`Could not parse job details for: "${opts.id}"`, "PARSE_ERROR")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        detail.title,
        `${detail.company || "—"} · ${detail.location || "—"}`,
        detail.employmentType ? `Type: ${detail.employmentType}` : "",
        detail.datePosted ? `Posted: ${detail.datePosted}` : "",
        "",
        detail.description ? `About the role:\n${detail.description}` : "(no description)",
        "",
        `URL: ${detail.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(detail, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
