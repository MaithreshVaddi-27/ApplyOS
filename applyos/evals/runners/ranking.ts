// Origin: clean-room 2026-11-26, Phase 9. Author: OpenCode agent.
import { scorePosting, type Candidate } from "@applyos/matching";
import type { EvalResult } from "../types.js";

function rho(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 1;
  const rank = (values: number[]): number[] => {
    const order = values.map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v);
    const out = new Array<number>(n);
    order.forEach((entry, i) => { out[entry.i] = i + 1; });
    return out;
  };
  const ra = rank(a), rb = rank(b);
  const ma = (n + 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (ra[i] - ma) * (rb[i] - ma);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - ma) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 1;
}

export function runRankingEval(items: any[]): EvalResult {
  const first: number[] = [];
  const second: number[] = [];
  const bands: string[][] = [[], []];
  const ids: string[] = [];
  for (const item of items) {
    const candidate = item.candidate as Candidate;
    const s1 = scorePosting(item.gated, candidate);
    first.push(s1.score);
    bands[0].push(s1.verdict);
    ids.push(item.id);
  }
  // The perturbation under test: reverse the input row order.
  for (const item of [...items].reverse()) {
    const s2 = scorePosting(item.gated, item.candidate as Candidate);
    second.push(s2.score);
    bands[1].push(s2.verdict);
  }
  const reversedSecond = [...second].reverse();
  const reversedBands = [...bands[1]].reverse();
  const sigma = Math.sqrt(
    first.reduce((sum, v, i) => sum + (v - reversedSecond[i]) ** 2, 0) / (first.length || 1),
  );
  const churn = bands[0].filter((b, i) => b !== reversedBands[i]).length;
  const topK = Math.max(1, Math.ceil(items.length / 2));
  const top = (scores: number[]): Set<number> => new Set(
    scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s).slice(0, topK).map((x) => x.i),
  );
  const a = top(first), b = top(reversedSecond);
  const overlap = [...a].filter((i) => b.has(i)).length / topK;
  const distribution = Object.fromEntries(
    ids.map((id, i) => [id, [first[i], reversedSecond[i]]]),
  );
  return {
    suite: "ranking",
    labels: items.length,
    metrics: {
      spearman: rho(first, reversedSecond),
      topKOverlap: overlap,
      bandChurn: items.length ? churn / items.length : 0,
      scoreSigma: sigma,
    },
    distribution,
    notes: ["perturbation is input row order; the deterministic ranker must be invariant"],
  };
}
