// Origin: clean-room 2026-10-07, derived from public amazon.jobs search.json usage. Author: OpenCode agent.
//
// The engine's Amazon surface.
//
// The board's endpoint, mapping, client-side paging and detail-by-search live
// in the SDK (`applyos/packages/provider/src/amazon.ts`). Phase 4.7 stage five.
// What stays here is the engine's row shape and its own exported names.
import type { JobPosting } from "@applyos/core";
import {
  createAmazonProvider,
  mapAmazonJobs,
  type AmazonRow,
  type RawAmazonJob,
} from "@applyos/provider";

export type { RawAmazonJob } from "@applyos/provider";

/** One SDK row, in the engine's shape. */
function toJobPosting(row: AmazonRow): JobPosting {
  return {
    id: `amazon:${row.id}`,
    title: row.title,
    company: "Amazon",
    location: row.location,
    postedDate: row.date,
    url: row.url,
    portal: "amazon",
    source: "adapter" as const,
  };
}

/** Map a listing through the SDK, keeping the engine's row shape. */
export function mapAmazon(jobs: RawAmazonJob[]): JobPosting[] {
  return mapAmazonJobs(jobs).map(toJobPosting);
}

/** Search the public board. The full 100-row page is sliced client-side. */
export async function searchAmazon(
  query: string,
  limit: number,
  country = "IND",
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const provider = createAmazonProvider();
  const page = await provider.search({ query, limit, extra: { country } });
  return { rows: page.rows.map(toJobPosting), truncated: page.truncated };
}

/** Detail is a text search for the id followed by an exact-id match. */
export async function detailAmazon(id: string): Promise<JobPosting & { description: string }> {
  const detail = await createAmazonProvider().detail(id);
  return { ...toJobPosting(detail), description: detail.description ?? "" };
}
