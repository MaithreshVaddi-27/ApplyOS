// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test } from "bun:test";
import { isStale, ageInDays, clampLimit, parseNumArg } from "../src/fetch";
import { parseDisallows, robotsAllows, __robotsCache } from "../src/robots";
import { stripHtml, toJsonPayload, toTable, statusLines, asText, isoDateOnly } from "../src/format";

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
  test("root Disallow: / blocks every path (never ignored)", async () => {
    __robotsCache.clear();
    try {
      __robotsCache.set("https://blocked.example", ["/"]);
      __robotsCache.set("https://open.example", ["/private/"]);
      const denied = await robotsAllows("https://blocked.example/jobs/123");
      expect(denied.allowed).toBe(false);
      expect(denied.reason).toContain("robots-disallow");
      const allowed = await robotsAllows("https://open.example/public/jobs");
      expect(allowed.allowed).toBe(true);
      const deniedSub = await robotsAllows("https://open.example/private/jobs");
      expect(deniedSub.allowed).toBe(false);
    } finally {
      __robotsCache.clear();
    }
  });
});

describe("parseNumArg", () => {
  test("missing/NaN fall back", () => {
    expect(parseNumArg(undefined, 20, 1000)).toBe(20);
    expect(parseNumArg("abc", 20, 1000)).toBe(20);
  });
  test("negatives clamp to 1, zero passes through as no-cap", () => {
    expect(parseNumArg("-5", 20, 1000)).toBe(1);
    expect(parseNumArg("0", 20, 1000)).toBe(0);
  });
  test("caps at max, floors fractions", () => {
    expect(parseNumArg("9999", 20, 1000)).toBe(1000);
    expect(parseNumArg("7.9", 20, 1000)).toBe(7);
  });
});

describe("asText", () => {
  test("strings pass, numbers stringify, else fallback", () => {
    expect(asText("hi")).toBe("hi");
    expect(asText(42)).toBe("42");
    expect(asText(null, "fb")).toBe("fb");
    expect(asText(undefined)).toBe("");
    expect(asText({})).toBe("");
  });
});

describe("isoDateOnly", () => {
  test("keeps YYYY-MM-DD, nulls anything else", () => {
    expect(isoDateOnly("2026-10-05T00:00:00Z")).toBe("2026-10-05");
    expect(isoDateOnly("2026-10-05")).toBe("2026-10-05");
    expect(isoDateOnly("")).toBeNull();
    expect(isoDateOnly("not-a-date")).toBeNull();
    expect(isoDateOnly("05/10/2026")).toBeNull();
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
  test("table escapes pipes and newlines so rows stay one line", () => {
    const out = toTable([
      {
        id: "1", title: "SDE | Backend\nIntern", company: "Acme", location: "Bengaluru",
        postedDate: "2026-10-01", url: "https://x/1", portal: "m", source: "adapter",
      },
    ]);
    const lines = out.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).not.toContain(" | Backend");
    expect(lines[1]).toContain("SDE \\| Backend Intern");
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
