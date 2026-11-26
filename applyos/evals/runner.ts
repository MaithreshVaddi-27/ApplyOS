// Origin: clean-room 2026-11-26, Phase 9. Author: OpenCode agent.
//
// Run every evaluation against the committed corpus and compare with the
// baselines. Offline and deterministic: no network, no model calls, injected
// clock. A metric outside its tolerance exits 1.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runGatesEval } from "./runners/gates.js";
import { runDedupeEval } from "./runners/dedupe.js";
import { runDocumentsEval } from "./runners/documents.js";
import { runRankingEval } from "./runners/ranking.js";
import type { EvalResult } from "./types.js";

export interface Baseline {
  corpusHash: string;
  modelVersion: string;
  suites: Record<string, { metrics: Record<string, number>; tolerance: Record<string, number> }>;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = resolve(HERE, "corpus");
const BASELINES = resolve(HERE, "baselines");

const RUNNERS: Record<string, (items: any[]) => EvalResult> = {
  gates: runGatesEval,
  dedupe: runDedupeEval,
  documents: runDocumentsEval,
  ranking: runRankingEval,
};

function itemsFor(suite: string): any[] {
  return JSON.parse(readFileSync(resolve(CORPUS, `${suite}.json`), "utf8")) as any[];
}

/** A stable hash of the corpus contents, for citing a measured number. */
export function corpusHash(): string {
  const manifest = readFileSync(resolve(CORPUS, "MANIFEST.json"));
  const files = ["gates", "dedupe", "documents", "ranking"].map((s) => readFileSync(resolve(CORPUS, `${s}.json`)));
  return createHash("sha256").update(Buffer.concat([manifest, ...files])).digest("hex").slice(0, 16);
}

/** Compare fresh measurements against a baseline. Pure and side-effect free. */
export function compare(results: EvalResult[], baseline: Baseline): string[] {
  const breaches: string[] = [];
  for (const result of results) {
    const expected = baseline.suites[result.suite];
    if (!expected) {
      breaches.push(`${result.suite}: no baseline`);
      continue;
    }
    for (const [metric, value] of Object.entries(result.metrics)) {
      const want = expected.metrics[metric];
      const tol = expected.tolerance[metric] ?? 0;
      if (want === undefined || Math.abs(value - want) > tol) {
        breaches.push(`${result.suite}.${metric}: ${value.toFixed(4)} outside ${want} ± ${tol}`);
      }
    }
  }
  return breaches;
}

export function runAll(): { results: EvalResult[]; baseline: Baseline; breaches: string[] } {
  const results = Object.entries(RUNNERS).map(([name, runner]) => runner(itemsFor(name)));
  const baseline = JSON.parse(readFileSync(resolve(BASELINES, "current.json"), "utf8")) as Baseline;
  return { results, baseline, breaches: compare(results, baseline) };
}

export function updateBaseline(results: EvalResult[]): Baseline {
  const suites: Baseline["suites"] = {};
  for (const result of results) {
    const tolerance: Record<string, number> = {};
    for (const metric of Object.keys(result.metrics)) {
      // A deliberate margin after the first measurement: a zero tolerance
      // would fail CI on every unrelated change.
      tolerance[metric] = metric === "scoreSigma" ? 0.5 : 0.02;
    }
    suites[result.suite] = { metrics: { ...result.metrics }, tolerance };
  }
  return { corpusHash: corpusHash(), modelVersion: "1.0.0", suites };
}

export function writeBaseline(baseline: Baseline): void {
  writeFileSync(resolve(BASELINES, "current.json"), JSON.stringify(baseline, null, 2) + "\n", "utf8");
}
