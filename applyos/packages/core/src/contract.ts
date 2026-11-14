// Origin: clean-room 2026-11-13, Phase 2 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The shared contract, expressed as data.
//
// Three shapes cross the boundaries in this repository, and they are NOT the
// same shape:
//
//   the PROVIDER RESULT  — what a provider CLI prints on stdout
//   the ENGINE ROW       — JobPosting, what the engine passes around
//   the SEEN ENTRY       — what tools/rank_state.py stores in seen_jobs.json
//
// An agent that guesses a field name produces wrong data silently: a
// "location" invented as "" , a date read as postedDate when the row says
// date, a gate note dropped because the key was spelled differently. This
// module exists so that "what is this field called" has one answer, and so
// that the answer is machine-readable rather than remembered.
//
// This is the spec layer's way to reach the core (ADR-0007): the agent runs
// `applyos contract --format json` and reads the shapes instead of guessing.

import type { CandidateStage } from "./types";

export interface FieldSpec {
  /** The exact key, in the exact casing, on the wire. */
  readonly name: string;
  /** The TypeScript-ish type, as it appears in JSON. */
  readonly type: string;
  /** False means the field may be null — it means "the source did not state it". */
  readonly required: boolean;
  readonly note: string;
}

export interface ShapeSpec {
  readonly name: string;
  readonly where: string;
  readonly fields: FieldSpec[];
}

/** The row a provider CLI prints inside `results[]`. */
export const PROVIDER_RESULT: ShapeSpec = {
  name: "providerResult",
  where: "the `results[]` array of a provider CLI's stdout (ADR-0006)",
  fields: [
    { name: "id", type: "string", required: true, note: "Stable within the board; round-trips through `detail`." },
    { name: "title", type: "string", required: true, note: "As the source states it." },
    { name: "company", type: "string", required: true, note: "As the source states it." },
    { name: "location", type: "string | null", required: true, note: "null when the source states none. Never \"\", never a placeholder." },
    { name: "date", type: "string | null", required: true, note: "ISO YYYY-MM-DD, or null when the source states none." },
    { name: "url", type: "string", required: true, note: "The posting's canonical URL." },
  ],
};

/** The provider CLI's stdout envelope. */
export const PROVIDER_ENVELOPE: ShapeSpec = {
  name: "providerEnvelope",
  where: "a provider CLI's stdout (ADR-0006)",
  fields: [
    { name: "meta.count", type: "number", required: true, note: "Equals results.length. Always." },
    { name: "meta.page", type: "number", required: true, note: "The page actually returned." },
    { name: "results", type: "providerResult[]", required: true, note: "Possibly empty. An empty array is a legitimate 'no matches'." },
  ],
};

/** The engine's row type. */
export const ENGINE_ROW: ShapeSpec = {
  name: "jobPosting",
  where: "the engine's internal row type (packages/core/src/types.ts)",
  fields: [
    { name: "id", type: "string", required: true, note: "" },
    { name: "title", type: "string", required: true, note: "" },
    { name: "company", type: "string", required: true, note: "" },
    { name: "location", type: "string | null", required: true, note: "null means the source did not state it." },
    { name: "postedDate", type: "string | null", required: true, note: "ISO YYYY-MM-DD, or null. Note the camelCase: the provider result calls this `date`." },
    { name: "url", type: "string", required: true, note: "" },
    { name: "portal", type: "string", required: true, note: "Which adapter produced the row, e.g. \"naukri\"." },
    { name: "source", type: "\"adapter\" | \"fallback\"", required: true, note: "A live adapter call, or a search-index fallback." },
  ],
};

/** Per-source run notes. */
export const SOURCE_NOTE: ShapeSpec = {
  name: "sourceNote",
  where: "the engine's search metadata",
  fields: [
    { name: "portal", type: "string", required: true, note: "" },
    { name: "ok", type: "boolean", required: true, note: "" },
    { name: "truncated", type: "boolean", required: false, note: "True when the source hit its page cap and may hold more rows." },
    { name: "error", type: "string", required: false, note: "Present when ok is false. A dead source is a note, never an exception." },
  ],
};

/** One entry of `workspace/seen_jobs.json`. */
export const SEEN_ENTRY: ShapeSpec = {
  name: "seenEntry",
  where: "workspace/seen_jobs.json, under `seen` (written by tools/rank_state.py)",
  fields: [
    { name: "title", type: "string", required: false, note: "" },
    { name: "company", type: "string", required: false, note: "" },
    { name: "location", type: "string | null", required: false, note: "The posting's place. Not a verdict." },
    { name: "url", type: "string", required: false, note: "" },
    { name: "portal", type: "string", required: false, note: "" },
    { name: "posted_date", type: "string | null", required: false, note: "ISO YYYY-MM-DD, or null. snake_case here, unlike the provider result's `date`." },
    { name: "status", type: "string", required: false, note: "scored | ranked | skipped | expired | seen" },
    { name: "scores", type: "object", required: false, note: "The four spec dimensions: technical, experience, behavioral, career." },
    { name: "rank_score", type: "number", required: false, note: "The overall score." },
    { name: "rank_verdict", type: "string", required: false, note: "Strong Fit | Good Fit | Moderate Fit | Weak Fit | Poor Fit" },
    { name: "rank_date", type: "string", required: false, note: "ISO date of the last scoring." },
    { name: "rank_history", type: "object[]", required: false, note: "The last five scores, for movement." },
    { name: "location_verdict", type: "string", required: false, note: "PASS | FAIL | FLAG" },
    { name: "language_gate", type: "string", required: false, note: "PASS | FAIL. Absence is never a correction — a missing value does not clear a stored FAIL." },
    { name: "language_note", type: "string", required: false, note: "The quoted evidence." },
    { name: "deadline", type: "string | null", required: false, note: "ISO date. Absence is never a correction." },
    { name: "strengths", type: "string[]", required: false, note: "At most three, stored verbatim." },
    { name: "gaps", type: "string[]", required: false, note: "At most three, stored verbatim." },
  ],
};

/** The tracker CSV header. */
export const TRACKER_COLUMNS: readonly string[] = [
  "date", "company", "sector", "role", "role_type", "channel", "status",
  "contact_person", "fit_rating", "notes", "cv_file", "cover_letter_file",
  "source", "deadline",
];

/** The canonical tracker statuses. */
export const TRACKER_STATUSES: readonly string[] = [
  "drafted", "applied", "interview", "offer", "hired", "rejected",
  "no_response", "offer_declined", "withdrawn",
];

/** The candidate stages. */
export const CANDIDATE_STAGES: readonly CandidateStage[] = [
  "student", "fresher", "experienced", "remote-global",
];

/**
 * Where the scoring tables live.
 *
 * They are deliberately NOT in this file: the spec layer's
 * `04-job-evaluation.md` and `rank.md` are the reference, the Python tooling
 * mirrors them, and the engine does not yet. `applyos parity` reports the
 * difference. Putting a copy here would create a fourth place to update.
 */
export const SCORING_SOURCE = {
  dimensions: ".claude/skills/job-application-assistant/04-job-evaluation.md",
  stageWeights: ".claude/commands/rank.md (the stage table in Step 1)",
  bands: ".claude/commands/rank.md (Step 3, the verdict bands)",
  gates: ".claude/skills/job-application-assistant/04-job-evaluation.md",
  parityCommand: "python tools/spec_parity.py",
} as const;

/** The whole contract, as one machine-readable document. */
export function contractDocument(): Record<string, unknown> {
  return {
    contractVersion: 1,
    source: "applyos/packages/core/src/contract.ts",
    note:
      "These are the field names each boundary uses. The shapes differ on purpose: " +
      "the provider result says `date`, the engine row says `postedDate`, the seen " +
      "entry says `posted_date`. Pick the shape the boundary you are on actually uses.",
    shapes: {
      providerEnvelope: PROVIDER_ENVELOPE,
      providerResult: PROVIDER_RESULT,
      jobPosting: ENGINE_ROW,
      sourceNote: SOURCE_NOTE,
      seenEntry: SEEN_ENTRY,
    },
    tracker: {
      file: "workspace/job_search_tracker.csv",
      columns: TRACKER_COLUMNS,
      statuses: TRACKER_STATUSES,
      note:
        "`cover_letter_file` is legacy: it stays in the header and stays empty. " +
        "Legacy status spellings with a space (`no response`, `offer declined`) are " +
        "accepted on read and never written.",
    },
    candidateStages: CANDIDATE_STAGES,
    scoringSource: SCORING_SOURCE,
  };
}
