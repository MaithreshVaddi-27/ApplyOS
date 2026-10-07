// Origin: clean-room 2026-10-07, own fan-out design. Author: OpenCode agent.
import { mergePools, pace, isStale, robotsAllows, DEFAULT_PACING_MS } from "@applyos/core";
import type { JobPosting, SearchMeta, CandidateStage } from "@applyos/core";
import { loadRegistry, resolveTargets } from "./registry";
import type { CompanyEntry } from "./registry";
import { searchGreenhouse } from "./connectors/greenhouse";
import { searchLever } from "./connectors/lever";
import { searchSmartRecruiters } from "./connectors/smartrecruiters";
import { searchAmazon } from "./connectors/amazon";

export interface CompanySearchOptions {
  query?: string;
  location?: string;
  company?: string;
  board?: string;
  category?: string;
  region?: string;
  type?: "jobs" | "internships" | "all";
  stage?: CandidateStage;
  jobage?: number;
  limit?: number;
  maxPages?: number;
  /** Amazon country filter (default IND). */
  country?: string;
}

const INTERN_WORDS = ["intern", "trainee", "apprentice"];

export function wantsInternships(o: CompanySearchOptions): boolean {
  if (o.type === "internships") return true;
  if (o.type === "jobs") return false;
  return o.stage === "student";
}

export function applyClientFilters(rows: JobPosting[], o: CompanySearchOptions): JobPosting[] {
  const loc = (o.location ?? "").toLowerCase();
  return rows.filter((r) => {
    if (loc && !`${r.location}`.toLowerCase().includes(loc)) return false;
    if (o.stage === "remote-global" && !loc && !/remote/i.test(r.location)) return false;
    if (wantsInternships(o)) {
      const hay = `${r.title}`.toLowerCase();
      if (!INTERN_WORDS.some((w) => hay.includes(w))) return false;
    }
    if (o.jobage && o.jobage > 0 && isStale(r.postedDate, o.jobage, new Date(), false)) return false;
    return true;
  });
}

/** First URL each board hits — the robots gate checks this before any fetch. */
function seedUrl(t: CompanyEntry): string {
  if (t.board === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${t.slug}/jobs`;
  if (t.board === "lever") return `https://api.lever.co/v0/postings/${t.slug}?mode=json`;
  if (t.board === "smartrecruiters") return `https://api.smartrecruiters.com/v1/companies/${t.slug}/postings`;
  return "https://www.amazon.jobs/en/search.json";
}

export async function runCompanySearch(o: CompanySearchOptions): Promise<{ results: JobPosting[]; meta: SearchMeta }> {
  const started = Date.now();
  const query = (o.query ?? "").trim();
  const limit = o.limit ?? 20;
  const maxPages = o.maxPages ?? 3;
  const targets = resolveTargets(loadRegistry(), o);
  const notes: SearchMeta["notes"] = [];
  const pools: JobPosting[][] = [];
  let lastCall = 0;

  for (const t of targets) {
    // Polite pacing: sequential fan-out, ≥300 ms between hosts.
    await pace(lastCall, DEFAULT_PACING_MS);
    lastCall = Date.now();
    // Robots gate: the owner's stated intent wins; a disallow skips the board loudly.
    const gate = await robotsAllows(seedUrl(t));
    if (!gate.allowed) {
      notes.push({ portal: `${t.board}:${t.slug}`, ok: false, error: `robots disallow (${gate.reason})` });
      continue;
    }
    try {
      if (t.board === "greenhouse") {
        const r = await searchGreenhouse(t.company, t.slug, query, limit === 0 ? 200 : limit);
        pools.push(r.rows);
        notes.push({ portal: `greenhouse:${t.slug}`, ok: true, truncated: r.truncated });
      } else if (t.board === "lever") {
        const r = await searchLever(t.company, t.slug, query, limit === 0 ? 200 : limit);
        pools.push(r.rows);
        notes.push({ portal: `lever:${t.slug}`, ok: true, truncated: r.truncated });
      } else if (t.board === "smartrecruiters") {
        const r = await searchSmartRecruiters(t.company, t.slug, query, limit === 0 ? 200 : limit, maxPages);
        pools.push(r.rows);
        notes.push({ portal: `smartrecruiters:${t.slug}`, ok: true, truncated: r.truncated });
      } else if (t.board === "amazon") {
        const r = await searchAmazon(query, limit === 0 ? 0 : limit, o.country ?? "IND");
        pools.push(r.rows);
        notes.push({ portal: "amazon", ok: true, truncated: r.truncated });
      } else {
        notes.push({ portal: `${t.board}:${t.slug}`, ok: false, error: "board connector not seeded in this build" });
      }
    } catch (e) {
      // Per-source isolation: one dead board never aborts the run.
      notes.push({ portal: `${t.board}:${t.slug}`, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const { merged } = mergePools(pools);
  const filtered = applyClientFilters(merged, o);
  const sliced = limit === 0 ? filtered : filtered.slice(0, limit);
  return {
    results: sliced,
    meta: {
      total: filtered.length,
      truncated: filtered.length > sliced.length,
      notes,
      elapsedMs: Date.now() - started,
    },
  };
}

