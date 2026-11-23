// Origin: clean-room 2026-10-07, derived from public Greenhouse boards API docs. Author: OpenCode agent.
//
// The engine's Greenhouse surface.
//
// This file is a SURFACE, not an implementation. The board's endpoint, envelope,
// mapping and query live in the provider SDK, at
// `applyos/packages/provider/src/greenhouse.ts`. Phase 4.7 reconciles the two ATS
// implementations; this is the first connector on the SDK, and the engine is the
// first surface over it.
//
// What stays here is the engine's row shape: the `greenhouse:<slug>:<id>` id,
// the ISO `postedDate`, the portal label, the source marker, and the engine's
// 4000-character cap on a detail body.
import { isoDateOnly } from "@applyos/core";
import type { JobPosting } from "@applyos/core";
import {
  createGreenhouseProvider,
  mapGreenhouseJobs,
  type GreenhouseRow,
  type RawGreenhouseJob,
} from "@applyos/provider";

export type { RawGreenhouseJob } from "@applyos/provider";

/** One board row, in the engine's shape. */
function toJobPosting(company: string, row: GreenhouseRow): JobPosting {
  return {
    id: `greenhouse:${row.slug}:${row.id}`,
    title: row.title,
    company,
    location: row.location,
    postedDate: isoDateOnly(row.date ?? ""),
    url: row.url,
    portal: "greenhouse",
    source: "adapter" as const,
  };
}

/** Map a listing through the SDK, keeping the engine's row shape. */
export function mapGreenhouse(company: string, slug: string, jobs: RawGreenhouseJob[]): JobPosting[] {
  return mapGreenhouseJobs(slug, jobs).map((row) => toJobPosting(company, row));
}

/** Search one Greenhouse tenant. */
export async function searchGreenhouse(
  company: string,
  slug: string,
  query: string,
  limit: number,
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const provider = createGreenhouseProvider({ company, slug });
  const page = await provider.search({ query, limit });
  return { rows: page.rows.map((row) => toJobPosting(company, row)), truncated: page.truncated };
}

/** One posting, in full. The engine caps the body at 4000 characters. */
export async function detailGreenhouse(
  slug: string,
  id: string,
  company: string = slug,
): Promise<JobPosting & { description: string }> {
  const provider = createGreenhouseProvider({ slug, company });
  const detail = await provider.detail(id);
  return {
    ...toJobPosting(company, detail),
    description: (detail.description ?? "").slice(0, 4000),
  };
}
