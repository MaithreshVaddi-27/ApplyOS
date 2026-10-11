// Origin: clean-room 2026-10-07, derived from public amazon.jobs search.json usage. Author: OpenCode agent.
import { fetchJson, stripHtml, pickArray, parseIsoDate } from "@applyos/core";
import type { JobPosting } from "@applyos/core";

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
      location: (j.location ?? "").trim() || null,
      postedDate: parseIsoDate(j.posting_date),
      url: j.job_path ? `https://www.amazon.jobs${j.job_path}` : `https://www.amazon.jobs/en/jobs/${id}`,
      portal: "amazon",
      source: "adapter" as const,
    };
  });
}

export async function searchAmazon(
  query: string,
  limit: number,
  country = "IND",
): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const params = new URLSearchParams({
    base_query: query,
    country,
    offset: "0",
    // Always fetch the full page: the server caps at 100, and truncation is
    // decided client-side (matched>sliced) instead of being unknowable.
    result_limit: "100",
    sort: "recent",
  });
  const { json } = await fetchJson(`https://www.amazon.jobs/en/search.json?${params}`);
  // Full page (server caps at 100) then slice client-side, so `truncated`
  // follows the matched>sliced pattern: true whenever rows were hidden, plus
  // the page-full heuristic (a full page may hold more server-side).
  const matched = pickArray(json, ["jobs"]) as RawAmazonJob[];
  const sliced = limit === 0 ? matched : matched.slice(0, limit);
  return { rows: mapAmazon(sliced), truncated: matched.length > sliced.length || matched.length >= 100 };
}

export async function detailAmazon(id: string): Promise<JobPosting & { description: string }> {
  const params = new URLSearchParams({ base_query: id, result_limit: "10" });
  const { json } = await fetchJson(`https://www.amazon.jobs/en/search.json?${params}`);
  const jobs = pickArray(json, ["jobs"]) as RawAmazonJob[];
  const j = jobs.find((x) => String(x.id) === id);
  if (!j) throw new Error(`amazon posting not found: ${id}`);
  const [row] = mapAmazon([j]);
  const desc = stripHtml(`${j.description ?? ""}\n\n${j.qualifications ?? ""}`.trim()).slice(0, 4000);
  return { ...row, description: desc };
}



