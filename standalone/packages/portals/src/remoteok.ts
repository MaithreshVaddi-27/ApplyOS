// Origin: clean-room 2026-10-07, derived from public RemoteOK API usage. Author: OpenCode agent.
import { fetchJson } from "@applyos/core";
import type { JobPosting } from "@applyos/core";

export interface RawRemoteOk {
  id: string | number;
  position?: string;
  company?: string;
  location?: string;
  date?: string;
  url?: string;
}

export function mapRemoteOk(rows: RawRemoteOk[]): JobPosting[] {
  return rows
    .filter((r) => r.position && r.url)
    .map((r) => ({
      id: `remoteok:${r.id}`,
      title: (r.position ?? "Untitled").trim(),
      company: (r.company ?? "Unknown").trim(),
      location: (r.location ?? "Remote").trim() || "Remote",
      postedDate: (r.date ?? "").slice(0, 10) || null,
      url: r.url as string,
      portal: "remoteok",
      source: "adapter" as const,
    }));
}

export async function searchRemoteOk(query: string, limit: number): Promise<{ rows: JobPosting[]; truncated: boolean }> {
  const url = query
    ? `https://remoteok.com/api?tag=${encodeURIComponent(query)}`
    : "https://remoteok.com/api";
  const { json } = await fetchJson(url, { init: { headers: { "User-Agent": "applyos-standalone/0.1 (personal use)" } } });
  const arr = (Array.isArray(json) ? json : []) as RawRemoteOk[];
  const data = arr.filter((r) => r.position);
  const sliced = limit === 0 ? data : data.slice(0, limit);
  return { rows: mapRemoteOk(sliced), truncated: data.length > sliced.length };
}
