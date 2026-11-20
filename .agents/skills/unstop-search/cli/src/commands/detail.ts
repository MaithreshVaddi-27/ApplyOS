// Implementation of `unstop-cli detail <id|url>`
//
// The lookup lives in the provider SDK: which listing to ask, how to find the
// exact posting, and how to read its body. This file is the surface: it calls
// the provider and prints what it gets.

import { extractUnstopId, unstopProvider, writeError, type UnstopDetailRow } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/**
 * The numeric id a reference carries.
 *
 * Unstop slugs end with the numeric opportunity id. Preferring the LAST
 * numeric segment matters: the first can grab digits from an earlier path
 * segment (P-M14).
 */
export function extractOpportunityId(input: string): string {
  return extractUnstopId(input)
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  if (!opts.id || opts.id.trim() === "") {
    writeError("missing required argument <id|url> for detail", "MISSING_ARG")
    return 1
  }

  try {
    const detail = (await unstopProvider.detail(opts.id)) as UnstopDetailRow

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
      process.stdout.write(
        JSON.stringify(
          {
            id: detail.id,
            url: detail.url,
            title: detail.title,
            company: detail.company,
            location: detail.location,
            date: detail.date,
            salary: detail.salary ?? null,
            employmentType: detail.employmentType,
            workplaceType: detail.workplaceType,
            deadline: detail.deadline,
            skills: detail.skills,
            // A posting with no body says so, rather than carrying an empty
            // string that reads like a body the board wrote.
            description: detail.description ?? null,
            eligibility: detail.eligibility,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e: any) {
    // This CLI has always reported a missing posting as NOT_FOUND and any
    // other failure as DETAIL_FAILED. The surface translates, so the codes a
    // consumer has always seen do not change.
    const code = e?.code === "not-found" ? "NOT_FOUND" : "DETAIL_FAILED"
    writeError(e?.message || `failed to retrieve opportunity details: ${opts.id}`, code)
    return 1
  }
}
