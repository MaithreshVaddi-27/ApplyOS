// Origin: clean-room 2026-10-07, derived from public We Work Remotely RSS feeds. Author: OpenCode agent.
//
// The engine's We Work Remotely surface.
//
// This file is a SURFACE, not an implementation. Everything that knows how the
// board works - which feeds exist, how to parse an item, how to build the
// place, how to split the tags, how to filter, how to look a posting up -
// lives in the provider SDK, at `applyos/packages/provider/src/weworkremotely.ts`.
// That is the whole point of ADR-0008: one implementation per board, so a fix
// lands in both the CLI and the engine at the same time.
//
// **The retired parser read a tag the feed does not carry.** It read
// `<location>`, and the board's items carry `<region>`, `<country>` and
// `<state>` instead - so every engine row came out with no place at all. A
// live scrape showed it: `Proxify AB: Senior Backend Developer | ... |
// unspecified`. The engine now builds the place the way the CLI always has.
//
// **One of the retired adapter's three feeds does not exist.** It fetched
// `categories/remote-data-science-jobs.rss`, which answers 301; the board's
// own categories are Full-Stack, Front-End, Back-End, DevOps and Sysadmin,
// Design, Product, Management and Finance, Customer Support, Sales and
// Marketing, and All Other Remote. There is no data-science category, and the
// per-feed error handling meant the source lost it silently. It is replaced
// by the board's full listing, `remote-jobs.rss`, which is also the feed the
// CLI reads by default.
import { fetchText, isoDateOnly } from "@applyos/core";
import type { JobPosting } from "@applyos/core";
import {
  parseWwrJob,
  createWwrProvider,
  type WwrRawItem,
  type WwrRow,
} from "@applyos/provider";

export type { WwrRawItem as RawWwrItem } from "@applyos/provider";
export { parseWwrRss } from "@applyos/provider";

/**
 * The feeds the engine reads.
 *
 * The board's full listing plus the two tech category feeds the engine has
 * always read. The three barely overlap - only 15 of the full listing's 97
 * postings appear in either category feed - so the union is 151 postings
 * where the full listing alone is 97.
 */
export const WWR_ENGINE_FEEDS = [
  "https://weworkremotely.com/categories/remote-programming-jobs.rss",
  "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  "https://weworkremotely.com/remote-jobs.rss",
];

/** One feed item, in the engine's shape. */
export function mapWwr(items: WwrRawItem[]): JobPosting[] {
  return items
    .map((i) => parseWwrJob(i))
    .filter((i): i is WwrRow => i !== null)
    .map((i) => toJobPosting(i));
}

/** One board row, in the engine's shape. */
function toJobPosting(row: WwrRow): JobPosting {
  return {
    // The engine's id has always been the guid, falling back to the link. The
    // board's guid is its url, so this is the same string as before.
    id: `weworkremotely:${row.guid || row.url}`,
    title: row.title,
    // The engine's row type says a company is a string, and every engine
    // mapper has always said "Unknown" when the board named none.
    company: (row.company ?? "Unknown").trim(),
    location: row.location,
    postedDate: isoDateOnly(row.date ?? ""),
    url: row.url,
    portal: "weworkremotely",
    source: "adapter" as const,
  };
}

/**
 * Search We Work Remotely.
 *
 * `limit` follows the engine's convention: 0 means no cap.
 *
 * Each feed is fetched and filtered on its own; a feed that fails is recorded
 * and skipped, and only a total outage raises - one dead feed must never
 * silently empty the source.
 */
export async function searchWwr(
  query: string,
  limit: number,
  fetchFn: (url: string) => Promise<string> = (u) => fetchText(u).then((r) => r.text),
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  // The engine's own outbound budget - the shared policy its other adapters
  // use - not the CLI's longer one, so a dead feed fails as fast here as it
  // does everywhere else in the engine.
  const provider = createWwrProvider({
    attempts: 2,
    timeoutMs: 20000,
    fetchImpl: (async (url: string | URL | Request) =>
      new Response(await fetchFn(String(url)), {
        status: 200,
        headers: { "Content-Type": "application/rss+xml" },
      })) as unknown as typeof fetch,
  });

  const all: WwrRow[] = [];
  const errors: string[] = [];
  for (const feed of WWR_ENGINE_FEEDS) {
    try {
      const page = await provider.search({ query: query || undefined, limit: 0, extra: { feed } });
      all.push(...page.rows);
    } catch (e) {
      errors.push(`${feed}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!all.length && errors.length) {
    throw new Error(`weworkremotely: all ${WWR_ENGINE_FEEDS.length} feeds failed (${errors.join("; ")})`);
  }

  const q = query.toLowerCase();
  const matched = q
    ? all.filter((i) => `${i.title} ${i.company ?? ""}`.toLowerCase().includes(q))
    : all;
  const sliced = limit === 0 ? matched : matched.slice(0, limit);
  return { rows: sliced.map(toJobPosting), truncated: matched.length > sliced.length };
}
