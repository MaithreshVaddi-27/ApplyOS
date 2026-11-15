// Origin: clean-room 2026-10-07, derived from public RemoteOK API usage. Author: OpenCode agent.
//
// The engine's RemoteOK surface.
//
// This file is a SURFACE, not an implementation. Everything that knows how
// RemoteOK works - how to fetch the feed, how to parse a row, how to build a
// URL, how to filter - lives in the provider SDK, at
// `applyos/packages/provider/src/remoteok.ts`. That is the whole point of
// ADR-0008: one implementation per board, so a fix lands in both the CLI and
// the engine at the same time.
//
// What stays here is the engine's own row shape: the `remoteok:` id prefix,
// the ISO date, the portal label, and the source marker. Those are the
// engine's conventions, not the board's facts.
//
// The CLI surface for the same board is `.agents/skills/remoteok-search/cli/`,
// and it is a surface over the same SDK.
import { isoDateOnly } from "@applyos/core";
import type { JobPosting } from "@applyos/core";
import {
  remoteOkProvider,
  mapRemoteOk as mapRemoteOkRows,
  type RemoteOkJob,
  type RemoteOkRawJob,
} from "@applyos/provider";

export type { RemoteOkRawJob as RawRemoteOk } from "@applyos/provider";

/** The board's own id, namespaced the way every engine adapter namespaces it. */
function engineId(row: RemoteOkJob): string {
  return `remoteok:${row.id}`;
}

/** One board row, in the engine's shape. */
function toJobPosting(row: RemoteOkJob): JobPosting {
  return {
    id: engineId(row),
    title: row.title,
    company: (row.company ?? "Unknown").trim(),
    location: row.location,
    postedDate: isoDateOnly(row.date ?? ""),
    url: row.url,
    portal: "remoteok",
    source: "adapter" as const,
  };
}

/**
 * Map the feed's rows to engine rows.
 *
 * The board's parsing is the SDK's; this is the engine's row shape. A row
 * the board did not make a complete posting is dropped by the SDK, and a row
 * without a usable url is dropped rather than given a fabricated one.
 */
export function mapRemoteOk(rows: RemoteOkRawJob[]): JobPosting[] {
  return mapRemoteOkRows(rows).map(toJobPosting);
}

/**
 * Search RemoteOK.
 *
 * `limit` follows the engine's convention: 0 means no cap.
 *
 * **One behaviour change from the previous adapter.** The old engine sent the
 * query to the board as `?tag=<query>` and used whatever came back. That is a
 * server-side TAG filter, not a text search: a multi-word query such as
 * "software engineer" matched nothing (verified live against RemoteOK's API
 * on 2026-11-14 - `?tag=software%20engineer` returned 0 postings, while the
 * keyword match the CLI uses returned 24). The SDK matches the way the CLI
 * does, so the engine and the CLI now agree on what a query means.
 *
 * The engine's default stage is `engine: off` (docs/.../search-queries.md),
 * so this path is not yet user-facing.
 */
export async function searchRemoteOk(query: string, limit: number): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const page = await remoteOkProvider.search({
    query: query || undefined,
    limit,
  });
  return { rows: page.rows.map(toJobPosting), truncated: page.truncated };
}
