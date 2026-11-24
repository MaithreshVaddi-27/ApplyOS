// Origin: clean-room 2026-11-24, Phase 4.8 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The unified provider registry.
//
// One YAML answers every "which boards exist" question. It carries the
// provider facts (one implementation per board, its surfaces, markets, enabled
// flag) and the seeded company boards moved here from company-scraper's old
// registry. A tiny parser keeps the SDK dependency-free.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type RegistryKind = "board" | "ats" | "aggregator";
export type Market = "india" | "global" | "eu";

export interface ProviderEntry {
  id: string;
  kind: RegistryKind;
  /** The single implementation: a module in packages/provider/src. */
  implementation: string;
  /** Thin adapters over it, never implementations. */
  surfaces: string[];
  /** The health check's only permitted write, with confirmation. */
  enabled: boolean;
  markets: Market[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const KINDS: RegistryKind[] = ["board", "ats", "aggregator"];
const MARKETS: Market[] = ["india", "global", "eu"];

/** The registry is a sibling of src/, inside the zero-dependency SDK. */
export function providerRegistryPath(): string {
  return join(HERE, "..", "registry.yaml");
}

/** Repository root, for resolving the implementation and surface paths. */
export function repoRoot(): string {
  return resolve(HERE, "..", "..", "..", "..");
}

/** Split the YAML into its `providers:` and `companies:` sections. */
export function registrySections(text: string): { providers: string; companies: string } {
  const providers: string[] = [];
  const companies: string[] = [];
  let section: "providers" | "companies" | null = null;
  let sawHeader = false;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (/^providers:\s*$/.test(trimmed)) { section = "providers"; sawHeader = true; continue; }
    if (/^companies:\s*$/.test(trimmed)) { section = "companies"; sawHeader = true; continue; }
    if (section === "providers") providers.push(line);
    if (section === "companies") companies.push(line);
  }
  // A flat list with no section header is a providers list — the parser's
  // callers use that form in tests and in older tooling.
  if (!sawHeader) return { providers: text, companies: "" };
  return { providers: providers.join("\n"), companies: companies.join("\n") };
}

function inlineList(value: string): string[] {
  const inner = value.trim().replace(/^\[/, "").replace(/\]$/, "").trim();
  return inner ? inner.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

/** Parse the YAML subset. Unknown kinds or markets fail loudly. */
export function parseProviderRegistry(text: string): ProviderEntry[] {
  const entries: ProviderEntry[] = [];
  let current: Record<string, string> = {};
  const flush = () => {
    if (!current.id) { current = {}; return; }
    const kind = current.kind as RegistryKind;
    if (!KINDS.includes(kind)) throw new Error(`registry: unknown kind "${current.kind}" for ${current.id}`);
    const markets = inlineList(current.markets ?? "") as Market[];
    for (const m of markets) {
      if (!MARKETS.includes(m)) throw new Error(`registry: unknown market "${m}" for ${current.id}`);
    }
    entries.push({
      id: current.id,
      kind,
      implementation: current.implementation ?? "",
      surfaces: inlineList(current.surfaces ?? ""),
      enabled: (current.enabled ?? "true") !== "false",
      markets,
    });
    current = {};
  };
  for (const raw of registrySections(text).providers.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("- ")) {
      flush();
      const rest = line.slice(2).trim();
      const i = rest.indexOf(":");
      if (i > 0) current[rest.slice(0, i).trim()] = rest.slice(i + 1).trim();
      continue;
    }
    const i = line.indexOf(":");
    if (i > 0) current[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  flush();
  return entries;
}

/** Load all providers from the unified registry. */
export function loadProviderRegistry(): ProviderEntry[] {
  return parseProviderRegistry(readFileSync(providerRegistryPath(), "utf8"));
}

/** Every board id, once. The acceptance criterion's registry count. */
export function providerIds(): string[] {
  return loadProviderRegistry().map((p) => p.id);
}

/** Enabled providers that are actually installed. */
export function availableProviders(): ProviderEntry[] {
  return loadProviderRegistry().filter((p) => p.enabled && isInstalled(p));
}

/** An absent implementation is skipped, never a failure. */
export function isInstalled(entry: ProviderEntry): boolean {
  return existsSync(join(repoRoot(), entry.implementation));
}

/** Stable status line for the health check and doctor. */
export function providerStatus(entry: ProviderEntry): "disabled" | "skipped (not installed)" | "ok" {
  if (!entry.enabled) return "disabled";
  return isInstalled(entry) ? "ok" : "skipped (not installed)";
}
