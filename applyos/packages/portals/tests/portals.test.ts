// Origin: clean-room 2026-10-07, own fixtures, no network. Author: OpenCode agent.
import { describe, expect, test, afterEach } from "bun:test";
import { mapRemoteOk, searchRemoteOk } from "../src/remoteok";
import { mapRemotive, searchRemotive } from "../src/remotive";
import { mapUnstop, searchUnstop } from "../src/unstop";
import { mapFreehire, searchFreehire } from "../src/freehire";
import { mapWwr } from "../src/weworkremotely";
import { mapArbeitnow } from "../src/arbeitnow";

describe("portal mappers", () => {
  test("remoteok skips header rows and keeps null-safe dates", () => {
    const rows = mapRemoteOk([
      { id: 1, position: "Backend Dev", company: "Acme", location: "Worldwide", date: "2026-10-05T00:00:00Z", url: "https://remoteok.com/x/1" },
      { id: 2, url: "https://remoteok.com/x/2" },
      { id: 3, position: "No date role", company: "Acme", url: "https://remoteok.com/x/3", date: "" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].postedDate).toBe("2026-10-05");
    expect(rows[1].postedDate).toBeNull();
  });
  test("remotive maps fixture", () => {
    const rows = mapRemotive([
      { id: 9, title: "SDE Intern", company_name: "Beta", candidate_required_location: "India", publication_date: "2026-09-30T12:00:00", url: "https://remotive.com/x/9" },
    ]);
    expect(rows[0]).toMatchObject({ portal: "remotive", location: "India", postedDate: "2026-09-30" });
  });
  test("garbage dates null out instead of leaking raw slices", () => {
    const ro = mapRemoteOk([
      { id: 1, position: "R", company: "A", url: "https://remoteok.com/x/1", date: "not-a-date" },
    ]);
    expect(ro[0].postedDate).toBeNull();
    const rm = mapRemotive([
      { id: 1, title: "R", company_name: "A", publication_date: "yesterday-ish", url: "https://remotive.com/x/1" },
    ]);
    expect(rm[0].postedDate).toBeNull();
    const us = mapUnstop([
      { id: 1, title: "R", start_date: "soon", public_url: "https://unstop.com/o/1" },
    ]);
    expect(us[0].postedDate).toBeNull();
    const usOk = mapUnstop([
      { id: 2, title: "R", start_date: "2026-10-01T00:00:00Z", public_url: "https://unstop.com/o/2" },
    ]);
    expect(usOk[0].postedDate).toBe("2026-10-01");
  });
  test("unstop/freehire coerce non-string payload fields via asText", () => {
    const us = mapUnstop([
      { id: 7, title: 12345 as unknown as string, location: 99 as unknown as string, public_url: "https://unstop.com/o/7" },
    ]);
    expect(us[0].title).toBe("12345");
    expect(us[0].location).toBe("99");
    const fh = mapFreehire([
      { id: 8, title: "R", company: 777 as unknown as string, url: "https://freehire.me/x/8" },
    ]);
    expect(fh[0].company).toBe("777");
  });
});

describe("unstop envelope", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  test("unknown envelope yields zero rows, ok:true (pinned; loud-fail is follow-up)", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ surprise: [] }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    const r = await searchUnstop("sde", 10);
    expect(r.rows).toEqual([]);
  });
});

describe("search truncation (offline)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  function stubJson(payload: unknown): void {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
  }
  test("limit slices and flags truncation; limit 0 returns everything", async () => {
    const jobs = [1, 2, 3].map((i) => ({ id: i, title: `R${i}`, company_name: "A", publication_date: "2026-10-01T00:00:00", url: `https://remotive.com/x/${i}` }));
    stubJson({ jobs });
    const capped = await searchRemotive("", 2);
    expect(capped.rows).toHaveLength(2);
    expect(capped.truncated).toBe(true);
    const all = await searchRemotive("", 0);
    expect(all.rows).toHaveLength(3);
    expect(all.truncated).toBe(false);
  });
  test("unstop envelope truncation follows the same contract", async () => {
    const items = [1, 2, 3].map((i) => ({ id: i, title: `R${i}`, start_date: "2026-10-01T00:00:00Z", public_url: `https://unstop.com/o/${i}` }));
    stubJson({ data: { data: items } });
    const capped = await searchUnstop("", 2);
    expect(capped.rows).toHaveLength(2);
    expect(capped.truncated).toBe(true);
  });
  test("freehire and remoteok truncation follow the same contract", async () => {
    stubJson({ jobs: [1, 2, 3].map((i) => ({ id: i, title: `R${i}`, company: "A", url: `https://freehire.me/x/${i}` })) });
    const fh = await searchFreehire("", 2);
    expect(fh.rows).toHaveLength(2);
    expect(fh.truncated).toBe(true);
    stubJson([1, 2, 3].map((i) => ({ id: i, position: `R${i}`, company: "A", url: `https://remoteok.com/x/${i}` })));
    const ro = await searchRemoteOk("", 2);
    expect(ro.rows).toHaveLength(2);
    expect(ro.truncated).toBe(true);
  });
});

describe("unstated locations stay null, never invented", () => {
  test("portals yield null when the source omits location", () => {
    expect(mapRemoteOk([{ id: 1, position: "R", company: "A", url: "https://remoteok.com/x/1" }])[0].location).toBeNull();
    expect(mapRemotive([{ id: 1, title: "R", company_name: "A", url: "https://remotive.com/x/1" }])[0].location).toBeNull();
    expect(mapFreehire([{ id: 1, title: "R", company: "A", url: "https://freehire.me/x/1" }])[0].location).toBeNull();
    expect(mapUnstop([{ id: 1, title: "R", public_url: "https://unstop.com/o/1" }])[0].location).toBeNull();
    expect(mapWwr([{ title: "R", link: "https://weworkremotely.com/x/1" }])[0].location).toBeNull();
    expect(mapArbeitnow([{ slug: "s", url: "https://arbeitnow.com/x", title: "R" }])[0].location).toBeNull();
  });
});
