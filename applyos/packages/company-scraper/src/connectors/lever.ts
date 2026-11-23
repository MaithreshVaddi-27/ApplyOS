// Origin: clean-room 2026-10-07, derived from public Lever postings API docs. Author: OpenCode agent.
//
// The engine's Lever surface.
//
// The board's endpoint, mapping, body assembly and query live in the provider
// SDK (`applyos/packages/provider/src/lever.ts`). Phase 4.7 stage two. What
// stays here is the engine's row shape and its own conventions.
import type { JobPosting } from "@applyos/core";
import {
  createLeverProvider,
  leverDescription,
  mapLeverJobs,
  type LeverRow,
  type RawLeverPosting,
} from "@applyos/provider";

export type { RawLeverPosting } from "@applyos/provider";
export { leverDescription } from "@applyos/provider";

/** One board row, in the engine's shape. */
function toJobPosting(company: string, row: LeverRow): JobPosting {
  return {
    id: `lever:${row.slug}:${row.id}`,
    title: row.title,
    company,
    location: row.location,
    postedDate: row.date ? row.date.slice(0, 10) : null,
    url: row.url,
    portal: "lever",
    source: "adapter" as const,
  };
}

/** Map a listing through the SDK, keeping the engine's row shape. */
export function mapLever(company: string, slug: string, postings: RawLeverPosting[]): JobPosting[] {
  return mapLeverJobs(slug, postings).map((row) => toJobPosting(company, row));
}

/** Search one Lever tenant. */
export async function searchLever(
  company: string,
  slug: string,
  query: string,
  limit: number,
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const provider = createLeverProvider({ company, slug });
  const page = await provider.search({ query, limit });
  return { rows: page.rows.map((row) => toJobPosting(company, row)), truncated: page.truncated };
}

/** One posting, in full. The engine caps the body at 4000 characters. */
export async function detailLever(
  slug: string,
  id: string,
  company: string = slug,
): Promise<JobPosting & { description: string }> {
  const provider = createLeverProvider({ slug, company });
  const detail = await provider.detail(id);
  return {
    ...toJobPosting(company, detail),
    description: (detail.description ?? "").slice(0, 4000),
  };
}
