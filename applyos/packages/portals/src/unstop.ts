// Origin: clean-room 2026-10-07, derived from public Unstop API usage. Author: OpenCode agent.
import { fetchJson, asText, isoDateOnly, pickArray } from "@applyos/core";
import type { JobPosting } from "@applyos/core";

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
    .filter((i) => asText(i.title ?? i.name).trim())
    .map((i) => ({
      id: `unstop:${i.id}`,
      title: asText(i.title ?? i.name, "Untitled").trim(),
      company: (i.organisation?.name ?? "Unstop").trim(),
      location: asText(i.location ?? i.locations?.[0], "").trim() || null,
      postedDate: isoDateOnly(i.start_date ?? ""),
      url: asText(i.public_url ?? i.url ?? `https://unstop.com/o/${i.id}`).trim(),
      portal: "unstop",
      source: "adapter" as const,
    }));
}

export async function searchUnstop(query: string, limit: number): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const url = `https://unstop.com/api/public/opportunity/search?${query ? `search=${encodeURIComponent(query)}&` : ""}per_page=${limit === 0 ? 50 : Math.min(limit, 50)}&page=1`;
  const { json } = await fetchJson(url, {
    init: { headers: { "User-Agent": "applyos/0.1 (personal use)", Accept: "application/json" } },
  });
  const items = pickArray(json, ["data.data", "opportunities"]) as RawUnstopOpportunity[];
  const sliced = limit === 0 ? items : items.slice(0, limit);
  return { rows: mapUnstop(sliced), truncated: items.length > sliced.length };
}
