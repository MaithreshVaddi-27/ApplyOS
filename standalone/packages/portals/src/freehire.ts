// Origin: clean-room 2026-10-07, derived from public freehire.me API usage. Author: OpenCode agent.
import { fetchJson } from "../../core/src/index";
import type { JobPosting } from "../../core/src/index";

export interface RawFreehireJob {
  id: string | number;
  title?: string;
  company?: string;
  company_name?: string;
  location?: string;
  date?: string;
  posted_at?: string;
  url?: string;
  link?: string;
}

export function mapFreehire(jobs: RawFreehireJob[]): JobPosting[] {
  return jobs
    .filter((j) => (j.title ?? "").trim() && (j.url ?? j.link ?? "").trim())
    .map((j) => {
      const date = (j.date ?? j.posted_at ?? "").slice(0, 10) || null;
      return {
        id: `freehire:${j.id}`,
        title: (j.title ?? "Untitled").trim(),
        company: ((j.company ?? j.company_name ?? "Unknown") as string).trim(),
        location: ((j.location ?? "Remote") as string).trim() || "Remote",
        postedDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
        url: ((j.url ?? j.link ?? "") as string).trim(),
        portal: "freehire",
        source: "adapter" as const,
      };
    });
}

export async function searchFreehire(query: string, limit: number): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  // UNVERIFIED 2026-10-07: the endpoint below answers 404 — the public path
  // differs from the assumed shape. Kept behind this loud failure (per-source
  // isolation) until a verified endpoint is found; mapper + tests stay green.
  const url = `https://freehire.me/api/jobs?${query ? `q=${encodeURIComponent(query)}&` : ""}limit=${limit === 0 ? 100 : Math.min(limit, 100)}`;
  const { json } = await fetchJson(url);
  const jobs = (Array.isArray(json) ? json : ((json as { jobs?: RawFreehireJob[] }).jobs ?? [])) as RawFreehireJob[];
  const sliced = limit === 0 ? jobs : jobs.slice(0, limit);
  return { rows: mapFreehire(sliced), truncated: jobs.length > sliced.length };
}
