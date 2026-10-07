// Origin: clean-room 2026-10-07, derived from public Workday CXS API usage patterns. Author: OpenCode agent.
import { fetchJson } from "../../../core/src/index";
import type { JobPosting } from "../../../core/src/index";

export interface WorkdayTarget {
  tenant: string;
  site: string;
  instance?: string;
}

export interface RawWorkdayPosting {
  title: string;
  externalPath?: string;
  bulletinId?: string;
  locationsText?: string;
  postedOn?: string;
}

/** Parse "Posted 5 Days Ago" style strings; ISO dates pass through; else null. */
export function workdayDate(postedOn: string | undefined): string | null {
  if (!postedOn) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(postedOn)) return postedOn.slice(0, 10);
  const m = postedOn.match(/(\d+)\s+day/i);
  if (m) {
    const d = new Date(Date.now() - Number(m[1]) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export function mapWorkday(company: string, tenant: string, postings: RawWorkdayPosting[]): JobPosting[] {
  return postings.map((p) => {
    const ref = p.externalPath ?? p.bulletinId ?? encodeURIComponent(p.title);
    return {
      id: `workday:${tenant}:${ref}`,
      title: p.title.trim(),
      company,
      location: (p.locationsText ?? "Unknown").trim(),
      postedDate: workdayDate(p.postedOn),
      url: `https://${tenant}.myworkdayjobs.com/en-US/${ref}`,
      portal: "workday",
      source: "adapter" as const,
    };
  });
}

export async function searchWorkday(
  company: string,
  target: WorkdayTarget,
  query: string,
  limit: number,
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const instance = target.instance ?? "wd3";
  const url = `https://${target.tenant}.${instance}.myworkdayjobs.com/wday/cxs/${target.tenant}/${target.site}/jobs`;
  const { json } = await fetchJson(url, {
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appliedFacets: {},
        limit: limit === 0 ? 50 : Math.min(limit, 50),
        offset: 0,
        searchText: query,
      }),
    },
  });
  const postings = ((json as { jobPostings?: RawWorkdayPosting[] }).jobPostings ?? []);
  const rows = mapWorkday(company, target.tenant, limit === 0 ? postings : postings.slice(0, limit));
  return { rows, truncated: postings.length > rows.length };
}



