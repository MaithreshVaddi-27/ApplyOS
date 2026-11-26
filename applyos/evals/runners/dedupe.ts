// Origin: clean-room 2026-11-26, Phase 9. Author: OpenCode agent.
import { collapseReqSpread, dedupeKey } from "@applyos/core";
import type { JobPosting } from "@applyos/core";
import type { EvalResult } from "../types.js";

export function runDedupeEval(items: any[]): EvalResult {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  const byKind: Record<string, [number, number]> = {};

  for (const item of items) {
    const a = item.pair.a as JobPosting;
    const b = item.pair.b as JobPosting;
    // A pair is one requisition if either the canonical key matches or the
    // requisition-spread collapse merges them.
    const predicted = dedupeKey(a) === dedupeKey(b) || collapseReqSpread([a, b]).collapsed === 1;
    const actual = item.labels.duplicate === true;
    if (predicted && actual) tp++;
    else if (predicted && !actual) fp++;
    else if (!predicted && actual) fn++;
    else tn++;
    const entry = byKind[item.kind] ?? [0, 0];
    entry[0] += predicted && actual ? 1 : 0;
    entry[1] += predicted ? 1 : 0;
    byKind[item.kind] = entry;
  }

  return {
    suite: "dedupe",
    labels: items.length,
    metrics: {
      precision: tp + fp ? tp / (tp + fp) : 1,
      recall: tp + fn ? tp / (tp + fn) : 1,
      falseMergeRate: fp + tn ? fp / (fp + tn) : 0,
    },
    distribution: byKind,
    notes: ["pairwise; each corpus item is one labelled pair"],
  };
}
