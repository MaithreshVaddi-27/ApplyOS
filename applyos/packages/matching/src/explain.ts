// Origin: clean-room 2026-11-26, Phase 5 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// Every score carries an explanation.
//
// A dimension's evidence is a quote from the posting, never a manufactured
// strength. A dimension with no evidence is not scored: it is reported as
// "not evaluated" and its weight is removed from the denominator rather than
// counted as zero, which would silently penalise the posting.
import type { GateResult } from "./gates.js";
import type { ScoringBand } from "./weights.js";

export type DimensionStatus = "scored" | "not evaluated";

export interface ExplainedDimension {
  name: string;
  /** Effective weight after unevaluated dimensions are removed; sums to 1. */
  weight: number;
  /** The weight from framework/scoring.json, before normalisation. */
  canonicalWeight: number;
  /** 0..1. Zero for an unevaluated dimension. */
  raw: number;
  /** weight × raw. Σ contribution × 100 is the score. */
  contribution: number;
  /** A quote from the posting, or the literal "not evaluated" marker. */
  evidence: string;
  status: DimensionStatus;
}

export interface ScoreExplanation {
  dimensions: ExplainedDimension[];
  band: ScoringBand;
  gates: GateResult[];
  modelVersion: string;
  /** The agent's judgment version, when a judgment input was supplied. */
  judgmentVersion?: string;
  /** Advisories that inform but never veto (for example posting age). */
  notes: string[];
}

/** A dimension the core did not evaluate, with no weight in the sum. */
export function notEvaluated(name: string, canonicalWeight: number): ExplainedDimension {
  return {
    name,
    weight: 0,
    canonicalWeight,
    raw: 0,
    contribution: 0,
    evidence: "not evaluated: no quoted evidence from the posting",
    status: "not evaluated",
  };
}

export interface DimensionInput {
  name: string;
  canonicalWeight: number;
  raw: number;
  evidence: string;
}

/**
 * Build the dimension rows. An empty quote means "not evaluated"; the asked-for
 * weight is reported in `canonicalWeight` but contributes nothing.
 */
export function explainDimensions(inputs: DimensionInput[]): ExplainedDimension[] {
  const scored = inputs.filter((d) => d.evidence.trim().length > 0);
  const totalWeight = scored.reduce((sum, d) => sum + d.canonicalWeight, 0);
  const effective = (w: number): number => (totalWeight > 0 && w > 0 ? w / totalWeight : 0);
  return inputs.map((d) => {
    if (d.evidence.trim().length === 0) return notEvaluated(d.name, d.canonicalWeight);
    const weight = effective(d.canonicalWeight);
    return {
      name: d.name,
      weight,
      canonicalWeight: d.canonicalWeight,
      raw: d.raw,
      contribution: weight * d.raw,
      evidence: d.evidence,
      status: "scored" as const,
    };
  });
}

/** Σ contribution × 100, rounded the same way the score is. */
export function explainedScore(explanation: ScoreExplanation): number {
  return Math.round(100 * explanation.dimensions.reduce((sum, d) => sum + d.contribution, 0));
}
