// Origin: clean-room 2026-10-07, derived from public Unstop API usage. Author: OpenCode agent.
//
// The engine's Unstop surface.
//
// This file is a SURFACE, not an implementation. Everything that knows how
// Unstop works - which endpoint, which envelope, which fields, how to build
// the query, how to read a salary - lives in the provider SDK, at
// `applyos/packages/provider/src/unstop.ts`. That is the whole point of
// ADR-0008: one implementation per board, so a fix lands in both the CLI and
// the engine at the same time.
//
// **The retired adapter used the wrong endpoint.** It asked for
// `https://unstop.com/api/public/opportunity/search`, which is Unstop's THIN
// listing: it carries no `jobDetail` (so no salary, no employment type, no
// workplace type), no `details`, no `updated_at` and no `locations` array, it
// covers every opportunity type at once - the first page held jobs, workshops
// and competitions side by side - its `per_page` is ignored, and its `search`
// does not filter at all (`?search=python` reported the same 323691 total as
// no query, and only reordered the results).
//
// The SDK uses the board's rich listing, `search-result`, which is scoped to
// one listing and whose `searchTerm` genuinely filters (671 matches for
// `python` where the unfiltered feed reports 10000).
//
// What stays here is the engine's own row shape: the `unstop:` id prefix, the
// ISO `postedDate`, the portal label, the source marker, and the engine's
// rules about what counts as a posting.
import { isoDateOnly } from "@applyos/core";
import type { JobPosting } from "@applyos/core";
import {
  unstopProvider,
  parseUnstopOpportunity,
  type UnstopRawOpportunity,
  type UnstopRow,
} from "@applyos/provider";

export type { UnstopRawOpportunity as RawUnstopOpportunity } from "@applyos/provider";

/**
 * The board's own id, namespaced the way every engine adapter namespaces it.
 */
function engineId(row: UnstopRow): string {
  return `unstop:${row.id}`;
}

/** One board row, in the engine's shape. */
function toJobPosting(row: UnstopRow): JobPosting {
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
    portal: "unstop",
    source: "adapter" as const,
  };
}

/**
 * Map the board's rows to engine rows.
 *
 * The board's parsing is the SDK's; this is the engine's row shape, and the
 * engine's rule that a row the board did not title is not a posting.
 */
export function mapUnstop(items: UnstopRawOpportunity[]): JobPosting[] {
  return items
    .map((i) => parseUnstopOpportunity(i))
    .filter((i): i is UnstopRow => i !== null && i.title.trim() !== "")
    .map((i) => toJobPosting(i));
}

/**
 * Search Unstop.
 *
 * `limit` follows the engine's convention: 0 means no cap. The board's own
 * listing page holds ten postings, so that is what one call returns however
 * large the limit is - the engine takes a page, as it does for every other
 * source.
 *
 * **One behaviour change from the previous adapter.** The retired adapter
 * sent the query as `?search=` and used whatever came back; the board does
 * not filter on that parameter, so the engine's results were never filtered
 * by the query at all, and it read `public_url` as a URL when the board sends
 * a path - putting a relative link in the pool. The engine now matches the
 * way the CLI does: the query filters, and the url is absolute.
 */
export async function searchUnstop(
  query: string,
  limit: number,
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const page = await unstopProvider.search({
    query: query || undefined,
    limit,
  });
  return {
    rows: page.rows.filter((r) => r.title.trim() !== "").map(toJobPosting),
    truncated: page.truncated,
  };
}
