// Origin: clean-room 2026-10-10, derived from public Arbeitnow API docs + live probe. Author: OpenCode agent.
//
// The engine's Arbeitnow surface.
//
// This file is a SURFACE, not an implementation. Everything that knows how the
// board works - the endpoint, the envelope, the date format, the place, the
// remote flag, the filters, the lookup - lives in the provider SDK, at
// `applyos/packages/provider/src/arbeitnow.ts`. That is the whole point of
// ADR-0008: one implementation per board, so a fix lands in both the CLI and
// the engine at the same time.
//
// What stays here is the engine's own row shape: the `arbeitnow:` id prefix,
// the ISO `postedDate`, the portal label, the source marker, and the
// conventions every engine mapper applies.
import { fetchJson, isoDateOnly } from "@applyos/core";
import type { JobPosting } from "@applyos/core";
import {
  createArbeitnowProvider,
  parseArbeitnowJob,
  type ArbeitnowRawJob,
  type ArbeitnowRow,
  type SearchPage,
} from "@applyos/provider";

export type { ArbeitnowRawJob as RawArbeitnow } from "@applyos/provider";

/** The board's single endpoint. */
const FEED = "https://www.arbeitnow.com/api/job-board-api";

/** One feed item, in the engine's shape. */
export function mapArbeitnow(jobs: ArbeitnowRawJob[]): JobPosting[] {
  return jobs
    .map((j) => parseArbeitnowJob(j))
    .filter((j): j is ArbeitnowRow => j !== null)
    .map((j) => toJobPosting(j));
}

/** One board row, in the engine's shape. */
function toJobPosting(row: ArbeitnowRow): JobPosting {
  return {
    id: `arbeitnow:${row.id}`,
    title: row.title || "Untitled",
    // The engine's row type says a company is a string, and every engine
    // mapper has always said "Unknown" when the board named none. The SDK
    // says null, which is the honest answer; this is the engine's own
    // convention applied to it.
    company: (row.company ?? "Unknown").trim(),
    // The engine has no `remote` field, so a posting the board says is remote
    // but states no place for has always been shown as "Remote". The SDK
    // carries both facts separately and this surface keeps the engine's rule.
    location: row.location ?? (row.remote ? "Remote" : null),
    postedDate: isoDateOnly(row.date ?? ""),
    url: row.url,
    portal: "arbeitnow",
    source: "adapter" as const,
  };
}

/**
 * Turn the engine's `fetchFn` test hook - which answers with the parsed feed -
 * into the fetch the SDK's provider takes.
 */
function toFetchImpl(fetchFn: () => Promise<unknown>): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(await fetchFn()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch;
}

/** The board's feed, through the engine's own fetch. */
function defaultFetchFn(): Promise<unknown> {
  return fetchJson(FEED).then((r) => r.json);
}

/**
 * Search Arbeitnow.
 *
 * `limit` follows the engine's convention: 0 means no cap.
 *
 * **The board has no search endpoint.** It answers one document of 300
 * postings and ignores query parameters, so the query filters client-side -
 * which is what the retired adapter did, and what the SDK does now. The
 * retired adapter fetched through the engine's `fetchJson`; this surface
 * fetches the same feed through the SDK, and a total outage still raises
 * rather than reading as an empty board.
 */
export async function searchArbeitnow(
  query: string,
  limit: number,
  fetchFn: () => Promise<unknown> = defaultFetchFn,
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const provider = createArbeitnowProvider({ fetchImpl: toFetchImpl(fetchFn) });
  let page: SearchPage<ArbeitnowRow>;
  try {
    page = await provider.search({ query, limit });
  } catch (e) {
    throw new Error(`arbeitnow: feed failed (${e instanceof Error ? e.message : String(e)})`);
  }
  return { rows: page.rows.map(toJobPosting), truncated: page.truncated };
}
