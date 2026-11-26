// Origin: clean-room 2026-11-26, Phase 9. Author: OpenCode agent.
export interface EvalResult {
  suite: string;
  labels: number;
  /** Metric name → 0..1 rate (scoreSigma is an absolute point value). */
  metrics: Record<string, number>;
  /** Per-item or per-gate detail, so an average never hides the tail. */
  distribution: Record<string, number[]>;
  notes: string[];
}
