// Origin: clean-room 2026-10-07, derived from public Greenhouse boards API docs. Author: OpenCode agent.
import { fetchJson, stripHtml } from "../../../core/src/index";
import type { JobPosting } from "../../../core/src/index";

export interface RawGreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name?: string };
  updated_at?: string;
  content?: string;
}

/** Pure mapper — tested with fixtures, no network. */
export function mapGreenhouse(company: string, slug: string, jobs: RawGreenhouseJob[]): JobPosting[] {
  return jobs.map((j) => ({
    id: `greenhouse:${slug}:${j.id}`,
    title: (j.title ?? "Untitled").trim(),
    company,
    location: (j.location?.name ?? "Unknown").trim(),
    postedDate: toDate(j.updated_at),
    url: j.absolute_url,
    portal: "greenhouse",
    source: "adapter" as const,
  }));
}

function toDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

export async function searchGreenhouse(
  company: string,
  slug: string,
  query: string,
  limit: number,
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=false`;
  const { json } = await fetchJson(url);
  const jobs = (json as { jobs?: RawGreenhouseJob[] }).jobs ?? [];
  const q = query.toLowerCase();
  const matched = q
    ? jobs.filter((j) => `${j.title} ${j.location?.name ?? ""}`.toLowerCase().includes(q))
    : jobs;
  const cap = limit === 0 ? matched.length : matched.slice(0, limit).length;
  return { rows: mapGreenhouse(company, slug, matched.slice(0, limit === 0 ? undefined : limit)), truncated: matched.length > cap };
}

export async function detailGreenhouse(
  slug: string,
  id: string,
): Promise<JobPosting & { description: string }> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(id)}?content=true`;
  const { json } = await fetchJson(url);
  const j = json as RawGreenhouseJob & { content?: string };
  return {
    id: `greenhouse:${slug}:${j.id}`,
    title: (j.title ?? "Untitled").trim(),
    company: slug,
    location: (j.location?.name ?? "Unknown").trim(),
    postedDate: toDate(j.updated_at),
    url: j.absolute_url,
    portal: "greenhouse",
    source: "adapter",
    description: stripHtml(j.content ?? "").slice(0, 4000),
  };
}



