// Origin: clean-room 2026-10-07, derived from public freehire.me API usage. Author: OpenCode agent.
//
// The engine's Freehire surface.
//
// This file is a SURFACE, not an implementation. Everything that knows how
// freehire works - which endpoint, which envelope, which fields, how to
// build the query - lives in the provider SDK, at
// `applyos/packages/provider/src/freehire.ts`.
//
// **The endpoint was wrong here.** The retired adapter asked for
// `https://freehire.me/api/jobs`, which answers 404 - so every engine scrape
// paid a guaranteed-failing request and reported "freehire — error: HTTP 404".
// The board's agent search endpoint is `/api/v1/agent/jobs/search`, which
// answers 200. The SDK uses the working one.
//
// What stays here is the engine's own row shape: the `freehire:` id prefix,
// the ISO `postedDate`, the portal label, and the source marker.
import { asText, isoDateOnly } from "@applyos/core";
import type { JobPosting } from "@applyos/core";
import {
  freehireProvider,
  toFreehireRow,
  type FreehireRow,
  type FreehireRawJob,
} from "@applyos/provider";

export type { FreehireRawJob as RawFreehireJob } from "@applyos/provider";

/**
 * The engine's limit for this board.
 *
 * The old adapter capped at 100. Freehire's board pages server-side, so the
 * engine asks for a page rather than for everything, and a limit of 0 means
 * "no cap" here as it does in every engine adapter.
 */
const ENGINE_LIMIT_CAP = 100;

/** The board's own id, namespaced the way every engine adapter namespaces it. */
function engineId(row: FreehireRow): string {
  return `freehire:${row.id}`;
}

/** One board row, in the engine's shape. */
function toJobPosting(row: FreehireRow): JobPosting {
  return {
    id: engineId(row),
    title: row.title,
    // The engine's row type says a company is a string, and every engine
    // mapper has always said "Unknown" when the board named none. The SDK
    // says null, which is the honest answer; this is the engine's own
    // convention applied to it.
    company: (row.company ?? "Unknown").trim(),
    location: row.location,
    postedDate: isoDateOnly(row.date ?? ""),
    url: row.url,
    portal: "freehire",
    source: "adapter" as const,
  };
}

/**
 * Map the board's rows to engine rows.
 *
 * The board's parsing is the SDK's; this is the engine's row shape, and the
 * engine's rule that a row without a title or a url is not a posting.
 */
export function mapFreehire(jobs: FreehireRawJob[]): JobPosting[] {
  return jobs
    .filter((j) => asText(j.title).trim() && asText(j.url).trim())
    .map((j) => toJobPosting(toFreehireRow(j)));
}

/**
 * Search freehire.
 *
 * `limit` follows the engine's convention: 0 means no cap.
 */
export async function searchFreehire(query: string, limit: number): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const page = await freehireProvider.search({
    query: query || undefined,
    limit: limit === 0 ? ENGINE_LIMIT_CAP : Math.min(limit, ENGINE_LIMIT_CAP),
  });
  return { rows: page.rows.map(toJobPosting), truncated: page.truncated };
}
