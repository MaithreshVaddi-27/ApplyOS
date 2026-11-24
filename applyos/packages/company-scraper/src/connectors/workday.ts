// Origin: clean-room 2026-10-07, derived from public Workday CXS API usage patterns. Author: OpenCode agent.
//
// The engine's Workday surface.
//
// The board's endpoint, paging, mapping, date and path rules live in the SDK
// (`applyos/packages/provider/src/workday.ts`). Phase 4.7 stage four. What stays
// here is the engine's row shape and its own exported names.
//
// The SDK also fixes a live defect: the board caps a page at 20 and answers 400
// to 25 or 50, while this connector used to ask for 50. The SDK caps the request
// at 20; the engine's callers keep passing 50 and simply get the working page.
import type { JobPosting } from "@applyos/core";
import {
  createWorkdayProvider,
  mapWorkdayDetail as sdkMapWorkdayDetail,
  mapWorkdayPostings,
  workdayDate,
  workdayDetailPath,
  workdaySearchUrl,
  type RawWorkdayDetail as SdkRawWorkdayDetail,
  type RawWorkdayPosting as SdkRawWorkdayPosting,
  type WorkdayRow,
} from "@applyos/provider";

export interface WorkdayTarget {
  tenant: string;
  site: string;
  instance?: string;
}

export type RawWorkdayPosting = SdkRawWorkdayPosting;
export type RawWorkdayDetail = SdkRawWorkdayDetail & { title: string };

export { workdayDate, workdayDetailPath, workdaySearchUrl };

/** One SDK row, in the engine's shape. */
function toJobPosting(company: string, row: WorkdayRow): JobPosting {
  return {
    id: `workday:${row.tenant}:${row.ref}`,
    title: row.title,
    company,
    location: row.location,
    postedDate: row.date,
    url: row.url,
    portal: "workday",
    source: "adapter" as const,
  };
}

/** Map a listing through the SDK, keeping the engine's row shape. */
export function mapWorkday(company: string, tenant: string, postings: RawWorkdayPosting[]): JobPosting[] {
  return mapWorkdayPostings(tenant, postings).map((row) => toJobPosting(company, row));
}

/** Map a detail response, keeping the engine's `{ posting, description }` shape. */
export function mapWorkdayDetail(
  company: string,
  tenant: string,
  instance: string,
  site: string,
  ref: string,
  info: RawWorkdayDetail | undefined,
): { posting: JobPosting; description: string } {
  const mapped = sdkMapWorkdayDetail(tenant, instance, site, ref, info);
  if (!mapped) throw new Error(`workday job ${ref} not found (shape may have changed)`);
  return { posting: toJobPosting(company, mapped.row), description: mapped.description };
}

/** One posting, in full. */
export async function detailWorkday(
  company: string,
  target: WorkdayTarget,
  ref: string,
): Promise<JobPosting & { description: string }> {
  const provider = createWorkdayProvider({ company, ...target });
  const detail = await provider.detail(ref);
  return { ...toJobPosting(company, detail), description: detail.description ?? "" };
}

/** Search one tenant. The SDK caps the board-side page at 20. */
export async function searchWorkday(
  company: string,
  target: WorkdayTarget,
  query: string,
  limit: number,
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const provider = createWorkdayProvider({ company, ...target });
  const page = await provider.search({ query, limit });
  return { rows: page.rows.map((row) => toJobPosting(company, row)), truncated: page.truncated };
}
