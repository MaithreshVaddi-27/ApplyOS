// Origin: clean-room 2026-11-26, Phase 5 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The matching layer's adapter over the ONE table reader.
//
// `applyos/packages/core/src/scoring.ts` already loads framework/scoring.json
// for the whole engine. This file deliberately contains no second loader:
// Phase 5 closes the drift by reading through core, not by adding another copy.
import { SCORING, bandFor as coreBandFor, stageWeights } from "@applyos/core";
import type { Band } from "@applyos/core";

export type ScoringBand = Band;

/** The version a stored score should carry so it stays interpretable. */
export function modelVersion(): string {
  return SCORING.scoringVersion;
}

/** The active stage's row, straight from the table. */
export function weightsFor(stage: string): Record<string, number> {
  return { ...(stageWeights(stage) ?? stageWeights("experienced") ?? stageWeights("remote-global") ?? {}) };
}

/** The canonical band for a 0..100 score, strongest first. */
export const bandFor = coreBandFor;

/** Gate definitions from the same table, for runGates()' callers. */
export function gateDefinitions() {
  return SCORING.gates;
}

export { SCORING };
