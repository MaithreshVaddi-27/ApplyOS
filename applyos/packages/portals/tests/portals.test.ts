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
    // The board's rich listing carries `updated_at`, not `start_date`: the
    // engine's retired adapter read the thin listing's `start_date`.
    const us = mapUnstop([
      { id: 1, title: "R", updated_at: "soon", public_url: "https://unstop.com/o/1" },
    ]);
    expect(us[0].postedDate).toBeNull();
    const usOk = mapUnstop([
      { id: 2, title: "R", updated_at: "2026-10-01T00:00:00Z", public_url: "https://unstop.com/o/2" },
    ]);
    expect(usOk[0].postedDate).toBe("2026-10-01");
  });
  test("unstop/freehire coerce non-string payload fields via asText", () => {
    const us = mapUnstop([
      { id: 7, title: 12345 as unknown as string, organisation: { name: 99 as unknown as string }, public_url: "https://unstop.com/o/7" },
    ]);
    expect(us[0].title).toBe("12345");
    expect(us[0].company).toBe("99");
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
  test("a listing that is not the board's envelope is a loud failure", async () => {
    // The retired adapter read whatever came back through `pickArray`, so a
    // body it did not recognise became a silent empty pool. The SDK says the
    // difference instead: "no postings" and "the board changed" are not the
    // same fact, and `/scrape` reports the second as a source error.
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ surprise: [] }), { status: 200, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
    let message = "";
    try {
      await searchUnstop("sde", 10);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
    expect(message).toContain("did not carry a data array");
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
  test("remoteok truncation follows the same contract", async () => {
    stubJson([1, 2, 3].map((i) => ({ id: i, position: `R${i}`, company: "A", url: `https://remoteok.com/x/${i}` })));
    const ro = await searchRemoteOk("", 2);
    expect(ro.rows).toHaveLength(2);
    expect(ro.truncated).toBe(true);
  });
  test("freehire truncation follows the same contract", async () => {
    // The board's envelope is `{data, meta}` - the retired adapter asked for
    // a `jobs` envelope the board does not send, which is one reason its
    // endpoint 404'd and this source never produced a row.
    //
    // The board honours `limit` server-side, so it answers with the page it
    // was asked for and a `total` that counts every match.
    stubJson({
      data: [1, 2].map((i) => ({
        public_slug: `slug-${i}`,
        title: `R${i}`,
        company: "A",
        url: `https://freehire.me/x/${i}`,
      })),
      meta: { total: 3, limit: 2, offset: 0 },
    });
    const fh = await searchFreehire("", 2);
    expect(fh.rows).toHaveLength(2);
    expect(fh.truncated).toBe(true);
  });
});

describe("unstated locations stay null, never invented", () => {
  test("portals yield null when the source omits location", () => {
    expect(mapRemoteOk([{ id: 1, position: "R", company: "A", url: "https://remoteok.com/x/1" }])[0].location).toBeNull();    expect(mapRemotive([{ id: 1, title: "R", company_name: "A", url: "https://remotive.com/x/1" }])[0].location).toBeNull();
    expect(mapFreehire([{ id: 1, title: "R", company: "A", url: "https://freehire.me/x/1" }])[0].location).toBeNull();
    expect(mapUnstop([{ id: 1, title: "R", public_url: "https://unstop.com/o/1" }])[0].location).toBeNull();
    expect(mapWwr([{ title: "R", link: "https://weworkremotely.com/x/1" }])[0].location).toBeNull();
    expect(mapArbeitnow([{ slug: "s", url: "https://arbeitnow.com/x", title: "R" }])[0].location).toBeNull();
  });
  test("remoteok drops rows whose url is not a string (never casts blindly)", () => {
    const rows = mapRemoteOk([
      { id: 1, position: "R", company: "A", url: "https://remoteok.com/x/1" },
      { id: 2, position: "R", company: "A", url: 12345 as unknown as string },
      { id: 3, position: "R", company: "A" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["remoteok:1"]);
  });
});

describe("the remotive engine adapter is a surface over the SDK", () => {
  test("the engine's own row shape is applied to the SDK's rows", () => {
    const rows = mapRemotive([
      { id: 9, title: "SDE Intern", company_name: "Beta", candidate_required_location: "India", publication_date: "2026-09-30T12:00:00", url: "https://remotive.com/x/9" },
    ]);
    expect(rows[0]).toMatchObject({
      id: "remotive:9",
      portal: "remotive",
      source: "adapter",
      location: "India",
      postedDate: "2026-09-30",
    });
  });

  test("the query actually filters, which the retired adapter's ?search= never did", async () => {
    // Remotive's public endpoint ignores its query parameters - verified live
    // on 2026-11-14 - so the retired adapter's `?search=` never filtered
    // anything. The filter is applied client-side now.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          jobs: [
            { id: 1, title: "Senior Data Engineer", company_name: "A", url: "https://remotive.com/x/1", tags: ["data"] },
            { id: 2, title: "Office Assistant", company_name: "B", url: "https://remotive.com/x/2", tags: ["admin"] },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;
    try {
      const r = await searchRemotive("engineer", 0);
      expect(r.rows.map((x) => x.id)).toEqual(["remotive:1"]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("the remoteok engine adapter is a surface over the SDK", () => {
  test("the engine's own row shape is applied to the SDK's rows", () => {
    const rows = mapRemoteOk([
      { id: 7, position: "  Backend Dev  ", company: "Acme", location: "Bengaluru", date: "2026-10-05T00:00:00Z", url: "https://remoteok.com/x/7" },
    ]);
    expect(rows[0]).toMatchObject({
      id: "remoteok:7",
      portal: "remoteok",
      source: "adapter",
      location: "Bengaluru",
      postedDate: "2026-10-05",
    });
  });

  test("a limit of 0 means no cap, as every engine adapter expects", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          { id: 1, position: "R1", company: "A", url: "https://remoteok.com/x/1" },
          { id: 2, position: "R2", company: "A", url: "https://remoteok.com/x/2" },
          { id: 3, position: "R3", company: "A", url: "https://remoteok.com/x/3" },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;
    try {
      const all = await searchRemoteOk("", 0);
      expect(all.rows).toHaveLength(3);
      expect(all.truncated).toBe(false);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("a multi-word query matches, where the board's ?tag= filter matched nothing", async () => {
    // The retired adapter sent the query as `?tag=<query>`, which is a
    // server-side TAG filter: it returned nothing for "software engineer".
    // The SDK matches the way the CLI does.
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify([
          { id: 1, position: "Software Engineer", company: "A", url: "https://remoteok.com/x/1", tags: ["dev"] },
          { id: 2, position: "Data Analyst", company: "B", url: "https://remoteok.com/x/2", tags: ["data"] },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as unknown as typeof fetch;
    try {
      const r = await searchRemoteOk("software engineer", 0);
      expect(r.rows.map((x) => x.id)).toEqual(["remoteok:1"]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
