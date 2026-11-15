// Origin: clean-room 2026-11-13, Phase 4 of docs/PROJECT_BLUEPRINT.md. Author: OpenCode agent.
//
// The provider contract suite.
//
// Every provider gets the same tests. A provider that passes them satisfies
// the contract the two surfaces rely on; a provider that does not tells the
// contributor exactly which rule it broke.
//
// The suite never touches the network. The caller injects a fetch and a
// reference that exists.

import { expect, test } from "bun:test";
import { isProviderError, ProviderError } from "./errors.js";
import type { Provider } from "./types.js";

export interface ContractFixture {
  /** The network the provider sees. */
  fetchImpl: typeof fetch;
  /** A reference that exists, for the detail check. */
  knownRef: string;
  /** The number of rows the fixture holds, when the provider can say. */
  expectedRows?: number;
}

/**
 * Run the contract against a provider.
 *
 * Call it from a provider's own test file:
 *
 *   contractSuite(remoteOkProvider, {
 *     fetchImpl: fixtureFetch,
 *     knownRef: "1137716",
 *   });
 */
export function contractSuite(provider: Provider, fixture: ContractFixture): void {
  test(`${provider.id}: identifies itself with a non-empty id and a version`, () => {
    expect(provider.id).toBeTruthy();
    expect(provider.id).toMatch(/^[a-z0-9-]+$/);
    expect(provider.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(["board", "ats", "aggregator"]).toContain(provider.kind);
    expect(provider.displayName).toBeTruthy();
  });

  test(`${provider.id}: declares https seed urls for the robots gate`, () => {
    expect(provider.seedUrls.length).toBeGreaterThan(0);
    for (const url of provider.seedUrls) {
      expect(url.startsWith("https://")).toBe(true);
    }
  });

  test(`${provider.id}: a credential, if it needs one, comes from an env var`, () => {
    if (!provider.requiresCredential) return;
    expect(provider.requiresCredential.envVar).toMatch(/^[A-Z0-9_]+$/);
    expect(provider.requiresCredential.service).toBeTruthy();
  });

  test(`${provider.id}: search returns a well-formed page`, async () => {
    const page = await provider.search({ limit: 5 });
    expect(Array.isArray(page.rows)).toBe(true);
    expect(typeof page.total).toBe("number");
    expect(page.page).toBeGreaterThanOrEqual(1);
    expect(typeof page.truncated).toBe("boolean");
    if (fixture.expectedRows !== undefined) {
      expect(page.total).toBe(fixture.expectedRows);
    }
  });

  test(`${provider.id}: every row carries the required fields`, async () => {
    const page = await provider.search({ limit: 20 });
    for (const row of page.rows) {
      expect(typeof row.id).toBe("string");
      expect(row.id.length).toBeGreaterThan(0);
      expect(typeof row.title).toBe("string");
      expect(typeof row.company).toBe("string");
      expect(typeof row.url).toBe("string");
      expect(row.url.length).toBeGreaterThan(0);
    }
  });

  test(`${provider.id}: an absent location is null, never an empty string`, async () => {
    const page = await provider.search({ limit: 50 });
    for (const row of page.rows) {
      expect(row.location === null || typeof row.location === "string").toBe(true);
      if (typeof row.location === "string") {
        expect(row.location.length).toBeGreaterThan(0);
      }
    }
  });

  test(`${provider.id}: an absent date is null, never an empty string`, async () => {
    const page = await provider.search({ limit: 50 });
    for (const row of page.rows) {
      if (row.date !== null) expect(row.date.length).toBeGreaterThan(0);
    }
  });

  test(`${provider.id}: paging splits the same rows`, async () => {
    const all = await provider.search({ limit: 50 });
    if (all.total < 2) return;
    const first = await provider.search({ limit: 1, page: 1 });
    const second = await provider.search({ limit: 1, page: 2 });
    expect(first.rows.length).toBe(1);
    expect(second.rows.length).toBe(1);
    expect(first.rows[0].id).not.toBe(second.rows[0].id);
    expect(first.total).toBe(all.total);
  });

  test(`${provider.id}: detail returns the posting for a known reference`, async () => {
    const detail = await provider.detail(fixture.knownRef);
    expect(detail.id.length).toBeGreaterThan(0);
    expect(typeof detail.description).toBe("string");
  });

  test(`${provider.id}: an unknown reference raises a not-found provider error`, async () => {
    try {
      await provider.detail("definitely-not-a-real-posting-999999999");
      throw new Error("detail should have thrown");
    } catch (e) {
      expect(isProviderError(e)).toBe(true);
      expect((e as ProviderError).code).toBe("not-found");
    }
  });

  test(`${provider.id}: a network failure surfaces as a provider error`, async () => {
    const failing: Provider = {
      ...provider,
      search: async () => {
        throw new ProviderError("network", "the board is unreachable");
      },
    };
    try {
      await failing.search({ limit: 1 });
      throw new Error("search should have thrown");
    } catch (e) {
      expect(isProviderError(e)).toBe(true);
      expect((e as ProviderError).code).toBe("network");
      expect((e as ProviderError).cliCode).toBe("FETCH_ERROR");
    }
  });
}
