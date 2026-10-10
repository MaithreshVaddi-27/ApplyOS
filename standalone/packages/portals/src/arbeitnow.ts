// Origin: clean-room 2026-10-10, derived from public Arbeitnow API docs + live probe. Author: OpenCode agent.
import { fetchJson } from "@applyos/core";
import type { JobPosting } from "@applyos/core";

const FEED = "https://www.arbeitnow.com/api/job-board-api";

export interface RawArbeitnow {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  location?: string;
  /** ISO string or unix seconds (live feed sends unix seconds). */
  created_at?: string | number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;

function toPostedDate(created_at: string | number | undefined): string | null {
  if (typeof created_at === "number" && Number.isFinite(created_at)) {
    return new Date(created_at * 1000).toISOString().slice(0, 10);
  }
  const raw = typeof created_at === "string" ? created_at.slice(0, 10) : "";
  return ISO_DATE.test(raw) ? raw : null;
}

export function mapArbeitnow(jobs: RawArbeitnow[]): JobPosting[] {
  return jobs
    .filter((j) => j.slug && j.url)
    .map((j) => {
      const loc = (j.location ?? "").trim() || (j.remote ? "Remote" : "");
      return {
        id: `arbeitnow:${j.slug}`,
        title: (j.title ?? "").trim() || "Untitled",
        company: (j.company_name ?? "").trim() || "Unknown",
        location: loc,
        postedDate: toPostedDate(j.created_at),
        url: (j.url ?? "").trim(),
        portal: "arbeitnow",
        source: "adapter" as const,
      };
    });
}

export async function searchArbeitnow(
  query: string,
  limit: number,
  fetchFn: () => Promise<unknown> = () => fetchJson(FEED).then((r) => r.json),
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  let json: unknown;
  try {
    json = await fetchFn();
  } catch (e) {
    throw new Error(`arbeitnow: feed failed (${e instanceof Error ? e.message : String(e)})`);
  }
  const jobs = ((json as { data?: RawArbeitnow[] }).data ?? []);
  const q = query.toLowerCase();
  const matched = q
    ? jobs.filter((j) => `${j.title ?? ""} ${j.company_name ?? ""}`.toLowerCase().includes(q))
    : jobs;
  const sliced = limit === 0 ? matched : matched.slice(0, limit);
  return { rows: mapArbeitnow(sliced), truncated: matched.length > sliced.length };
}
