// Origin: clean-room 2026-10-07, own rank flow. Author: OpenCode agent.
import type { JobPosting } from "../../../packages/core/src/index";
import { runGates, scorePosting, type Candidate, type ScoredPosting } from "../../../packages/matching/src/index";
import { runUnifiedSearch } from "./scrape";

export interface RankOptions {
  query?: string;
  location?: string;
  stage?: Candidate["stage"];
  type?: "jobs" | "internships" | "all";
  jobage?: number;
  limit?: number;
  maxPages?: number;
  skills?: string[];
  locations?: string[];
  gradYear?: number;
  stipendFloor?: number;
  ctcFloor?: number;
  maxAge?: number;
  /** Injected pool source (tests stub this; default fans out live). */
  searchFn?: (o: RankOptions) => Promise<{ results: JobPosting[] }>;
}

export interface RankedShortlist {
  ranked: (ScoredPosting & { gates: ReturnType<typeof runGates>["gates"] })[];
  rejected: { posting: JobPosting; reasons: string[] }[];
  elapsedMs: number;
}

/**
 * Batch-score a search pool: deterministic gates first (FAILs collected
 * with reasons, never silently dropped), deep scoring on survivors only.
 * Descriptions are fetched per-posting detail in a later step; this pass
 * ranks on title/location/freshness with text gates neutral on empty text.
 */
export async function runRank(o: RankOptions): Promise<RankedShortlist> {
  const started = Date.now();
  const candidate: Candidate = {
    stage: o.stage ?? "experienced",
    skills: o.skills ?? [],
    locations: o.locations ?? (o.location ? [o.location] : []),
    gradYear: o.gradYear,
    stipendFloor: o.stipendFloor,
    ctcFloor: o.ctcFloor,
  };
  const maxAge = o.maxAge ?? 30;
  const search = o.searchFn ?? ((opts: RankOptions) =>
    runUnifiedSearch({
      query: opts.query,
      location: opts.location,
      stage: opts.stage,
      type: opts.type,
      jobage: opts.jobage,
      limit: opts.limit,
      maxPages: opts.maxPages,
    }));
  const { results } = await search(o);

  const ranked: RankedShortlist["ranked"] = [];
  const rejected: RankedShortlist["rejected"] = [];
  for (const posting of results) {
    const gated = runGates(posting, "", candidate, maxAge);
    if (!gated.pass) {
      rejected.push({
        posting,
        reasons: gated.gates.filter((g) => g.verdict === "FAIL").map((g) => `${g.gate}: ${g.note}`),
      });
      continue;
    }
    const scored = scorePosting(gated, candidate);
    ranked.push({ ...scored, gates: gated.gates });
  }
  ranked.sort((a, b) => b.score - a.score);
  return { ranked, rejected, elapsedMs: Date.now() - started };
}
