// Origin: clean-room 2026-10-07, gate list re-derived from hiring-filter needs. Author: OpenCode agent.
import { ageInDays } from "@applyos/core";
import type { JobPosting, CandidateStage } from "@applyos/core";

export type GateVerdict = "PASS" | "FAIL" | "FLAG";

export interface GateResult {
  gate: string;
  verdict: GateVerdict;
  /** Quoted evidence from the posting; empty when nothing triggered. */
  note: string;
}

/** Every gate that reads posting text; none of them can fire without it. */
const TEXT_GATES = "language, batch, stipend, ctc, bond";

const pass = (gate: string): GateResult => ({ gate, verdict: "PASS", note: "" });

/** A posting has text to gate on. */
const hasText = (description: string): boolean => description.trim().length > 0;

/**
 * PASS with an explicit "not looked at" note, for a pass that carries no
 * description (the `rank` search pass). Reporting FLAG here would claim
 * "no stipend stated" about a posting the ranker never read, and those
 * fabricated notes crowd real gaps out of every ranked shortlist.
 */
const notEvaluated = (gate: string): GateResult => ({
  gate,
  verdict: "PASS",
  note: `not evaluated: no description text in this pass (see ${TEXT_GATES})`,
});

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
  /** Days the candidate needs to serve before joining (notice-period gate). */
  noticePeriodDays?: number;
  /** Candidate's own timezone, e.g. "IST" (timezone-overlap gate). */
  timezone?: string;
}

export interface GatedPosting {
  posting: JobPosting;
  description: string;
  gates: GateResult[];
  /** True when no gate returned FAIL. */
  pass: boolean;
}

/**
 * Staleness is an advisory, not a gate. The spec's /rank Step 3 flags an old
 * posting and leaves the decision to the candidate; it never vetoes on age
 * alone. Kept as a named result for callers that want the flag explicitly.
 */
export function staleGate(posting: JobPosting, maxAgeDays: number): GateResult {
  const age = ageInDays(posting.postedDate);
  if (age === null) return { gate: "stale", verdict: "FLAG", note: "no posting date; freshness unknown" };
  if (age > maxAgeDays) return { gate: "stale", verdict: "FLAG", note: `posted ${age}d ago (> ${maxAgeDays}d window)` };
  return pass("stale");
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
  if (!candidate.locations.length) return pass("location");
  if (posting.location == null) return { gate: "location", verdict: "FAIL", note: "location unstated (source gave none)" };
  const loc = normalizeLocation(posting.location);
  const ok = candidate.locations.some((l) => loc.includes(normalizeLocation(l)));
  if (ok) return pass("location");
  const remoteOk = candidate.locations.some((l) => l.toLowerCase() === "remote") && /remote/i.test(posting.location);
  if (remoteOk) return { gate: "location", verdict: "PASS", note: "" };
  return { gate: "location", verdict: "FAIL", note: `location "${posting.location}" outside accepted set` };
}

/** Non-English working-language requirements fail in this English-only edition. */
export function languageGate(description: string): GateResult {
  if (!hasText(description)) return notEvaluated("language");
  const fluent = description.match(/fluent\s+([a-z]+)/i);
  if (fluent && fluent[1].toLowerCase() !== "english") {
    return { gate: "language", verdict: "FAIL", note: `requires working language: "${fluent[0]}"` };
  }
  const m = description.match(/(hindi|kannada|tamil|telugu|malayalam|marathi|bengali|german|french|spanish|japanese|mandarin)\s*(required|must|essential)/i);
  if (m) return { gate: "language", verdict: "FAIL", note: `requires working language: "${m[0]}"` };
  return pass("language");
}

/**
 * Eligibility is a HARD STOP in the spec (04-job-evaluation.md): a citizenship,
 * permanent-residency or security-clearance requirement means do not score, do
 * not draft. Silence is not a requirement, so it passes; a quoted requirement
 * fails with the posting's own words preserved in the note.
 */
export function eligibilityGate(description: string): GateResult {
  if (!hasText(description)) return notEvaluated("eligibility");
  const m =
    description.match(/(?:must\s+be|requires?|need)\s+(?:a\s+)?(?:citizen|permanent\s+resident|national)\s+of\s+([A-Za-z][A-Za-z\s]{1,30})/i) ??
    description.match(/(citizenship|permanent\s+residency|\bPR\b|security\s+clearance)[^.]{0,30}?(?:required|mandatory|essential)/i) ??
    description.match(/(?:required|mandatory)\s+[^.]{0,20}?(citizenship|permanent\s+residency|security\s+clearance)/i);
  if (m) return { gate: "eligibility", verdict: "FAIL", note: `eligibility requirement: "${m[0].replace(/[\r\n]+/g, " ").trim()}"` };
  return pass("eligibility");
}

/**
 * A year only counts as a batch year when a batch word sits beside it. Without
 * this, incidental prose ("rewritten in 2020", "founded in 2019") reads as a
 * batch restriction and wrongly gates a candidate out of a valid posting.
 */
const BATCH_TERM = "batch|graduat(?:ing|es|ion|ors?)?|pass\\s?out|passing\\s+out|class\\s+of|cohort|fresher";

/** The enclosing sentence, so exclusivity is judged locally rather than document-wide. */
function sentenceAt(text: string, index: number): string {
  let start = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (/[.;!?]/.test(text[i])) { start = i + 1; break; }
  }
  let end = text.length;
  for (let i = index; i < text.length; i++) {
    if (/[.;!?\n]/.test(text[i])) { end = i + 1; break; }
  }
  return text.slice(start, end);
}

/** Batch-gated postings ("2026 batch only") fail candidates outside the window. */
export function batchGate(description: string, candidate: Candidate): GateResult {
  if (candidate.stage !== "student" && candidate.stage !== "fresher") return pass("batch");
  if (!candidate.gradYear) return pass("batch");
  if (!hasText(description)) return notEvaluated("batch");

  // Year-then-term or term-then-year, both within a short window.
  const near = new RegExp(
    `\\b(20\\d{2})\\b[^.;!?|\\n]{0,30}?\\b(?:${BATCH_TERM})\\b` +
      `|\\b(?:${BATCH_TERM})\\b[^.;!?|\\n]{0,30}?\\b(20\\d{2})\\b`,
    "gi",
  );
  const years = new Set<number>();
  let exclusive = false;
  for (const m of description.matchAll(near)) {
    years.add(Number(m[1] ?? m[2]));
    // Exclusivity is read from the batch sentence only. The word "only" is
    // ordinary English ("a team of only 30 engineers") and must never be read
    // as a batch restriction from an unrelated clause.
    if (/\b(only|exclusively|exclusive|restricted)\b/i.test(sentenceAt(description, m.index ?? 0))) exclusive = true;
  }
  if (!years.size) return pass("batch");
  const listed = [...years].sort();
  if (years.has(candidate.gradYear)) return pass("batch");
  if (exclusive) return { gate: "batch", verdict: "FAIL", note: `batch-restricted to ${listed.join("/")} (candidate: ${candidate.gradYear})` };
  return { gate: "batch", verdict: "FLAG", note: `mentions batches ${listed.join("/")} (candidate: ${candidate.gradYear})` };
}

/** Currency-prefixed or bare amount: ₹12,000 / Rs 12000 / INR 12,000 / 12000 */
const AMOUNT = "(?:₹|rs\\.?\\s+|inr\\s*)?(\\d[\\d,]*(?:\\.\\d+)?)";

/**
 * First amount tied to `unit`, in either order: "₹20,000 per month" and
 * "a monthly stipend of ₹20,000" both parse.
 *
 * `unit` must be unambiguous on its own. A bare `pm`/`pa` abbreviation would
 * read "interviews at 3 p.m." as a stipend of 3 and fail a posting the
 * candidate should have kept, so those forms are deliberately not accepted.
 */
function firstMoney(text: string, unit: string): number | null {
  // Gap between a unit-first phrase and its amount may not cross a sentence
  // boundary, and must be justified by a currency marker or an explicit "of",
  // so "monthly stipend of INR 20000" parses but "monthly visits to 5 offices"
  // does not.
  const gap = "[^.;!?|\\n]{0,20}?";
  const cur = "(?:₹|rs\\.?\\s*|inr\\s*)";
  const patterns = [
    new RegExp(`${AMOUNT}\\s*(?:${unit})`, "i"),
    new RegExp(`(?:${unit})\\s*(?:of\\s+|is\\s+|about\\s+|around\\s+|up\\s+to\\s+)?${cur}?(\\d[\\d,]*(?:\\.\\d+)?)`, "i"),
    new RegExp(`(?:${unit})${gap}${cur}(\\d[\\d,]*(?:\\.\\d+)?)`, "i"),
    new RegExp(`(?:${unit})${gap}\\bof\\s+${cur}?(\\d[\\d,]*(?:\\.\\d+)?)`, "i"),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const n = Number(m[1].replace(/,/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Stipend below floor fails for students; otherwise flags when stated. */
export function stipendGate(description: string, candidate: Candidate): GateResult {
  if (candidate.stage !== "student" || !candidate.stipendFloor) return pass("stipend");
  if (!hasText(description)) return notEvaluated("stipend");
  const v = firstMoney(description, "per\\s+month|per\\s+mo\\b|/\\s*month|/\\s*mo\\b|monthly");
  if (v === null) return { gate: "stipend", verdict: "FLAG", note: "no stipend stated" };
  if (v < candidate.stipendFloor) return { gate: "stipend", verdict: "FAIL", note: `stipend ${v} < floor ${candidate.stipendFloor}/month` };
  return pass("stipend");
}

/** A figure already denominated in lakhs: "12 LPA", "₹12 lakh per annum". */
const CTC_LAKHS = "\\blpa\\b|\\blakhs?\\b";
/** A rupee figure for the year, converted to lakhs: "₹8,00,000 per annum". */
const CTC_RUPEES = "per\\s+annum\\b|\\bannually\\b|/\\s*yr\\b";

/** The spec calls this the Compensation Gate; the engine used `ctc`. */
export function compensationGate(description: string, candidate: Candidate): GateResult {
  if (!candidate.ctcFloor) return pass("compensation");
  if (!hasText(description)) return notEvaluated("compensation");
  // Read the denominator from the unit that actually matched: probing the whole
  // description for "lpa" mis-scales a rupee figure that merely mentions it.
  const lakhs = firstMoney(description, CTC_LAKHS);
  const rupees = lakhs === null ? firstMoney(description, CTC_RUPEES) : null;
  const lpa = lakhs !== null ? lakhs : rupees === null ? null : rupees / 100_000;
  if (lpa === null) return { gate: "compensation", verdict: "FLAG", note: "no CTC stated" };
  if (lpa < candidate.ctcFloor) return { gate: "compensation", verdict: "FLAG", note: `CTC ~${lpa.toFixed(1)} LPA < floor ${candidate.ctcFloor} LPA` };
  return pass("compensation");
}

/** Back-compatible name for callers that imported the old gate. */
export const ctcGate = compensationGate;

/** Service/training bonds always flag with the quoted terms; never auto-fail. */
export function bondGate(description: string): GateResult {
  if (!hasText(description)) return notEvaluated("bond");
  const m = description.match(/(service (agreement|bond)|training bond|bond of [\w\s]+years?)[^.]{0,80}/i);
  // Posting text can carry newlines/pipes — collapse so the note stays one table-safe line.
  if (m) return { gate: "bond", verdict: "FLAG", note: `bond terms: "${m[0].replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|").trim()}"` };
  return pass("bond");
}

/**
 * A longer notice period than the candidate can serve is a FLAG with the
 * posting's own words — the spec never vetoes a role on notice alone.
 */
export function noticeGate(description: string, candidate: Candidate): GateResult {
  if (candidate.stage !== "experienced" || !candidate.noticePeriodDays) return pass("notice");
  if (!hasText(description)) return notEvaluated("notice");
  const m = description.match(/notice\s+period[^.]{0,40}?(\d+)\s*(days?|weeks?|months?)/i);
  if (!m) return pass("notice");
  const multiplier = /month/i.test(m[2]) ? 30 : /week/i.test(m[2]) ? 7 : 1;
  const required = Number(m[1]) * multiplier;
  if (required > candidate.noticePeriodDays) {
    return { gate: "notice", verdict: "FLAG", note: `notice period "${m[0].trim()}" exceeds the candidate's ${candidate.noticePeriodDays}d` };
  }
  return pass("notice");
}

/** Remote-global roles must offer reasonable timezone overlap or async work. */
export function timezoneGate(description: string, candidate: Candidate): GateResult {
  if (candidate.stage !== "remote-global") return pass("timezone");
  if (!hasText(description)) return notEvaluated("timezone");
  const m = description.match(/[^.]{0,40}(?:time\s?zone|overlap|IST\s*shifts?)[^.]{0,60}/i);
  if (!m) return pass("timezone");
  const quoted = m[0].replace(/[\r\n]+/g, " ").trim();
  const asyncOk = /async|flexible\s+hours|no\s+overlap\s+required/i.test(quoted);
  if (asyncOk || (candidate.timezone && quoted.toLowerCase().includes(candidate.timezone.toLowerCase()))) {
    return pass("timezone");
  }
  return { gate: "timezone", verdict: "FLAG", note: `timezone requirement: "${quoted}"` };
}

/**
 * Run the nine gates defined in framework/scoring.json. FAIL anywhere marks
 * the posting failed (with reasons kept). Staleness is deliberately NOT here:
 * the spec makes it a flag in /rank Step 3, never a veto.
 */
export function runGates(posting: JobPosting, description: string, candidate: Candidate, _maxAgeDays: number): GatedPosting {
  const gates = [
    eligibilityGate(description),
    locationGate(posting, candidate),
    languageGate(description),
    batchGate(description, candidate),
    stipendGate(description, candidate),
    compensationGate(description, candidate),
    bondGate(description),
    noticeGate(description, candidate),
    timezoneGate(description, candidate),
  ];
  return { posting, description, gates, pass: gates.every((g) => g.verdict !== "FAIL") };
}
