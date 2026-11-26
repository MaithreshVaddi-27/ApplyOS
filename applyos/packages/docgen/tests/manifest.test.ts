// Phase 6.4 — every document carries a machine-checkable manifest.
import { expect, test } from "bun:test";
import { buildManifest, DOCUMENT_MANIFEST_VERSION } from "../src/manifest";
import type { ApplicationPack } from "../src/pack";

const pack = {
  posting: { id: "1", title: "Python Engineer", company: "Acme", location: null, postedDate: null, url: "https://x/1", portal: "mock", source: "adapter" },
  score: 78,
  verdict: "Strong Fit" as const,
  resumeMarkdown: "## Experience\n- Built python APIs",
  pitch: "p", followUp: "f",
  traces: [{ claim: "Built python APIs", source: "experience[0].bullets[0]" }],
  gaps: ["kubernetes"],
} as ApplicationPack;

test("a manifest records every claim, its source and the delivery facts", () => {
  const m = buildManifest(pack);
  expect(m.documentVersion).toBe(DOCUMENT_MANIFEST_VERSION);
  expect(m.documentType).toBe("resume");
  expect(m.posting).toEqual({ url: "https://x/1", title: "Python Engineer", company: "Acme" });
  expect(m.claims).toEqual([{ text: "Built python APIs", source: "experience[0].bullets[0]", grounded: true }]);
  expect(m.ungrounded).toEqual([]);
  expect(m.gaps).toEqual(["kubernetes"]);
  expect(m.pageBudget).toEqual({ document: "resume", pages: 1, required: 1 });
  expect(m.ats).toEqual({ extractable: true, chars: pack.resumeMarkdown.length });
});

test("an unsourced claim is recorded in ungrounded, never silently grounded", () => {
  const m = buildManifest({ ...pack, traces: [{ claim: "Saved 40%", source: "" }] });
  expect(m.claims[0].grounded).toBe(false);
  expect(m.ungrounded).toEqual(["Saved 40%"]);
});

test("caller-supplied document facts are honoured", () => {
  const m = buildManifest(pack, {
    documentType: "cv",
    profilePath: "profile.json",
    pageBudget: { document: "cv", pages: 2, required: 2 },
  });
  expect(m.documentType).toBe("cv");
  expect(m.profile).toBe("profile.json");
  expect(m.pageBudget.pages).toBe(2);
});
