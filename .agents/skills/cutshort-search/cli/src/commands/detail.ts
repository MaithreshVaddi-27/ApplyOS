import {
  BASE_URL,
  extractNextData,
  fetchText,
  pageDataFor,
  stripHtmlTags,
  toIsoDate,
  writeError,
} from "../helpers.js"
import { normalizeJob, type NormalizedJob } from "./search.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a full posting URL or a bare slug (the part after /job/). */
export function slugFromId(idOrUrl: string): string {
  const match = idOrUrl.match(/cutshort\.io\/job\/([^/?#]+)/i)
  return match ? match[1] : idOrUrl.replace(/^\/+|\/+$/g, "")
}

/** Parse a posting page's NEXT_DATA payload ("jobData" query) into a job record. */
export function parseDetailPage(html: string): NormalizedJob & { description: string | null } | null {
  const pageData = pageDataFor(extractNextData(html), "jobData")
  if (!pageData || typeof pageData !== "object" || !("headline" in pageData)) return null
  const job = normalizeJob(pageData as Record<string, unknown>)
  return {
    ...job,
    description: typeof pageData.sanitizedComment === "string" ? stripHtmlTags(pageData.sanitizedComment) : null,
  }
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  try {
    const slug = slugFromId(opts.id)
    if (!slug) {
      writeError("detail requires a posting URL or slug", "NO_ID")
      return 1
    }
    const html = await fetchText(`${BASE_URL}/job/${slug}`)
    if (!html) {
      writeError(`posting not found: ${slug}`, "NOT_FOUND")
      return 1
    }
    const job = parseDetailPage(html)
    if (!job) {
      writeError(
        "could not parse the posting payload — the page markup may have drifted (see url-reference.md)",
        "PARSE_FAILED",
      )
      return 1
    }
    if (opts.format === "plain") {
      process.stdout.write(
        [
          job.title,
          `${job.company ?? "—"} · ${job.location ?? "—"} · ${job.date ?? "date unknown"} · ${job.experience ?? "—"} · ${job.salary ?? "—"}`,
          `Skills: ${job.skills?.join(", ") || "—"}`,
          "",
          job.description ?? "(no description in the posting payload)",
          "",
          job.url,
        ].join("\n") + "\n",
      )
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}

export { toIsoDate }
