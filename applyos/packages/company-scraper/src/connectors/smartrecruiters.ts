// Origin: clean-room 2026-10-07, derived from public SmartRecruiters API docs. Author: OpenCode agent.
//
// The engine's SmartRecruiters surface.
//
// The board's endpoint, paging, mapping and section handling live in the SDK
// (`applyos/packages/provider/src/smartrecruiters.ts`). Phase 4.7 stage three.
// What stays here is the engine's row shape and its own conventions.
import type { JobPosting } from "@applyos/core";
import {
  createSmartRecruitersProvider,
  mapSmartRecruitersJobs,
  srSections,
  type SmartRecruitersRow,
  type RawSmartRecruitersPosting,
} from "@applyos/provider";

export type { RawSmartRecruitersPosting as RawSRPosting } from "@applyos/provider";

/** The engine's detail shape: the raw posting plus jobAd sections. */
export interface RawSRDetail extends RawSmartRecruitersPosting {
  jobAd?: {
    sections?:
      | { title?: string; text?: string }[]
      | Record<string, { title?: string; text?: string }>;
  };
}

/** One board row, in the engine's shape. */
function toJobPosting(company: string, row: SmartRecruitersRow): JobPosting {
  return {
    id: `smartrecruiters:${row.slug}:${row.id}`,
    title: row.title,
    company,
    location: row.location,
    postedDate: row.date ? row.date.slice(0, 10) : null,
    url: row.url,
    portal: "smartrecruiters",
    source: "adapter" as const,
  };
}

/** Map a listing through the SDK, keeping the engine's row shape. */
export function mapSmartRecruiters(company: string, slug: string, postings: RawSmartRecruitersPosting[]): JobPosting[] {
  return mapSmartRecruitersJobs(slug, postings).map((row) => toJobPosting(company, row));
}

/**
 * Assemble the description defensively: `sections` ships as an array on some
 * tenants and a keyed object on others. The rule lives in the SDK; this name
 * is kept for the engine's callers.
 */
export function srDescription(jobAd: RawSRDetail["jobAd"]): string {
  return srSections(jobAd);
}

/** Search one tenant. `maxPages` is the engine's own paging budget. */
export async function searchSmartRecruiters(
  company: string,
  slug: string,
  query: string,
  limit: number,
  maxPages: number,
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const provider = createSmartRecruitersProvider({ company, slug });
  const page = await provider.search({ query, limit, extra: { maxPages } });
  return { rows: page.rows.map((row) => toJobPosting(company, row)), truncated: page.truncated };
}

/** One posting, in full. */
export async function detailSmartRecruiters(
  company: string,
  slug: string,
  jobId: string,
): Promise<JobPosting & { description: string }> {
  const provider = createSmartRecruitersProvider({ company, slug });
  const detail = await provider.detail(jobId);
  return {
    ...toJobPosting(company, detail),
    description: detail.description ?? "",
  };
}
