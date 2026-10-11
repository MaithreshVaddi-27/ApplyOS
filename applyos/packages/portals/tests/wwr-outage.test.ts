// Origin: clean-room 2026-10-09, S-M2 loud-fail fix. Offline only (stubbed fetch).
import { describe, expect, test } from "bun:test";
import { searchWwr } from "../src/weworkremotely";

const boom = () => Promise.reject(new Error("net down"));

describe("searchWwr failure isolation", () => {
  test("total feed outage throws (loud fail, never silent zeros)", async () => {
    let error = "";
    try {
      await searchWwr("backend", 10, boom);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    expect(error).toContain("weworkremotely");
  });
  test("partial outage still returns rows from live feeds", async () => {
    const xml = `<rss><channel><item><title>Backend Dev</title><link>https://x/1</link><pubDate>Mon, 06 Oct 2026 00:00:00 GMT</pubDate><dc:creator>Acme</dc:creator></item></channel></rss>`;
    let calls = 0;
    const flaky = () => (++calls === 1 ? Promise.resolve(xml) : Promise.reject(new Error("net down")));
    const { rows } = await searchWwr("backend", 10, flaky);
    expect(rows).toHaveLength(1);
    expect(rows[0].company).toBe("Acme");
  });
});
