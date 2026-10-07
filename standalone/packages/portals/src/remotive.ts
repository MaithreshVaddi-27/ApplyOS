// Origin: clean-room 2026-10-07, derived from public Remotive API docs. Author: OpenCode agent.
import { fetchJson } from "@applyos/core";
import type { JobPosting } from "@applyos/core";

export interface RawRemotive {
  id: number;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  publication_date?: string;
  url: string;
}

export function mapRemotive(jobs: RawRemotive[]): JobPosting[] {
  return jobs.map((j) => ({
    id: `remotive:${j.id}`,
    title: (j.title ?? "Untitled").trim(),
    company: (j.company_name ?? "Unknown").trim(),
    location: (j.candidate_required_location ?? "Remote").trim() || "Remote",
    postedDate: (j.publication_date ?? "").slice(0, 10) || null,
    url: j.url,
    portal: "remotive",
    source: "adapter" as const,
  }));
}

export async function searchRemotive(query: string, limit: number): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const url = `https://remotive.com/api/remote-jobs?${query ? `search=${encodeURIComponent(query)}&` : ""}limit=${limit === 0 ? 100 : Math.min(limit, 100)}`;
  const { json } = await fetchJson(url);
  const jobs = ((json as { jobs?: RawRemotive[] }).jobs ?? []);
  const sliced = limit === 0 ? jobs : jobs.slice(0, limit);
  return { rows: mapRemotive(sliced), truncated: jobs.length > sliced.length };
}
