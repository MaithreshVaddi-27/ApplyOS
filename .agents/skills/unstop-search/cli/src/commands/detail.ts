import {
  API_URL,
  fetchWithBackoff,
  parseOpportunityDetail,
  writeError,
  type UnstopOpportunityItem,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export function extractOpportunityId(input: string): string {
  const trimmed = input.trim()

  // If input is a full URL or path, find the trailing digits
  // e.g. https://unstop.com/jobs/software-engineer-visheneracom-1739954
  const numMatch = trimmed.match(/(\d+)(?:[/?#]|$)/)
  if (numMatch) {
    return numMatch[1]
  }

  return trimmed
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  if (!opts.id || opts.id.trim() === "") {
    writeError("missing required argument <id|url> for detail", "MISSING_ARG")
    return 1
  }

  const id = extractOpportunityId(opts.id)

  try {
    // Query Unstop public search API with the specific ID
    const urlJobs = `${API_URL}?opportunity=jobs&searchTerm=${encodeURIComponent(id)}`
    let res = await fetchWithBackoff(urlJobs)

    let payload: { data?: { data?: UnstopOpportunityItem[] } } | null = null
    if (res.ok) {
      payload = (await res.json()) as { data?: { data?: UnstopOpportunityItem[] } }
    }

    // Honesty rule: only the exact requested ID is ever returned. A
    // search miss is NOT_FOUND — never the first unrelated result.
    let item = payload?.data?.data?.find((d) => String(d.id) === id)

    // If not found in jobs, check internships
    if (!item) {
      const urlInternships = `${API_URL}?opportunity=internships&searchTerm=${encodeURIComponent(id)}`
      res = await fetchWithBackoff(urlInternships)
      if (res.ok) {
        payload = (await res.json()) as { data?: { data?: UnstopOpportunityItem[] } }
        item = payload?.data?.data?.find((d) => String(d.id) === id)
      }
    }

    if (!item) {
      writeError(`Opportunity not found for ID or URL: "${opts.id}"`, "NOT_FOUND")
      return 1
    }

    const detail = parseOpportunityDetail(item)

    if (opts.format === "plain") {
      const lines = [
        detail.title,
        `${detail.company || "—"} · ${detail.location || "—"}`,
        detail.salary ? `Salary: ${detail.salary}` : "",
        detail.deadline ? `Application Deadline: ${detail.deadline}` : "",
        detail.skills.length > 0 ? `Skills: ${detail.skills.join(", ")}` : "",
        detail.eligibility.length > 0 ? `Eligibility: ${detail.eligibility.join(", ")}` : "",
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
