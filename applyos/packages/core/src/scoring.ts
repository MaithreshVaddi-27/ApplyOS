// Origin: clean-room 2026-11-13, Phase 3 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The canonical scoring tables, read from framework/scoring.json.
//
// The spec layer, the Python tooling, and the engine are three implementations
// of the same workflow. Their scoring tables used to live in three places, and
// they had already drifted: the tooling matched the spec value for value
// while the engine scored something else entirely.
//
// So the tables are DATA now, in one file, and everything reads it:
//
//   the spec layer  — the markdown remains the REFERENCE; tools/spec_parity.py
//                     compares it against this file and fails if they differ
//   the tooling     — tools/rank_state.py loads it (stdlib json, no Bun)
//   the engine      — this module
//
// The file lives at the repository root rather than inside a package because it
// is framework content, not engine content: the Python tooling must read it
// without Bun installed (the python-tests CI job installs no Bun at all), and
// the engine must be able to read it without depending on the tooling.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface StageWeights {
  technical: number;
  experience: number;
  behavioral: number;
  career: number;
}

export interface Band {
  name: string;
  min: number;
}

export interface GateRunsFor {
  /** Stages this gate runs for. "*" means every stage. */
  stages: string[];
  /** Markets this gate runs for. "*" means every market. */
  markets: string[];
}

export interface GateDefinition {
  id: string;
  runsFor: GateRunsFor;
  /** The verdict a gate returns when it trips. */
  verdictOnFail: "PASS" | "FAIL" | "FLAG";
  /** True when the spec says do not score and do not draft. */
  hardStop?: boolean;
  /** "pass-fail dimension" for the gates the spec scores rather than vetoes. */
  kind?: string;
  note?: string;
}

export interface ScoringTables {
  scoringVersion: string;
  dimensions: string[];
  stageWeights: Record<string, StageWeights>;
  bands: Band[];
  gates: GateDefinition[];
}

/** Walk up from this file to the folder holding framework/scoring.json. */
function findScoringFile(): string {
  let dir = import.meta.dir;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "framework", "scoring.json");
    if (existsSync(candidate)) return candidate;
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "framework/scoring.json not found. The canonical scoring tables live at the repository root; " +
      "without them the engine cannot know the spec's dimensions, weights, bands, or gates.",
  );
}

function load(): ScoringTables {
  const path = findScoringFile();
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`framework/scoring.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  const doc = parsed as Partial<ScoringTables>;
  if (!doc.stageWeights || !doc.bands || !doc.gates || !doc.dimensions) {
    throw new Error("framework/scoring.json is missing one of: dimensions, stageWeights, bands, gates");
  }
  return doc as ScoringTables;
}

/** The canonical tables. Loaded once, at import. */
export const SCORING: ScoringTables = load();

export const DIMENSIONS: readonly string[] = SCORING.dimensions;

/** The spec's stage weight rows, keyed by stage. */
export function stageWeights(stage: string): StageWeights | undefined {
  return SCORING.stageWeights[stage];
}

/** The verdict bands, strongest first. */
export const BANDS: readonly Band[] = SCORING.bands;

/** The band a score falls into, by the spec's thresholds. */
export function bandFor(score: number): Band {
  for (const band of SCORING.bands) {
    if (score >= band.min) return band;
  }
  return SCORING.bands[SCORING.bands.length - 1];
}

/** The canonical gate definitions, in the spec's order. */
export const GATES: readonly GateDefinition[] = SCORING.gates;

/** The definition of one gate, or undefined if the spec does not define it. */
export function gateDefinition(id: string): GateDefinition | undefined {
  return SCORING.gates.find((g) => g.id === id);
}

/**
 * Whether a gate runs for a stage and market.
 *
 * The spec's gates are stage-conditional: the stipend gate only runs for a
 * student in the India market, the notice-period gate only for an
 * experienced candidate, and so on. `*` matches every value.
 */
export function gateRunsFor(id: string, stage: string, market = "*"): boolean {
  const gate = gateDefinition(id);
  if (!gate) return false;
  const stageOk = gate.runsFor.stages.includes("*") || gate.runsFor.stages.includes(stage);
  const marketOk = gate.runsFor.markets.includes("*") || gate.runsFor.markets.includes(market);
  return stageOk && marketOk;
}
