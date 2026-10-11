// Origin: clean-room 2026-10-11, unified from apps/cli scrape.ts + company-scraper search.ts (identical logic). Author: OpenCode agent.
import { isStale } from "./fetch";
import type { CandidateStage, JobPosting } from "./types";

/** Minimum shape any caller-side filter needs (both CLIs satisfy this structurally). */
export interface StageFilterOptions {
  location?: string;
  stage?: CandidateStage;
  type?: "jobs" | "internships" | "all";
  jobage?: number;
}

const INTERN_WORDS = ["intern", "trainee", "apprentice"];

export function wantsInternships(o: StageFilterOptions): boolean {
  if (o.type === "internships") return true;
  if (o.type === "jobs") return false;
  return o.stage === "student";
}

/** Stage-aware client filters shared by every source pool. */
export function applyStageFilters(rows: JobPosting[], o: StageFilterOptions): JobPosting[] {
  const loc = (o.location ?? "").toLowerCase();
  return rows.filter((r) => {
    if (loc && !`${r.location}`.toLowerCase().includes(loc)) return false;
    if (o.stage === "remote-global" && !loc && !/remote/i.test(`${r.location}`)) return false;
    if (wantsInternships(o)) {
      const hay = `${r.title}`.toLowerCase();
      if (!INTERN_WORDS.some((w) => hay.includes(w))) return false;
    }
    if (o.jobage && o.jobage > 0 && isStale(r.postedDate, o.jobage, new Date(), false)) return false;
    return true;
  });
}
