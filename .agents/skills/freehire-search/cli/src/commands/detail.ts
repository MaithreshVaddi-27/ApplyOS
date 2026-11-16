// Implementation of `freehire-cli detail <slug|url>`
//
// The lookup lives in the provider SDK. This file is the surface: it calls
// the provider and prints what it gets.

import {
  freehireProvider,
  normalizeFreehireSlug,
  writeError,
  type FreehireDetailRow,
} from "../helpers.js"

export interface DetailOpts {
  id: string // a freehire public slug or a /jobs/<slug> URL
  format: "json" | "plain"
}

/** A human-readable rendering of one job: header, present fields, description. */
export async function runDetail(opts: DetailOpts): Promise<number> {
  const slug = normalizeFreehireSlug(opts.id)
  if (!slug) {
    writeError(`could not parse a freehire slug from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const job = (await freehireProvider.detail(slug)) as FreehireDetailRow

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        job.date ? `Posted: ${job.date.slice(0, 10)}` : "",
        job.seniority ? `Seniority: ${job.seniority}` : "",
        job.category ? `Category: ${job.category}` : "",
        job.employment_type ? `Employment: ${job.employment_type}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.skills.length ? `Skills: ${job.skills.join(", ")}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
        `slug: ${job.id}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e: any) {
    // This CLI has always reported a missing posting as NOT_FOUND and any
    // other failure as DETAIL_FAILED.
    const code = e?.code === "not-found" ? "NOT_FOUND" : "DETAIL_FAILED"
    writeError(e instanceof Error ? e.message : String(e), code)
    return 1
  }
}
