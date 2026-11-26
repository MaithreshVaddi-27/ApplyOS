// Origin: clean-room 2026-10-07, own scoring design. Author: OpenCode agent.
//
// Phase 5: one scoring model, one weight table, one band set.
//
// The four dimensions come from framework/scoring.json. The core computes the
// deterministic ones (technical from skill overlap, experience from the title)
// and combines a versioned judgment input for behavioral and career. The core
// never re-derives judgment, and a dimension with no quoted evidence is reported
// as "not evaluated" rather than scored zero.
import { ageInDays } from "@applyos/core";
import type { JobPosting } from "@applyos/core";
import type { Candidate, GatedPosting } from "./gates";
import { notEvaluated as unevaluatedDimension, explainDimensions, type ScoreExplanation } from "./explain.js";
import { bandFor, modelVersion, weightsFor } from "./weights.js";

export { weightsFor, bandFor, modelVersion } from "./weights.js";
export type { ScoringBand } from "./weights.js";

/** Judgment the agent supplies. The core combines it; it never judges. */
export interface JudgmentInput {
  /** Dimension → 0..1 score with a quoted reason. */
  readonly dimensions: Record<string, { score: number; reason: string }>;
  /** Version of the judging rubric, echoed in the explanation. */
  readonly version: string;
}

export type Verdict = "Strong Fit" | "Good Fit" | "Moderate Fit" | "Weak Fit" | "Poor Fit";

export interface ScoredPosting {
  posting: JobPosting;
  score: number;
  verdict: Verdict;
  strengths: string[];
  gaps: string[];
  /** Always present: a score without its derivation is not interpretable. */
  explanation: ScoreExplanation;
  /** Which weights and bands produced this score. */
  modelVersion: string;
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

/** The posting's own spelling of a skill, quoted from the text it came from. */
function quoteSkill(skill: string, text: string): string {
  const needle = skill.toLowerCase();
  const at = text.toLowerCase().indexOf(needle);
  return at < 0 ? "" : text.slice(at, at + skill.length);
}

/** Advisory only: freshness is not one of the four scored dimensions. */
export function freshnessNote(postedDate: string | null): string | null {
  const age = ageInDays(postedDate);
  if (age === null) return "no posting date; freshness unknown";
  if (age > 30) return `posted ${age}d ago (freshness advisory)`;
  return null;
}

/** Score one gate-surviving posting. Every dimension's evidence is quoted. */
export function scorePosting(g: GatedPosting, candidate: Candidate, judgment?: JudgmentInput): ScoredPosting {
  const text = `${g.posting.title}\n${g.description}`;
  const w = weightsFor(candidate.stage);
  const { hit, miss } = skillOverlap(candidate.skills, text);

  // Technical: the posting's own words for the skills it names.
  const technicalQuotes = hit.map((s) => quoteSkill(s, text)).filter(Boolean);
  const technicalRaw = candidate.skills.length ? hit.length / candidate.skills.length : 0;

  // Experience: the posting title echoing the target words.
  const titleHits = candidate.skills.filter((s) => g.posting.title.toLowerCase().includes(s.toLowerCase()));
  const experienceRaw = titleMatch(g.posting.title, candidate.skills);
  const experienceQuote = titleHits.length ? g.posting.title : "";

  // Behavioral and career arrive from the agent; the core does not re-derive them.
  const judgmentDimension = (name: string): { raw: number; evidence: string } => {
    const supplied = judgment?.dimensions?.[name];
    if (!supplied || !supplied.reason?.trim()) return { raw: 0, evidence: "" };
    const raw = Number.isFinite(supplied.score) ? Math.max(0, Math.min(1, supplied.score)) : 0;
    return { raw, evidence: supplied.reason.trim() };
  };
  const behavioral = judgmentDimension("behavioral");
  const career = judgmentDimension("career");

  const dimensions = explainDimensions([
    { name: "technical", canonicalWeight: w.technical ?? 0, raw: technicalRaw, evidence: technicalQuotes[0] ?? "" },
    { name: "experience", canonicalWeight: w.experience ?? 0, raw: experienceRaw, evidence: experienceQuote },
    { name: "behavioral", canonicalWeight: w.behavioral ?? 0, raw: behavioral.raw, evidence: behavioral.evidence },
    { name: "career", canonicalWeight: w.career ?? 0, raw: career.raw, evidence: career.evidence },
  ]);

  const explanation: ScoreExplanation = {
    dimensions,
    band: bandFor(0),
    gates: g.gates,
    modelVersion: modelVersion(),
    ...(judgment ? { judgmentVersion: judgment.version } : {}),
    notes: [],
  };
  const score = Math.round(100 * dimensions.reduce((sum, d) => sum + d.contribution, 0));
  explanation.band = bandFor(score);

  const note = freshnessNote(g.posting.postedDate);
  if (note) explanation.notes.push(note);

  const scored = dimensions.filter((d) => d.status === "scored");
  const strengths = scored.map((d) => `${d.name}: "${d.evidence}"`);
  const gaps = miss.slice(0, 3).map((s) => `no mention of "${s}" in posting text`);
  for (const d of dimensions.filter((x) => x.status !== "scored")) {
    gaps.push(`${d.name}: ${unevaluatedDimension(d.name, d.canonicalWeight).evidence}`);
  }
  for (const gate of g.gates.filter((x) => x.verdict === "FLAG" && x.note)) {
    gaps.push(`${gate.gate}: ${gate.note}`);
  }
  if (note) gaps.push(note);

  return {
    posting: g.posting,
    score,
    verdict: explanation.band.name as Verdict,
    strengths,
    gaps: gaps.slice(0, 6),
    explanation,
    modelVersion: explanation.modelVersion,
  };
}
