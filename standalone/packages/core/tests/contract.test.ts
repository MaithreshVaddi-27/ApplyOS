// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { isStale, ageInDays, clampLimit } from "../src/fetch";
import { parseDisallows, __robotsCache } from "../src/robots";
import { stripHtml, toJsonPayload, toTable, statusLines } from "../src/format";

describe("staleness flags, never drops", () => {
  const now = new Date("2026-10-07T00:00:00Z");
  test("old rows are stale", () => {
    expect(isStale("2026-08-01", 30, now)).toBe(true);
  });
  test("fresh rows pass", () => {
    expect(isStale("2026-10-01", 30, now)).toBe(false);
  });
  test("undated rows flag by default", () => {
    expect(isStale(null, 30, now)).toBe(true);
    expect(ageInDays(null, now)).toBeNull();
  });
});

describe("clampLimit", () => {
  test("0 means no cap", () => expect(clampLimit(0, 20, 200)).toBe(0));
  test("undefined falls back", () => expect(clampLimit(undefined, 20, 200)).toBe(20));
  test("caps at max", () => expect(clampLimit(999, 20, 200)).toBe(200));
});

describe("robots", () => {
  test("parses wildcard disallows", () => {
    const txt = "User-agent: *\nDisallow: /private/\nDisallow: /admin";
    expect(parseDisallows(txt)).toEqual(["/private/", "/admin"]);
  });
  test("ignores non-wildcard sections", () => {
    __robotsCache.clear();
    expect(parseDisallows("User-agent: Googlebot\nDisallow: /x")).toEqual([]);
  });
});

describe("format", () => {
  test("stripHtml decodes entities and drops tags", () => {
    expect(stripHtml("<div>Hello &amp; <b>world</b></div>")).toBe("Hello & world");
  });
  test("stripHtml handles double-encoded board markup", () => {
    expect(stripHtml("&lt;div&gt;&lt;strong&gt;About&lt;/strong&gt;&lt;/div&gt; &lt;p&gt;Hi&lt;/p&gt;")).toBe("About Hi");
    expect(stripHtml("a&amp;nbsp;b")).toBe("a b");
  });
  test("json payload carries results + meta", () => {
    const p = toJsonPayload([], { total: 0, truncated: false, notes: [], elapsedMs: 1 });
    expect(JSON.parse(p).meta.total).toBe(0);
  });
  test("table has a header", () => {
    expect(toTable([]).startsWith("TITLE")).toBe(true);
  });
  test("statusLines reports failures only", () => {
    const lines = statusLines(
      { total: 0, truncated: false, notes: [{ portal: "x", ok: false, error: "boom" }], elapsedMs: 0 },
      ["a"],
      [],
    );
    expect(lines.join("\n")).toContain("health: x");
  });
});
