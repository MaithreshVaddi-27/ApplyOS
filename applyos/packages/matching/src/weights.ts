// Origin: clean-room 2026-11-26, Phase 5 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The one weight table.
//
// Phase 5 closes the last Phase-2 parity difference: the engine no longer
// carries its own three-factor weights or three bands. Both come from
// framework/scoring.json, the same file the spec documents and the Python
// tooling reads. There is no fallback copy — a missing table is a loud error.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ScoringBand {
  name: string;
  min: number;
}

export interface ScoringGate {
  id: string;
  runsFor: { stages: string[]; markets: string[] };
  verdictOnFail: "FAIL" | "FLAG";
  hardStop?: boolean;
  note?: string;
}

export interface ScoringData {
  scoringVersion: string;
  dimensions: string[];
  stageWeights: Record<string, Record<string, number>>;
  bands: ScoringBand[];
  gates: ScoringGate[];
}

const SCORING_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..", "framework", "scoring.json");

let cached: ScoringData | null = null;

/** The canonical table, read once. No second copy exists in the engine. */
export function loadScoring(): ScoringData {
  if (cached) return cached;
  let raw: string;
  try {
    raw = readFileSync(SCORING_PATH, "utf8");
  } catch (e) {
    throw new Error(`framework/scoring.json is missing — the canonical scoring tables live there (${String(e)})`);
  }
  let data: ScoringData;
  try {
    data = JSON.parse(raw) as ScoringData;
  } catch (e) {
    throw new Error(`framework/scoring.json is not valid JSON: ${String(e)}`);
  }
  if (!data?.stageWeights || !Array.isArray(data.bands) || !data.scoringVersion) {
    throw new Error("framework/scoring.json lacks stageWeights, bands or scoringVersion");
  }
  cached = data;
  return data;
}

/** The version a stored score should carry so it stays interpretable. */
export function modelVersion(): string {
  return loadScoring().scoringVersion;
}

/** The active stage's row, straight from the table. */
export function weightsFor(stage: string): Record<string, number> {
  const table = loadScoring().stageWeights;
  return { ...(table[stage] ?? table.experienced ?? table["remote-global"] ?? {}) };
}

/** The canonical band for a 0..100 score, strongest first. */
export function bandFor(score: number): ScoringBand {
  const bands = loadScoring().bands;
  return bands.find((b) => score >= b.min) ?? bands[bands.length - 1];
}

/** Definitions for the gates runGates() must implement, from the same table. */
export function gateDefinitions(): ScoringGate[] {
  return loadScoring().gates;
}

export { SCORING_PATH };
