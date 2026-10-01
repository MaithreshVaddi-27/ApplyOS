import { BASE_URL, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export function normalizeTarget(input: string): { url: string; id: string } {
  const trimmed = input.trim()

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const urlObj = new URL(trimmed)
    const pathname = urlObj.pathname
    const idMatch = pathname.match(/job-listings-.*?(\d{6,})/i) || pathname.match(/-(\d+)(?:\?|$)/i)
    const id = idMatch ? idMatch[1] : pathname.replace(/^\//, "").replace(/\/$/, "")
    return { url: trimmed.split("?")[0], id: id || trimmed }
  }

  if (trimmed.startsWith("/")) {
    return { url: `${BASE_URL}${trimmed.split("?")[0]}`, id: trimmed }
  }

  // If numeric ID or slug is provided
  if (/^\d+$/.test(trimmed)) {
    return { url: `${BASE_URL}/job-listings-${trimmed}`, id: trimmed }
  }

  return { url: `${BASE_URL}/job-listings-${trimmed}`, id: trimmed }
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  if (!opts.id || opts.id.trim() === "") {
    writeError("Missing required job id or URL", "MISSING_ARG")
    return 1
  }

  const { url, id } = normalizeTarget(opts.id)

  try {
    const html = await htmlFetch(url)
    if (!html) {
      writeError(`Job not found for ID or URL: "${opts.id}"`, "NOT_FOUND")
      return 1
    }

    const detail = parseJobDetail(html, url, id)

    if (opts.format === "plain") {
      const lines = [
        detail.title,
        `${detail.company || "—"} · ${detail.location || "—"}`,
        detail.experience ? `Experience: ${detail.experience}` : "",
        detail.salary ? `Salary: ${detail.salary}` : "",
        detail.skills.length > 0 ? `Skills: ${detail.skills.join(", ")}` : "",
        detail.role ? `Role: ${detail.role}` : "",
        detail.industry ? `Industry: ${detail.industry}` : "",
        detail.functionalArea ? `Functional Area: ${detail.functionalArea}` : "",
        detail.education ? `Education: ${detail.education}` : "",
        "",
        detail.description ? `Job Description:\n${detail.description}` : "(no description)",
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
