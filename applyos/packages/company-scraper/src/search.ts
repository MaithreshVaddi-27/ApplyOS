// Origin: clean-room 2026-10-07, own fan-out design. Author: OpenCode agent.
import { mergePools, interleave, pace, robotsAllows, DEFAULT_PACING_MS, applyStageFilters } from "@applyos/core";
import type { JobPosting, SearchMeta, CandidateStage } from "@applyos/core";
import { loadRegistry, resolveTargets } from "./registry";
import type { CompanyEntry } from "./registry";
import { searchGreenhouse } from "./connectors/greenhouse";
import { searchLever } from "./connectors/lever";
import { searchSmartRecruiters } from "./connectors/smartrecruiters";
import { searchAmazon } from "./connectors/amazon";
import { searchWorkday } from "./connectors/workday";

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
  /** Row budget across targets (0 = unlimited). Stops the fan-out loudly. */
  maxRows?: number;
  /** Wall-clock budget in ms for the whole fan-out (0 = unlimited). */
  deadlineMs?: number;
}

/** Stage-aware client filters (single implementation in `@applyos/core`). */
export function applyClientFilters(rows: JobPosting[], o: CompanySearchOptions): JobPosting[] {
  return applyStageFilters(rows, o);
}

/** First URL each board hits — the robots gate checks this before any fetch. */
function seedUrl(t: CompanyEntry): string {
  if (t.board === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${t.slug}/jobs`;
  if (t.board === "lever") return `https://api.lever.co/v0/postings/${t.slug}?mode=json`;
  if (t.board === "smartrecruiters") return `https://api.smartrecruiters.com/v1/companies/${t.slug}/postings`;
  if (t.board === "workday") {
    const [tenant = "", site = "", n = "3"] = t.slug.split("/");
    return `https://${tenant}.wd${n}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  }
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
    // Global budgets: bound the run as the seed list grows (both opt-in).
    const rowsSoFar = pools.reduce((n, p) => n + p.length, 0);
    if (o.deadlineMs && o.deadlineMs > 0 && Date.now() - started > o.deadlineMs) {
      notes.push({ portal: "budget", ok: true, truncated: true, error: `deadline ${o.deadlineMs}ms exceeded` });
      break;
    }
    if (o.maxRows && o.maxRows > 0 && rowsSoFar >= o.maxRows) {
      notes.push({ portal: "budget", ok: true, truncated: true, error: `row budget ${o.maxRows} reached` });
      break;
    }
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
      } else if (t.board === "workday") {
        // Slug packs tenant/site[/instance] (legacy "tenant/site[/n]" convention).
        const [tenant = "", site = "", n = "3"] = t.slug.split("/");
        const r = await searchWorkday(t.company, { tenant, site, instance: `wd${n}` }, query, limit === 0 ? 50 : limit);
        pools.push(r.rows);
        notes.push({ portal: `workday:${t.slug}`, ok: true, truncated: r.truncated });
      } else {
        notes.push({ portal: `${t.board}:${t.slug}`, ok: false, error: "board connector not seeded in this build" });
      }
    } catch (e) {
      // Per-source isolation: one dead board never aborts the run.
      notes.push({ portal: `${t.board}:${t.slug}`, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const { merged } = mergePools(interleave(pools));
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

