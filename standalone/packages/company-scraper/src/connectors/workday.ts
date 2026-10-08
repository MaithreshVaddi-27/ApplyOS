// Origin: clean-room 2026-10-07, derived from public Workday CXS API usage patterns. Author: OpenCode agent.
import { fetchJson, stripHtml } from "@applyos/core";
import type { JobPosting } from "@applyos/core";

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

export interface RawWorkdayDetail {
  title: string;
  jobDescription?: string;
  location?: string;
  postedOn?: string;
  startDate?: string;
  timeType?: string;
}

/** Detail path: a full posting URL sheds its origin + /en-US/{site}; a bare ref gains a leading slash. */
export function workdayDetailPath(ref: string, site: string): string {
  if (/^https?:\/\//i.test(ref)) {
    const path = ref.replace(/^https?:\/\/[^/]+/i, "").replace(new RegExp(`^/en-US/${site}`, "i"), "");
    return path.startsWith("/") ? path : `/${path}`;
  }
  return ref.startsWith("/") ? ref : `/${ref}`;
}

export function mapWorkdayDetail(
  company: string,
  tenant: string,
  instance: string,
  site: string,
  ref: string,
  info: RawWorkdayDetail | undefined,
): { posting: JobPosting; description: string } {
  if (!info) throw new Error(`workday job ${ref} not found (shape may have changed)`);
  const path = workdayDetailPath(ref, site);
  const description = stripHtml(info.jobDescription ?? "").slice(0, 4000) || "(no description returned)";
  return {
    posting: {
      id: `workday:${tenant}:${path.replace(/^\//, "")}`,
      title: (info.title ?? "Untitled").trim(),
      company,
      location: (info.location ?? "Unknown").trim() || "Unknown",
      postedDate: workdayDate(info.postedOn ?? info.startDate),
      url: `https://${tenant}.${instance}.myworkdayjobs.com/en-US/${site}${path}`,
      portal: "workday",
      source: "adapter" as const,
    },
    description,
  };
}

export async function detailWorkday(
  company: string,
  target: WorkdayTarget,
  ref: string,
): Promise<JobPosting & { description: string }> {
  const instance = target.instance ?? "wd3";
  const path = workdayDetailPath(ref, target.site);
  const url = `https://${target.tenant}.${instance}.myworkdayjobs.com/wday/cxs/${target.tenant}/${target.site}${path}`;
  const { json } = await fetchJson(url, { init: { headers: { accept: "application/json" } } });
  const info = (json as { jobPostingInfo?: RawWorkdayDetail }).jobPostingInfo;
  const { posting, description } = mapWorkdayDetail(company, target.tenant, instance, target.site, ref, info);
  return { ...posting, description };
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



