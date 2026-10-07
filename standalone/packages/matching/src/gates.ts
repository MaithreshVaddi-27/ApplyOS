// Origin: clean-room 2026-10-07, gate list re-derived from hiring-filter needs. Author: OpenCode agent.
import { ageInDays } from "../../core/src/index";
import type { JobPosting, CandidateStage } from "../../core/src/index";

export type GateVerdict = "PASS" | "FAIL" | "FLAG";

export interface GateResult {
  gate: string;
  verdict: GateVerdict;
  /** Quoted evidence from the posting; empty when nothing triggered. */
  note: string;
}

/** Minimal candidate profile for matching (explicit params; file wiring lands in Phase 5). */
export interface Candidate {
  stage: CandidateStage;
  /** Skill phrases, e.g. ["python", "react", "backend"]. Matched case-insensitively. */
  skills: string[];
  /** Accepted locations, e.g. ["Bengaluru", "Remote"]. Empty means anywhere. */
  locations: string[];
  /** Graduation year for batch-gated postings (students/freshers). */
  gradYear?: number;
  /** Monthly stipend floor (students), in posting currency units. */
  stipendFloor?: number;
  /** Annual CTC floor (freshers/experienced). */
  ctcFloor?: number;
}

export interface GatedPosting {
  posting: JobPosting;
  description: string;
  gates: GateResult[];
  /** True when no gate returned FAIL. */
  pass: boolean;
}

/** Stale postings fail fast: nobody should apply to a months-old listing blind. */
export function staleGate(posting: JobPosting, maxAgeDays: number): GateResult {
  const age = ageInDays(posting.postedDate);
  if (age === null) return { gate: "stale", verdict: "FLAG", note: "no posting date; freshness unknown" };
  if (age > maxAgeDays) return { gate: "stale", verdict: "FAIL", note: `posted ${age}d ago (> ${maxAgeDays}d window)` };
  return { gate: "stale", verdict: "PASS", note: "" };
}

/** Know spelling variants so "Bengaluru" also matches "Bangalore". */
const LOCATION_ALIASES: [RegExp, string][] = [
  [/bangalore/i, "bengaluru"],
  [/bombay/i, "mumbai"],
  [/new delhi/i, "delhi"],
  [/gurgaon/i, "gurugram"],
];

function normalizeLocation(s: string): string {
  let out = s.toLowerCase();
  for (const [re, canon] of LOCATION_ALIASES) out = out.replace(re, canon);
  return out;
}

/** Location must overlap the candidate's accepted set; remote rows pass remote seekers. */
export function locationGate(posting: JobPosting, candidate: Candidate): GateResult {
  if (!candidate.locations.length) return { gate: "location", verdict: "PASS", note: "" };
  const loc = normalizeLocation(posting.location);
  const ok = candidate.locations.some((l) => loc.includes(normalizeLocation(l)));
  if (ok) return { gate: "location", verdict: "PASS", note: "" };
  const remoteOk = candidate.locations.some((l) => l.toLowerCase() === "remote") && /remote/i.test(posting.location);
  if (remoteOk) return { gate: "location", verdict: "PASS", note: "" };
  return { gate: "location", verdict: "FAIL", note: `location "${posting.location}" outside accepted set` };
}

/** Non-English working-language requirements fail in this English-only edition. */
export function languageGate(description: string): GateResult {
  const m = description.match(/fluent\s+([a-z]+)|(hindi|kannada|tamil|telugu|malayalam|marathi|bengali|german|french|spanish|japanese|mandarin)\s*(required|must|essential)/i);
  if (m) return { gate: "language", verdict: "FAIL", note: `requires working language: "${m[0]}"` };
  return { gate: "language", verdict: "PASS", note: "" };
}

/** Batch-gated postings ("2026 batch only") fail candidates outside the window. */
export function batchGate(description: string, candidate: Candidate): GateResult {
  if (candidate.stage !== "student" && candidate.stage !== "fresher") return { gate: "batch", verdict: "PASS", note: "" };
  if (!candidate.gradYear) return { gate: "batch", verdict: "PASS", note: "" };
  const years = [...description.matchAll(/\b(20\d{2})\s*(batch|graduat\w*|pass\s?out|class of)?/gi)].map((m) => Number(m[1]));
  if (!years.length) return { gate: "batch", verdict: "PASS", note: "" };
  const exclusive = /only|exclusively/i.test(description.slice(0, 500));
  if (years.includes(candidate.gradYear)) return { gate: "batch", verdict: "PASS", note: "" };
  if (exclusive) return { gate: "batch", verdict: "FAIL", note: `batch-restricted to ${years.join("/")} (candidate: ${candidate.gradYear})` };
  return { gate: "batch", verdict: "FLAG", note: `mentions batches ${years.join("/")} (candidate: ${candidate.gradYear})` };
}

function firstMoney(text: string, unit: RegExp): number | null {
  const m = text.match(new RegExp(`(?:₹|rs\\.?\\s?|inr\\s?)?([\\d,]+(?:\\.\\d+)?)\\s*(?:${unit.source})`, "i"));
  if (!m) return null;
  return Number(m[1].replace(/,/g, ""));
}

/** Stipend below floor fails for students; otherwise flags when stated. */
export function stipendGate(description: string, candidate: Candidate): GateResult {
  if (candidate.stage !== "student" || !candidate.stipendFloor) return { gate: "stipend", verdict: "PASS", note: "" };
  const v = firstMoney(description, /(?:per month|\/month|p\.?m\.?|monthly)/);
  if (v === null) return { gate: "stipend", verdict: "FLAG", note: "no stipend stated" };
  if (v < candidate.stipendFloor) return { gate: "stipend", verdict: "FAIL", note: `stipend ${v} < floor ${candidate.stipendFloor}/month` };
  return { gate: "stipend", verdict: "PASS", note: "" };
}

/** CTC below floor flags (Indian postings mix fixed/variable/ESOP, so never auto-fail). */
export function ctcGate(description: string, candidate: Candidate): GateResult {
  if (!candidate.ctcFloor) return { gate: "ctc", verdict: "PASS", note: "" };
  const v = firstMoney(description, /(?:lpa|lakhs?(?: per annum)?|\/yr|per annum|p\.?a\.?)/);
  if (v === null) return { gate: "ctc", verdict: "FLAG", note: "no CTC stated" };
  const lpa = /lpa|lakhs?/i.test(description) ? v : v / 100_000;
  if (lpa < candidate.ctcFloor) return { gate: "ctc", verdict: "FLAG", note: `CTC ~${lpa.toFixed(1)} LPA < floor ${candidate.ctcFloor} LPA` };
  return { gate: "ctc", verdict: "PASS", note: "" };
}

/** Service/training bonds always flag with the quoted terms; never auto-fail. */
export function bondGate(description: string): GateResult {
  const m = description.match(/(service (agreement|bond)|training bond|bond of [\w\s]+years?)[^.]{0,80}/i);
  if (m) return { gate: "bond", verdict: "FLAG", note: `bond terms: "${m[0].trim()}"` };
  return { gate: "bond", verdict: "PASS", note: "" };
}

/** Run every gate; FAIL anywhere marks the posting failed (with reasons kept). */
export function runGates(posting: JobPosting, description: string, candidate: Candidate, maxAgeDays: number): GatedPosting {
  const gates = [
    staleGate(posting, maxAgeDays),
    locationGate(posting, candidate),
    languageGate(description),
    batchGate(description, candidate),
    stipendGate(description, candidate),
    ctcGate(description, candidate),
    bondGate(description),
  ];
  return { posting, description, gates, pass: gates.every((g) => g.verdict !== "FAIL") };
}
