// Origin: clean-room 2026-10-10, offline (robots cache seeded → zero fetches). Author: OpenCode agent.
import { describe, expect, test, afterEach } from "bun:test";
import { __robotsCache } from "@applyos/core/robots";
import { loadRegistry } from "@applyos/company-scraper/registry";
import { gatedPortalRun, portalSeedUrls, runUnifiedSearch } from "../src/scrape";

afterEach(() => {
  __robotsCache.clear();
});

describe("gatedPortalRun", () => {
  test("a disallowed seed skips the source loudly without calling fetch", async () => {
    __robotsCache.set("https://remoteok.com", ["/"]);
    let called = false;
    const out = await gatedPortalRun("remoteok", async () => {
      called = true;
      return { rows: [], truncated: false };
    });
    expect(called).toBe(false);
    expect(out.error).toMatch(/robots disallow/);
    expect(out.rows).toHaveLength(0);
  });
  test("an allowed seed runs the fetch", async () => {
    __robotsCache.set("https://remoteok.com", ["/private/"]);
    const out = await gatedPortalRun("remoteok", async () => ({ rows: [], truncated: false }));
    expect(out.error).toBeUndefined();
  });
  test("every aggregator portal has a seed URL", () => {
    for (const p of ["remoteok", "remotive", "weworkremotely", "unstop", "freehire", "arbeitnow"]) {
      expect(portalSeedUrls[p]).toMatch(/^https:\/\//);
    }
  });
});

describe("runUnifiedSearch robots gate (offline)", () => {
  test("root-disallowed everywhere yields an empty, loud run with zero fetches", async () => {
    // Block every aggregator origin plus every company-board origin.
    for (const url of Object.values(portalSeedUrls)) {
      __robotsCache.set(new URL(url).origin, ["/"]);
    }
    __robotsCache.set("https://boards-api.greenhouse.io", ["/"]);
    __robotsCache.set("https://api.lever.co", ["/"]);
    __robotsCache.set("https://api.smartrecruiters.com", ["/"]);
    __robotsCache.set("https://www.amazon.jobs", ["/"]);
    for (const e of loadRegistry()) {
      if (e.board === "workday") {
        const [tenant = "", , n = "3"] = e.slug.split("/");
        __robotsCache.set(`https://${tenant}.wd${n}.myworkdayjobs.com`, ["/"]);
      }
    }
    let fetched = false;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (..._args: unknown[]) => {
      fetched = true;
      throw new Error("network must not be touched");
    }) as unknown as typeof fetch;
    try {
      const { results, meta } = await runUnifiedSearch({ query: "intern", limit: 10 });
      expect(results).toHaveLength(0);
      expect(fetched).toBe(false);
      expect(meta.notes.length).toBeGreaterThan(0);
      expect(meta.notes.every((n) => !n.ok)).toBe(true);
      expect(meta.notes.some((n) => n.error?.includes("robots"))).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
