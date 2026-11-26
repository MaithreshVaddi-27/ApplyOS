// Origin: clean-room 2026-11-26, Phase 9 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The gate evaluation. The corpus is redacted and labelled by RUBRIC.md; the
// gates are never used to label it. Offline and deterministic: the clock is
// injected so a stale posting's flag does not move with today's date.
import { runGates, staleGate, type Candidate } from "@applyos/matching";
import type { JobPosting } from "@applyos/core";
import type { EvalResult } from "../types.js";

const NOW = new Date("2026-11-26T00:00:00Z");

export function runGatesEval(items: any[]): EvalResult {
  let keep = 0, keepRejected = 0, reject = 0, rejectAccepted = 0;
  let flagsRaised = 0, flagsDeserved = 0;
  const perGate: Record<string, { falseReject: number; falseAccept: number; flags: number }> = {};

  for (const item of items) {
    const candidate = item.candidate as Candidate;
    const posting = item.posting as JobPosting;
    const result = runGates(posting, item.description, candidate, 30);
    const failed = new Set(result.gates.filter((g) => g.verdict === "FAIL").map((g) => g.gate));
    const stale = staleGate(posting, 30, NOW);
    const raised = new Set(result.gates.filter((g) => g.verdict === "FLAG").map((g) => g.gate));
    if (stale.verdict === "FLAG") raised.add("stale");

    const wanted = new Set<string>(item.labels.flag ?? []);
    for (const gate of raised) {
      flagsRaised++;
      if (wanted.has(gate)) flagsDeserved++;
    }
    for (const gate of wanted) {
      if (!raised.has(gate) && !failed.has(gate)) {
        // A labelled flag the implementation never raised is a missed flag,
        // counted in the distribution rather than hidden in an average.
        (perGate[gate] ??= { falseReject: 0, falseAccept: 0, flags: 0 }).flags++;
      }
    }

    const isKeep = item.labels.keep === true;
    if (isKeep) {
      keep++;
      if (result.pass === false) {
        keepRejected++;
        for (const gate of failed) {
          (perGate[gate] ??= { falseReject: 0, falseAccept: 0, flags: 0 }).falseReject++;
        }
      }
    } else {
      reject++;
      if (result.pass === true) {
        rejectAccepted++;
        for (const gate of ["eligibility", "language", "location", "batch"]) {
          (perGate[gate] ??= { falseReject: 0, falseAccept: 0, flags: 0 }).falseAccept++;
        }
      }
    }
  }

  const distribution = Object.fromEntries(
    Object.entries(perGate).map(([gate, v]) => [gate, [v.falseReject, v.falseAccept, v.flags]]),
  );
  return {
    suite: "gates",
    labels: items.length,
    metrics: {
      falseRejectRate: keep ? keepRejected / keep : 0,
      falseAcceptRate: reject ? rejectAccepted / reject : 0,
      flagPrecision: flagsRaised ? flagsDeserved / flagsRaised : 1,
    },
    distribution,
    notes: ["false-reject rate is the headline metric; the clock is injected at 2026-11-26"],
  };
}
