// Origin: clean-room 2026-10-07, written from dedupe needs observed in audit. Author: OpenCode agent.
import type { JobPosting } from "./types";

/** Canonical key: normalized URL, else company|title|location. */
export function dedupeKey(p: Pick<JobPosting, "url" | "company" | "title" | "location">): string {
  const url = normalizeUrl(p.url);
  if (url) return url;
  return [p.company, p.title, p.location].map((s) => s.trim().toLowerCase().replace(/\s+/g, " ")).join("|");
}

export function normalizeUrl(url: string): string {
  const u = (url ?? "").trim();
  if (!u) return "";
  try {
    const parsed = new URL(u);
    parsed.hash = "";
    // Drop common tracking params; keep the rest so distinct postings stay distinct.
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source"]) {
      parsed.searchParams.delete(k);
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return u.toLowerCase().replace(/#.*$/, "").replace(/\/$/, "");
  }
}

/** Merge several adapter pools, first-seen wins, key collisions counted. */
export function mergePools(pools: JobPosting[][]): { merged: JobPosting[]; duplicates: number } {
  const seen = new Map<string, JobPosting>();
  let duplicates = 0;
  for (const pool of pools) {
    for (const row of pool) {
      const key = dedupeKey(row);
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.set(key, row);
    }
  }
  return { merged: [...seen.values()], duplicates };
}

/** Collapse same-requisition rows posted across cities into one row with a spread note. */
export function collapseReqSpread(rows: JobPosting[]): { rows: JobPosting[]; collapsed: number } {
  const groups = new Map<string, JobPosting[]>();
  for (const r of rows) {
    const req = reqIdOf(r.url) ?? `${r.company.toLowerCase()}|${r.title.toLowerCase()}`;
    const list = groups.get(req) ?? [];
    list.push(r);
    groups.set(req, list);
  }
  const out: JobPosting[] = [];
  let collapsed = 0;
  for (const list of groups.values()) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const cities = [...new Set(list.map((r) => r.location))];
    out.push({ ...list[0], location: `${list[0].location} (+${cities.length - 1} cities: ${cities.slice(1).join(", ")})` });
    collapsed += list.length - 1;
  }
  return { rows: out, collapsed };
}

function reqIdOf(url: string): string | null {
  const m = url.match(/[0-9a-f-]{8,}/i);
  return m ? m[0].toLowerCase() : null;
}
