// Origin: clean-room 2026-10-07, derived from public Unstop API usage. Author: OpenCode agent.
import { fetchJson } from "../../core/src/index";
import type { JobPosting } from "../../core/src/index";

export interface RawUnstopOpportunity {
  id: string | number;
  title?: string;
  name?: string;
  organisation?: { name?: string };
  location?: string;
  locations?: string[];
  start_date?: string;
  end_date?: string;
  url?: string;
  public_url?: string;
}

export function mapUnstop(items: RawUnstopOpportunity[]): JobPosting[] {
  return items
    .filter((i) => ((i.title ?? i.name ?? "") as string).trim())
    .map((i) => ({
      id: `unstop:${i.id}`,
      title: ((i.title ?? i.name ?? "Untitled") as string).trim(),
      company: (i.organisation?.name ?? "Unstop").trim(),
      location: ((i.location ?? (i.locations?.[0] as string | undefined) ?? "India") as string).trim() || "India",
      postedDate: (i.start_date ?? "").slice(0, 10) || null,
      url: ((i.public_url ?? i.url ?? `https://unstop.com/o/${i.id}`) as string).trim(),
      portal: "unstop",
      source: "adapter" as const,
    }));
}

export async function searchUnstop(query: string, limit: number): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const url = `https://unstop.com/api/public/opportunity/search?${query ? `search=${encodeURIComponent(query)}&` : ""}per_page=${limit === 0 ? 50 : Math.min(limit, 50)}&page=1`;
  const { json } = await fetchJson(url, {
    init: { headers: { "User-Agent": "applyos-standalone/0.1 (personal use)", Accept: "application/json" } },
  });
  const body = json as { data?: { data?: RawUnstopOpportunity[] } ; opportunities?: RawUnstopOpportunity[] };
  const items = body.data?.data ?? body.opportunities ?? (Array.isArray(json) ? (json as RawUnstopOpportunity[]) : []);
  const sliced = limit === 0 ? items : items.slice(0, limit);
  return { rows: mapUnstop(sliced), truncated: items.length > sliced.length };
}
