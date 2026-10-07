// Origin: clean-room 2026-10-07, own scoring design. Author: OpenCode agent.
import { ageInDays } from "../../core/src/index";
import type { JobPosting } from "../../core/src/index";
import type { Candidate, GatedPosting } from "./gates";

export interface ScoredPosting {
  posting: JobPosting;
  score: number;
  verdict: "strong fit" | "good fit" | "weak fit";
  strengths: string[];
  gaps: string[];
}

/** Stage weights: early-career weighs trajectory over history. */
export function weightsFor(stage: Candidate["stage"]): { skill: number; title: number; freshness: number } {
  if (stage === "student") return { skill: 0.4, title: 0.35, freshness: 0.25 };
  if (stage === "fresher") return { skill: 0.45, title: 0.35, freshness: 0.2 };
  return { skill: 0.5, title: 0.3, freshness: 0.2 };
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").split(/\s+/).filter((w) => w.length > 2));
}

/** Fraction of candidate skills appearing in the posting text. */
export function skillOverlap(skills: string[], text: string): { hit: string[]; miss: string[] } {
  const hay = text.toLowerCase();
  const hit: string[] = [];
  const miss: string[] = [];
  for (const s of skills) (hay.includes(s.toLowerCase()) ? hit : miss).push(s);
  return { hit, miss };
}

/** Title match: does the posting title echo the candidate's target words. */
export function titleMatch(title: string, skills: string[]): number {
  const t = words(title);
  const hits = skills.filter((s) => t.has(s.toLowerCase()) || title.toLowerCase().includes(s.toLowerCase()));
  if (!skills.length) return 0.5;
  return Math.min(1, hits.length / Math.min(skills.length, 3));
}

function freshnessScore(postedDate: string | null): number {
  const age = ageInDays(postedDate);
  if (age === null) return 0.4;
  if (age <= 3) return 1;
  if (age <= 7) return 0.85;
  if (age <= 14) return 0.65;
  if (age <= 30) return 0.4;
  return 0.15;
}

/** Score one gate-surviving posting. Evidence is quoted, never invented. */
export function scorePosting(g: GatedPosting, candidate: Candidate): ScoredPosting {
  const text = `${g.posting.title}\n${g.description}`;
  const w = weightsFor(candidate.stage);
  const { hit, miss } = skillOverlap(candidate.skills, text);
  const skillPart = candidate.skills.length ? hit.length / candidate.skills.length : 0.5;
  const titlePart = titleMatch(g.posting.title, candidate.skills);
  const freshPart = freshnessScore(g.posting.postedDate);
  const score = Math.round(100 * (w.skill * skillPart + w.title * titlePart + w.freshness * freshPart));
  const verdict = score >= 70 ? "strong fit" : score >= 45 ? "good fit" : "weak fit";
  const strengths = hit.slice(0, 3).map((s) => `matches skill "${s}" per posting text`);
  const gaps = miss.slice(0, 3).map((s) => `no mention of "${s}" in posting text`);
  for (const gate of g.gates.filter((x) => x.verdict === "FLAG" && x.note)) {
    gaps.push(`${gate.gate}: ${gate.note}`);
  }
  return { posting: g.posting, score, verdict, strengths, gaps: gaps.slice(0, 4) };
}
