// Origin: clean-room 2026-10-07, derived from public SmartRecruiters API docs. Author: OpenCode agent.
import { fetchJson } from "../../../core/src/index";
import type { JobPosting } from "../../../core/src/index";

export interface RawSRPosting {
  id: string;
  name: string;
  location?: { city?: string; country?: string };
  releasedDate?: string;
  ref?: string;
}

export function mapSmartRecruiters(company: string, postings: RawSRPosting[]): JobPosting[] {
  return postings.map((p) => {
    const city = p.location?.city ?? "";
    const country = p.location?.country ?? "";
    const loc = [city, country].filter(Boolean).join(", ") || "Unknown";
    return {
      id: `smartrecruiters:${company}:${p.id}`,
      title: (p.name ?? "Untitled").trim(),
      company,
      location: loc,
      postedDate: p.releasedDate ? p.releasedDate.slice(0, 10) : null,
      url: `https://jobs.smartrecruiters.com/${encodeURIComponent(company)}/${encodeURIComponent(p.id)}`,
      portal: "smartrecruiters",
      source: "adapter" as const,
    };
  });
}

export async function searchSmartRecruiters(
  company: string,
  slug: string,
  query: string,
  limit: number,
  maxPages: number,
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const perPage = 50;
  const pages = maxPages === 0 ? 4 : Math.max(1, maxPages);
  const all: RawSRPosting[] = [];
  let truncated = false;
  for (let page = 0; page < pages; page++) {
    const url =
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings` +
      `?limit=${perPage}&offset=${page * perPage}`;
    const { json } = await fetchJson(url);
    const body = json as { content?: RawSRPosting[]; totalFound?: number };
    const chunk = body.content ?? [];
    all.push(...chunk);
    if (chunk.length < perPage) break;
    if (page === pages - 1 && (body.totalFound ?? 0) > all.length) truncated = true;
  }
  const q = query.toLowerCase();
  const matched = q ? all.filter((p) => `${p.name} ${p.location?.city ?? ""}`.toLowerCase().includes(q)) : all;
  const sliced = limit === 0 ? matched : matched.slice(0, limit);
  return { rows: mapSmartRecruiters(company, sliced), truncated: truncated || matched.length > sliced.length };
}



