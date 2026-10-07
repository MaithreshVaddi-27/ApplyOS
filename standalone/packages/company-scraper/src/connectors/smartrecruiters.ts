// Origin: clean-room 2026-10-07, derived from public SmartRecruiters API docs. Author: OpenCode agent.
import { fetchJson, stripHtml } from "../../../core/src/index";
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
): Promise<{ rows: JobPosting[]; truncated: boolean }> {  const perPage = 50;
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

export interface RawSRDetail extends RawSRPosting {
  jobAd?: { sections?: { title?: string; text?: string }[] | Record<string, { title?: string; text?: string }> };
}

/** Assemble description defensively: sections ships as an array on some
 *  tenants and a keyed object on others (observed live on Freshworks). */
export function srDescription(jobAd: RawSRDetail["jobAd"]): string {
  const raw = jobAd?.sections;
  const list = Array.isArray(raw) ? raw : Object.values(raw ?? {});
  return list
    .map((s) => `${s.title ?? ""}\n${stripHtml(s.text ?? "")}`.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 4000);
}

/** Full posting by id; description assembled defensively from jobAd sections. */
export async function detailSmartRecruiters(
  company: string,
  slug: string,
  jobId: string,
): Promise<JobPosting & { description: string }> {
  const url = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings/${encodeURIComponent(jobId)}`;
  const { json } = await fetchJson(url);
  const p = json as RawSRDetail;
  if (!p || !p.name) throw new Error(`smartrecruiters posting not found: ${slug}/${jobId}`);
  const [row] = mapSmartRecruiters(company, [p]);
  return { ...row, description: srDescription(p.jobAd) };
}



