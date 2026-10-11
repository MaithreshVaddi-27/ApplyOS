// Origin: clean-room 2026-10-10, derived from public Arbeitnow API docs + live probe. Offline only.
import { describe, expect, test } from "bun:test";
import { mapArbeitnow, searchArbeitnow } from "../src/arbeitnow";

describe("arbeitnow mapper", () => {
  test("maps feed rows with fallbacks, nulls bad dates", () => {
    const rows = mapArbeitnow([
      { slug: "a-1", company_name: "Acme", title: "Backend Dev", location: "Berlin", remote: false, url: "https://x/1", created_at: "2026-10-08T10:00:00Z" },
      { slug: "b-2", title: "", url: "https://x/2", created_at: "soon" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ portal: "arbeitnow", company: "Acme", postedDate: "2026-10-08", id: "arbeitnow:a-1" });
    expect(rows[1].title).toBe("Untitled");
    expect(rows[1].postedDate).toBeNull();
  });
  test("numeric unix created_at converts to ISO date", () => {
    const rows = mapArbeitnow([
      { slug: "c-3", company_name: "C", title: "T", url: "https://x/3", created_at: 1791626456 },
    ]);
    expect(rows[0].postedDate).toBe("2026-10-10");
  });
  test("total feed outage throws (loud fail, never silent zeros)", async () => {
    let error = "";
    try {
      await searchArbeitnow("backend", 10, () => Promise.reject(new Error("net down")));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    expect(error).toContain("arbeitnow");
  });
  test("query filters client-side, limit 0 means all", async () => {
    const feed = { data: [
      { slug: "a", company_name: "Acme", title: "Backend Dev", location: "Berlin", url: "https://x/a", created_at: "2026-10-08" },
      { slug: "b", company_name: "Beta", title: "Designer", location: "Paris", url: "https://x/b", created_at: "2026-10-08" },
    ] };
    const all = await searchArbeitnow("", 0, () => Promise.resolve(feed));
    expect(all.rows).toHaveLength(2);
    expect(all.truncated).toBe(false);
    const one = await searchArbeitnow("backend", 0, () => Promise.resolve(feed));
    expect(one.rows).toHaveLength(1);
    expect(one.rows[0].id).toBe("arbeitnow:a");
  });
});
