// Implementation of `arbeitnow-cli detail <id|url>`
//
// The lookup lives in the provider SDK: it finds the exact slug in the
// board's feed. This file is the surface: it calls the provider and prints
// what it gets.

import { arbeitnowProvider, writeError, type ArbeitnowRow } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  try {
    const detail = await arbeitnowProvider.detail(opts.id)
    const job = detail as ArbeitnowRow
    if (opts.format === "plain") {
      process.stdout.write(
        [
          job.title,
          `${job.company ?? "—"} · ${job.location ?? "—"}${job.remote ? " · remote" : ""}`,
          job.date ? `Posted: ${job.date}` : "",
          job.jobTypes.length ? `Job Type: ${job.jobTypes.join(", ")}` : "",
          job.tags.length ? `Tags: ${job.tags.join(", ")}` : "",
          "",
          job.description || "(no description)",
          "",
          `URL: ${job.url}`,
        ]
          .filter((l) => l !== "")
          .join("\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            date: job.date,
            url: job.url,
            remote: job.remote,
            tags: job.tags,
            jobTypes: job.jobTypes,
            description: job.description ?? null,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e: any) {
    const code = e?.code === "not-found" ? "NOT_FOUND" : "DETAIL_FAILED"
    writeError(e?.message || `failed to retrieve listing details: ${opts.id}`, code)
    return 1
  }
}
