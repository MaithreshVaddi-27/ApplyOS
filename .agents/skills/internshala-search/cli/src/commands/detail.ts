import { BASE_URL, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export function normalizeTarget(input: string): { url: string; id: string } {
  const trimmed = input.trim()

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const urlObj = new URL(trimmed)
    const slug = urlObj.pathname.replace(/^\/(?:job|internship)\/detail\//, "").replace(/\/$/, "")
    return { url: trimmed.split("?")[0], id: slug || trimmed }
  }

  if (trimmed.startsWith("/")) {
    const slug = trimmed.replace(/^\/(?:job|internship)\/detail\//, "").replace(/\/$/, "")
    return { url: `${BASE_URL}${trimmed.split("?")[0]}`, id: slug }
  }

  // Raw slug or ID
  const isInternship = trimmed.includes("internship")
  const defaultPath = isInternship ? `/internship/detail/${trimmed}` : `/job/detail/${trimmed}`
  return { url: `${BASE_URL}${defaultPath}`, id: trimmed }
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  if (!opts.id || opts.id.trim() === "") {
    writeError("Missing required job id or URL", "MISSING_ARG")
    return 1
  }

  const { url, id } = normalizeTarget(opts.id)

  try {
    let html = await htmlFetch(url)

    // If initial job path returned empty/404, retry with internship path
    if (!html && !url.includes("/internship/detail/")) {
      const fallbackUrl = `${BASE_URL}/internship/detail/${id}`
      html = await htmlFetch(fallbackUrl)
    }

    if (!html) {
      writeError(`Job not found for ID or URL: "${opts.id}"`, "NOT_FOUND")
      return 1
    }

    const detail = parseJobDetail(html, url, id)

    if (opts.format === "plain") {
      const lines = [
        detail.title,
        `${detail.company || "—"} · ${detail.location || "—"}`,
        detail.salary ? `Salary: ${detail.salary}` : "",
        detail.numberOfOpenings ? `Openings: ${detail.numberOfOpenings}` : "",
        detail.skills.length > 0 ? `Skills: ${detail.skills.join(", ")}` : "",
        detail.perks.length > 0 ? `Perks: ${detail.perks.join(", ")}` : "",
        "",
        detail.description ? `About the role:\n${detail.description}` : "(no description)",
        "",
        detail.whoCanApply ? `Who can apply:\n${detail.whoCanApply}\n` : "",
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
