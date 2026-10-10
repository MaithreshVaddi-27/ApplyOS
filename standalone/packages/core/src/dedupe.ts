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
/**
 * Round-robin interleave so the final slice draws from every source instead
 * of letting the first pool in merge order starve the rest.
 */
export function interleave(pools: JobPosting[][]): JobPosting[][] {
  const out: JobPosting[] = [];
  let i = 0;
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const pool of pools) {
      if (i < pool.length) {
        out.push(pool[i]);
        progressed = true;
      }
    }
    i++;
  }
  return [out];
}


/** Collapse same-requisition rows posted across cities into one row with a spread note. */
export function collapseReqSpread(rows: JobPosting[]): { rows: JobPosting[]; collapsed: number } {
  const groups = new Map<string, JobPosting[]>();
  for (const r of rows) {
    // Company is part of the key: numeric IDs collide across boards.
    const req = `${r.company.toLowerCase()}|${reqIdOf(r.url) ?? r.title.toLowerCase()}`;
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
    // Duplicates that share one city get no spread note — "+0 cities: " is junk.
    const location = cities.length > 1
      ? `${list[0].location} (+${cities.length - 1} cities: ${cities.slice(1).join(", ")})`
      : list[0].location;
    out.push({ ...list[0], location });
    collapsed += list.length - 1;
  }
  return { rows: out, collapsed };
}

function reqIdOf(url: string): string | null {
  // ID-shaped segments only: match inside one path segment so query/fragment
  // noise never counts, and skip calendar dates (YYYY-MM-DD or YYYYMMDD)
  // that otherwise read as hex/digit runs and wrongly collapse postings.
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    path = (url ?? "").split(/[?#]/)[0];
  }
  for (const seg of path.split("/")) {
    if (!seg) continue;
    if (/\d{4}-\d{2}-\d{2}/.test(seg)) continue;
    const m = seg.match(/[0-9a-f-]{8,}/i);
    if (!m) continue;
    if (/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(m[0])) continue;
    return m[0].toLowerCase();
  }
  return null;
}
