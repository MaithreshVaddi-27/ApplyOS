// Origin: clean-room 2026-10-07, derived from public amazon.jobs search.json usage. Author: OpenCode agent.
import { fetchJson, stripHtml } from "../../../core/src/index";
import type { JobPosting } from "../../../core/src/index";

export interface RawAmazonJob {
  id: string | number;
  title: string;
  location?: string;
  posting_date?: string;
  job_path?: string;
  description?: string;
  qualifications?: string;
}

export function mapAmazon(jobs: RawAmazonJob[]): JobPosting[] {
  return jobs.map((j) => {
    const id = String(j.id);
    return {
      id: `amazon:${id}`,
      title: (j.title ?? "Untitled").trim(),
      company: "Amazon",
      location: (j.location ?? "Unknown").trim(),
      postedDate: toDate(j.posting_date),
      url: j.job_path ? `https://www.amazon.jobs${j.job_path}` : `https://www.amazon.jobs/en/jobs/${id}`,
      portal: "amazon",
      source: "adapter" as const,
    };
  });
}

function toDate(human: string | undefined): string | null {
  if (!human) return null;
  const t = Date.parse(human);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

export async function searchAmazon(query: string, limit: number): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const params = new URLSearchParams({
    base_query: query,
    country: "IND",
    offset: "0",
    result_limit: String(limit === 0 ? 100 : Math.min(limit, 100)),
    sort: "recent",
  });
  const { json } = await fetchJson(`https://www.amazon.jobs/en/search.json?${params}`);
  const jobs = ((json as { jobs?: RawAmazonJob[] }).jobs ?? []).slice(0, limit === 0 ? undefined : limit);
  return { rows: mapAmazon(jobs), truncated: jobs.length >= 100 && limit === 0 };
}

export async function detailAmazon(id: string): Promise<JobPosting & { description: string }> {
  const params = new URLSearchParams({ base_query: id, result_limit: "10" });
  const { json } = await fetchJson(`https://www.amazon.jobs/en/search.json?${params}`);
  const jobs = (json as { jobs?: RawAmazonJob[] }).jobs ?? [];
  const j = jobs.find((x) => String(x.id) === id) ?? jobs[0];
  if (!j) throw new Error(`amazon posting not found: ${id}`);
  const [row] = mapAmazon([j]);
  const desc = stripHtml(`${j.description ?? ""}\n\n${j.qualifications ?? ""}`.trim()).slice(0, 4000);
  return { ...row, description: desc };
}



