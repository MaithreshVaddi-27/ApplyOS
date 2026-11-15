// The SDK's own invariants.
//
// These are the properties every provider relies on, so they are tested once
// here rather than once per board.

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..", "src");

/** Every file the SDK's runtime barrel reaches, transitively. */
function barrelSources(): string[] {
  const seen = new Set<string>();
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/from\s+"\.\/([a-z-]+)\.js"/g)) {
      visit(join(SRC, `${m[1]}.ts`));
    }
  };
  visit(join(SRC, "index.ts"));
  return [...seen];
}

test("the SDK has no runtime dependencies", () => {
  const pkg = JSON.parse(
    readFileSync(join(import.meta.dir, "..", "package.json"), "utf8"),
  );
  expect(pkg.dependencies ?? {}).toEqual({});
});

test("the barrel does not pull in the test runner", () => {
  // `contract.ts` imports `bun:test`, which does not exist outside a test
  // runner. If the barrel re-exported it, a production import of the SDK
  // would fail at load time - in a provider CLI, which has no test runner.
  for (const file of barrelSources()) {
    const text = readFileSync(file, "utf8");
    expect(text).not.toContain('from "bun:test"');
  }
});

test("the SDK reaches nothing outside its own package at runtime", () => {
  // A relative import that escapes the package would drag the engine's
  // dependency tree into a provider CLI that promises zero runtime
  // dependencies.
  for (const file of barrelSources()) {
    const text = readFileSync(file, "utf8");
    const escapes = text.match(/from\s+"(\.\.\/){2,}[^"]*"/g) ?? [];
    expect(escapes).toEqual([]);
  }
});
