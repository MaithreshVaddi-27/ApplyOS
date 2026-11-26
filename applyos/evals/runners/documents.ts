// Origin: clean-room 2026-11-26, Phase 9. Author: OpenCode agent.
import type { EvalResult } from "../types.js";

const norm = (s: string): string => s.replace(/\s+/g, " ").trim().toLowerCase();

export function runDocumentsEval(items: any[]): EvalResult {
  let claims = 0, inPdf = 0, withUngrounded = 0, gapsPreserved = 0, budgetsMet = 0, extractable = 0;
  const distribution: Record<string, number[]> = {};

  for (const item of items) {
    const m = item.manifest;
    const text = norm(item.pdfText ?? "");
    let missing = 0;
    for (const c of m.claims ?? []) {
      claims++;
      if (norm(c.text) && text.includes(norm(c.text))) inPdf++;
      else missing++;
    }
    const ungrounded = Array.isArray(m.ungrounded) ? m.ungrounded.length : 0;
    if (ungrounded > 0) withUngrounded++;
    const gaps = Array.isArray(m.gaps) ? m.gaps : [];
    if (gaps.every((g: string) => norm(g) === "" || text.includes(norm(g)))) gapsPreserved++;
    const budgetOk = m.pageBudget?.pages === m.pageBudget?.required;
    if (budgetOk) budgetsMet++;
    if (m.ats?.extractable) extractable++;
    distribution[item.id] = [missing, ungrounded, budgetOk ? 0 : 1];
  }

  return {
    suite: "documents",
    labels: items.length,
    metrics: {
      claimInPdfRate: claims ? inPdf / claims : 1,
      ungroundedRate: items.length ? withUngrounded / items.length : 0,
      gapPreservationRate: items.length ? gapsPreserved / items.length : 1,
      pageBudgetCompliance: items.length ? budgetsMet / items.length : 1,
      atsExtractability: items.length ? extractable / items.length : 1,
    },
    distribution,
    notes: ["manifest records what the generator believed; a semantic source check is future work"],
  };
}
