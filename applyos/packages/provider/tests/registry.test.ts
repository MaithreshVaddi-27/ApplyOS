// Phase 4.8 — the unified provider registry.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isInstalled,
  loadProviderRegistry,
  parseProviderRegistry,
  providerIds,
  providerRegistryPath,
  providerStatus,
  registrySections,
} from "../src/registry.js";

const TEXT = readFileSync(providerRegistryPath(), "utf8");

test("the registry is the single source of truth: fourteen boards, each once", () => {
  const entries = loadProviderRegistry();
  const ids = providerIds();
  expect(entries).toHaveLength(14);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toContain("remoteok");
  expect(ids).toContain("arbeitnow");
  expect(ids).toContain("greenhouse");
  expect(ids).toContain("eightfold");
});

test("every board has exactly one implementation, and it exists", () => {
  for (const entry of loadProviderRegistry()) {
    expect(entry.implementation.startsWith("applyos/packages/provider/src/")).toBe(true);
    expect(isInstalled(entry)).toBe(true);
  }
});

test("the old company registry is a section of the same file", () => {
  const sections = registrySections(TEXT);
  expect(sections.providers).toContain("remoteok");
  expect(sections.companies).toContain("Groww");
  expect(sections.companies).not.toContain("id: remoteok");
});

test("enabled off is the health check's only write, and absence is skipped", () => {
  const [entry] = loadProviderRegistry();
  expect(providerStatus(entry)).toBe("ok");
  expect(providerStatus({ ...entry, enabled: false })).toBe("disabled");
  expect(providerStatus({ ...entry, implementation: "does/not/exist.ts" })).toBe("skipped (not installed)");
});

test("an unknown kind or market fails loudly", () => {
  const base = "- id: x\n  kind: ats\n  implementation: a/b.ts\n  enabled: true\n  markets: [india]\n";
  expect(parseProviderRegistry(base)).toHaveLength(1);
  expect(() => parseProviderRegistry(base.replace("kind: ats", "kind: boardx"))).toThrow(/unknown kind/);
  expect(() => parseProviderRegistry(base.replace("[india]", "[mars]"))).toThrow(/unknown market/);
});
