// Origin: clean-room 2026-10-07, derived from public Remotive API docs. Author: OpenCode agent.
//
// The engine's Remotive surface.
//
// This file is a SURFACE, not an implementation. Everything that knows how
// Remotive works - how to fetch the feed, how to parse a row, how to filter,
// how to build a URL - lives in the provider SDK, at
// `applyos/packages/provider/src/remotive.ts`. That is the whole point of
// ADR-0008: one implementation per board, so a fix lands in both the CLI and
// the engine at the same time.
//
// What stays here is the engine's own row shape: the `remotive:` id prefix,
// the ISO `postedDate`, the portal label, and the source marker. Those are the
// engine's conventions, not the board's facts.
//
// **One behaviour change.** The retired adapter sent the query to the board as
// `search=` and relied on the board to filter. Remotive's public endpoint
// ignores its query parameters - verified live on 2026-11-14, where
// `?search=python`, `?search=python&limit=3` and no parameters at all each
// answered with the same 16 postings - so the engine's results were never
// filtered by the query. The engine now filters the way the CLI does.
import { isoDateOnly } from "@applyos/core";
import type { JobPosting } from "@applyos/core";
import {
  remotiveProvider,
  mapRemotive as mapRemotiveRows,
  type RemotiveRow,
  type RemotiveRawJob,
} from "@applyos/provider";

export type { RemotiveRawJob as RawRemotive } from "@applyos/provider";

/** The board's own id, namespaced the way every engine adapter namespaces it. */
function engineId(row: RemotiveRow): string {
  return `remotive:${row.id}`;
}

/** One board row, in the engine's shape. */
function toJobPosting(row: RemotiveRow): JobPosting {
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
    portal: "remotive",
    source: "adapter" as const,
  };
}

/**
 * Map the feed's rows to engine rows.
 *
 * The board's parsing is the SDK's; this is the engine's row shape.
 */
export function mapRemotive(jobs: RemotiveRawJob[]): JobPosting[] {
  return mapRemotiveRows(jobs).map(toJobPosting);
}

/**
 * Search Remotive.
 *
 * `limit` follows the engine's convention: 0 means no cap.
 */
export async function searchRemotive(query: string, limit: number): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const page = await remotiveProvider.search({ query: query || undefined, limit });
  return { rows: page.rows.map(toJobPosting), truncated: page.truncated };
}
