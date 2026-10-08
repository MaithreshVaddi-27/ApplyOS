// Origin: clean-room 2026-10-07, own fan-in design. Author: OpenCode agent.
import {
  mergePools,
  interleave,
  collapseReqSpread,
  isStale,
  type JobPosting,
  type SearchMeta,
  type CandidateStage,
} from "@applyos/core";
import { runCompanySearch } from "@applyos/company-scraper/search";
import { searchRemoteOk } from "@applyos/portals/remoteok";
import { searchRemotive } from "@applyos/portals/remotive";
import { searchWwr } from "@applyos/portals/weworkremotely";
import { searchUnstop } from "@applyos/portals/unstop";
import { searchFreehire } from "@applyos/portals/freehire";

export interface UnifiedSearchOptions {
  query?: string;
  location?: string;
  stage?: CandidateStage;
  type?: "jobs" | "internships" | "all";
  jobage?: number;
  limit?: number;
  maxPages?: number;
}

const INTERN_WORDS = ["intern", "trainee", "apprentice"];

function wantsInternships(o: UnifiedSearchOptions): boolean {
  if (o.type === "internships") return true;
  if (o.type === "jobs") return false;
  return o.stage === "student";
}

/** Stage-aware client filters shared by every source pool. */
export function applyStageFilters(rows: JobPosting[], o: UnifiedSearchOptions): JobPosting[] {
  const loc = (o.location ?? "").toLowerCase();
  return rows.filter((r) => {
    if (loc && !r.location.toLowerCase().includes(loc)) return false;
    if (o.stage === "remote-global" && !loc && !/remote/i.test(r.location)) return false;
    if (wantsInternships(o) && !INTERN_WORDS.some((w) => r.title.toLowerCase().includes(w))) return false;
    if (o.jobage && o.jobage > 0 && isStale(r.postedDate, o.jobage, new Date(), false)) return false;
    return true;
  });
}

type PoolOutcome = { rows: JobPosting[]; truncated: boolean; portal: string; error?: string };

async function safeRun(portal: string, fn: () => Promise<{ rows: JobPosting[]; truncated: boolean }>): Promise<PoolOutcome> {
  try {
    const r = await fn();
    return { ...r, portal };
  } catch (e) {
    // Per-source isolation: one dead source never aborts the run.
    return { rows: [], truncated: false, portal, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Round-robin interleave (moved to `@applyos/core` so company search shares
 * the same fair-slice semantics). Re-exported here so existing import sites
 * keep working.
 */
export { interleave } from "@applyos/core";

/**
 * Fan out across company boards + aggregator portals, then merge, dedupe,
 * filter by stage, and page. Portals run concurrently (distinct hosts);
 * company boards keep their sequential polite pacing internally.
 */
export async function runUnifiedSearch(o: UnifiedSearchOptions): Promise<{ results: JobPosting[]; meta: SearchMeta }> {
  const started = Date.now();
  const query = (o.query ?? "").trim();
  const limit = o.limit ?? 20;
  // Over-fetch per source so the merged pool has breadth before the final
  // slice — otherwise the first pool in merge order starves the rest.
  const fetchCap = limit === 0 ? 50 : Math.min(200, Math.max(limit * 3, 30));

  const [company, remoteok, remotive, wwr, unstop, freehire] = await Promise.all([
    safeRun("company-boards", () =>
      runCompanySearch({
        query,
        location: o.location,
        stage: o.stage,
        type: o.type,
        jobage: 0, // age filtering happens once, globally, below
        limit: fetchCap,
        maxPages: o.maxPages,
      }).then((r) => ({ rows: r.results, truncated: r.meta.truncated, boardNotes: r.meta.notes })),
    ),
    safeRun("remoteok", () => searchRemoteOk(query, fetchCap)),
    safeRun("remotive", () => searchRemotive(query, fetchCap)),
    safeRun("weworkremotely", () => searchWwr(query, fetchCap)),
    safeRun("unstop", () => searchUnstop(query, fetchCap)),
    safeRun("freehire", () => searchFreehire(query, fetchCap)),
  ]);

  const notes: SearchMeta["notes"] = [];
  // Keep per-board company notes visible, not just the aggregate.
  const boardNotes = (company as PoolOutcome & { boardNotes?: SearchMeta["notes"] }).boardNotes;
  if (boardNotes && boardNotes.length) notes.push(...boardNotes);
  else {
    notes.push({
      portal: "company-boards",
      ok: !company.error,
      truncated: company.truncated,
      ...(company.error ? { error: company.error } : {}),
    });
  }
  const outcomes = [remoteok, remotive, wwr, unstop, freehire];
  for (const p of outcomes) {
    notes.push({ portal: p.portal, ok: !p.error, truncated: p.truncated, ...(p.error ? { error: p.error } : {}) });
  }

  const { merged } = mergePools(interleave([company.rows, remoteok.rows, remotive.rows, wwr.rows, unstop.rows, freehire.rows]));
  const { rows: collapsed } = collapseReqSpread(merged);
  const filtered = applyStageFilters(collapsed, o);
  const sliced = limit === 0 ? filtered : filtered.slice(0, limit);
  return {
    results: sliced,
    meta: { total: filtered.length, truncated: filtered.length > sliced.length, notes, elapsedMs: Date.now() - started },
  };
}
