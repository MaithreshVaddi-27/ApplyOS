// Origin: clean-room 2026-10-07, own minimal YAML-subset parser (no deps). Author: OpenCode agent.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type BoardKind = "amazon" | "greenhouse" | "lever" | "smartrecruiters" | "workday";

export interface CompanyEntry {
  company: string;
  board: BoardKind;
  slug: string;
  region: "india" | "global";
  category: "mega-cap" | "india-product" | "gcc" | "startup";
}

const HERE = dirname(fileURLToPath(import.meta.url));

export function registryPath(): string {
  return join(HERE, "..", "registry.yaml");
}

/** Parse the registry's flat `key: value` list format — intentionally tiny, no YAML dep. */
export function parseRegistry(text: string): CompanyEntry[] {
  const entries: CompanyEntry[] = [];
  let current: Record<string, string> = {};
  const flush = () => {
    if (current.company && current.board && current.slug) {
      entries.push({
        company: current.company,
        board: current.board as BoardKind,
        slug: current.slug,
        region: current.region === "global" ? "global" : "india",
        category: (current.category ?? "startup") as CompanyEntry["category"],
      });
    }
    current = {};
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("- ")) {
      flush();
      const rest = line.slice(2).trim();
      if (rest) {
        const i = rest.indexOf(":");
        if (i > 0) current[rest.slice(0, i).trim()] = rest.slice(i + 1).trim();
      }
      continue;
    }
    const i = line.indexOf(":");
    if (i > 0) current[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  flush();
  return entries;
}

export function loadRegistry(): CompanyEntry[] {
  const path = registryPath();
  if (!existsSync(path)) return [];
  return parseRegistry(readFileSync(path, "utf8"));
}

export function resolveTargets(
  entries: CompanyEntry[],
  opts: { company?: string; board?: string; category?: string; region?: string },
): CompanyEntry[] {
  return entries.filter((e) => {
    if (opts.company && e.company.toLowerCase() !== opts.company.toLowerCase() && e.slug !== opts.company) return false;
    if (opts.board && e.board !== opts.board) return false;
    if (opts.category && e.category !== opts.category) return false;
    if (opts.region && e.region !== opts.region) return false;
    return true;
  });
}

