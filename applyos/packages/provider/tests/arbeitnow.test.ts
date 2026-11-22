// Phase 4 (docs/PROJECT_BLUEPRINT.md) — the Arbeitnow provider.
//
// The important tests here are the PARITY ones. Arbeitnow had exactly one
// implementation before this - the engine adapter - so that is what the
// fixtures were captured from, and the SDK must reproduce its rows.
//
// The engine's row is its own convention laid over the board's facts, so the
// comparison below states that convention once, here, rather than leaving it
// implied: the id prefix, the "Unknown" employer, the "Untitled" title, and
// the place that the engine has always shown as "Remote" when the board says
// a posting is remote but states no place. The SDK carries the board's own
// facts; the engine's surface applies its rule.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import {
  ARBEITNOW_API_URL,
  arbeitnowDate,
  arbeitnowLocation,
  createArbeitnowProvider,
  extractArbeitnowSlug,
  filterArbeitnow,
  parseArbeitnowJob,
  arbeitnowProvider,
  type ArbeitnowRawJob,
  type ArbeitnowRow,
} from "../src/arbeitnow.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEED = JSON.parse(readFileSync(join(FIXTURES, "arbeitnow-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "arbeitnow-expected.json"), "utf8"));
const SEARCH_EXPECTED = JSON.parse(
  readFileSync(join(FIXTURES, "arbeitnow-search-expected.json"), "utf8"),
);

/** The engine's row shape, as the retired adapter produced it. */
interface EngineRow {
  id: string;
  title: string;
  company: string;
  location: string | null;
  postedDate: string | null;
  url: string;
  portal: string;
  source: string;
}

/** The engine's convention applied to a board row. */
function toEngineRow(row: ArbeitnowRow): EngineRow {
  return {
    id: `arbeitnow:${row.id}`,
    title: row.title || "Untitled",
    company: row.company ?? "Unknown",
    location: row.location ?? (row.remote ? "Remote" : null),
    postedDate: row.date,
    url: row.url,
    portal: "arbeitnow",
    source: "adapter",
  };
}

/** The stand-in board. */
function fixtureFetch(): typeof fetch {
  const body = JSON.stringify(FEED);
  return (async (url: unknown) => {
    if (String(url) !== ARBEITNOW_API_URL) {
      return { status: 404, ok: false, text: async () => "", json: async () => ({}) };
    }
    return { status: 200, ok: true, text: async () => body, json: async () => JSON.parse(body) };
  }) as unknown as typeof fetch;
}

// --- parity: the mapped rows ---------------------------------------------

test("the SDK produces the rows the engine adapter produced before the migration", async () => {
  const provider = createArbeitnowProvider({ fetchImpl: fixtureFetch() });
  const page = await provider.search({ limit: 20 });
  expect(page.rows.length).toBe(EXPECTED.length);

  for (const [i, expected] of EXPECTED.entries()) {
    expect(toEngineRow(page.rows[i])).toEqual(expected);
  }
});

// --- parity: the whole envelope -------------------------------------------

test("the SDK reproduces the pre-migration search, query for query", async () => {
  const provider = createArbeitnowProvider({ fetchImpl: fixtureFetch() });
  const captures = Object.entries(SEARCH_EXPECTED) as Array<[string, any]>;

  for (const [name, captured] of captures) {
    const page = await provider.search({ query: captured.query, limit: captured.limit });
    expect(page.rows.length).toBe(captured.rows.length);
    expect(page.truncated).toBe(captured.truncated);
    // `total` is how many rows matched before the limit, which the captured
    // envelope does not carry; the rows themselves are compared below.
    expect(page.total).toBeGreaterThanOrEqual(page.rows.length);

    for (const [i, expected] of captured.rows.entries()) {
      expect(toEngineRow(page.rows[i])).toEqual(expected);
    }
  }
});

// --- the board's own rules ------------------------------------------------

test("the date is a unix-seconds timestamp, not an ISO string", () => {
  expect(arbeitnowDate(1795319723)).toBe("2026-11-22");
  expect(arbeitnowDate("2026-11-22T03:55:23.000Z")).toBe("2026-11-22");
  expect(arbeitnowDate(undefined)).toBeNull();
  expect(arbeitnowDate("soon")).toBeNull();
});

test("an empty place is null, and remote is not a place", () => {
  expect(arbeitnowLocation({ location: "" })).toBeNull();
  expect(arbeitnowLocation({ location: "  Berlin  " })).toBe("Berlin");
  // The board's remote flag is a fact of its own; it is not a place.
  expect(arbeitnowLocation({ location: "", remote: true })).toBeNull();
});

test("a posting with no slug or no url is not a posting", () => {
  expect(parseArbeitnowJob({ url: "https://www.arbeitnow.com/jobs/x" })).toBeNull();
  expect(parseArbeitnowJob({ slug: "x" })).toBeNull();
});

test("the tags and job types are read as lists", () => {
  const row = parseArbeitnowJob({
    slug: "x",
    url: "https://www.arbeitnow.com/jobs/x",
    title: "R",
    tags: ["a", "b"],
    job_types: ["Full-Time"],
    remote: true,
    created_at: 1795319723,
  });
  expect(row?.tags).toEqual(["a", "b"]);
  expect(row?.jobTypes).toEqual(["Full-Time"]);
  expect(row?.remote).toBe(true);
  expect(row?.createdAt).toBe(1795319723);
});

test("the slug is the last path segment of a reference", () => {
  expect(extractArbeitnowSlug("https://www.arbeitnow.com/jobs/companies/acme/backend-dev-1")).toBe(
    "backend-dev-1",
  );
  expect(extractArbeitnowSlug("backend-dev-1")).toBe("backend-dev-1");
});

// --- the filters ----------------------------------------------------------

test("a query matches the title and the company, as the retired adapter did", () => {
  const row = (over: Partial<ArbeitnowRow>): ArbeitnowRow => ({
    id: "x",
    title: "Backend Dev",
    company: "Acme",
    location: null,
    date: "2026-11-22",
    url: "https://www.arbeitnow.com/jobs/x",
    remote: false,
    tags: [],
    jobTypes: [],
    createdAt: null,
    ...over,
  });
  const rows = [row({ id: "title", title: "Python Backend" }), row({ id: "company", company: "Pythonistas" }), row({ id: "none", title: "Java Dev" })];
  expect(filterArbeitnow(rows, { query: "python" }).map((r) => r.id)).toEqual(["title", "company"]);
});

test("the place filter and the remote filter are honoured when asked for", () => {
  const row = (over: Partial<ArbeitnowRow>): ArbeitnowRow => ({
    id: "x",
    title: "R",
    company: "A",
    location: null,
    date: "2026-11-22",
    url: "https://www.arbeitnow.com/jobs/x",
    remote: false,
    tags: [],
    jobTypes: [],
    createdAt: null,
    ...over,
  });
  const rows = [
    row({ id: "berlin", location: "Berlin" }),
    row({ id: "remote", remote: true }),
    row({ id: "neither" }),
  ];
  expect(filterArbeitnow(rows, { location: "Berlin" }).map((r) => r.id)).toEqual(["berlin"]);
  expect(filterArbeitnow(rows, { extra: { remote: true } }).map((r) => r.id)).toEqual(["remote"]);
  expect(filterArbeitnow(rows, { extra: { remote: false } }).map((r) => r.id)).toEqual([
    "berlin",
    "neither",
  ]);
});

// --- the lookup -----------------------------------------------------------

test("the lookup is exact: a posting not in the feed is not-found", async () => {
  const provider = createArbeitnowProvider({ fetchImpl: fixtureFetch() });
  const slug = String(FEED.data[0].slug);
  const detail = await provider.detail(slug);
  expect(detail.id).toBe(slug);

  try {
    await provider.detail("definitely-not-a-real-posting-xyz");
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("not-found");
  }
});

// --- failures -------------------------------------------------------------

test("a feed that is not an envelope is a parse failure, not an empty board", async () => {
  const broken = (async () => ({
    status: 200,
    ok: true,
    text: async () => "not json",
    json: async () => {
      throw new Error("bad json");
    },
  })) as unknown as typeof fetch;
  const provider = createArbeitnowProvider({ fetchImpl: broken });
  try {
    await provider.search({});
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("parse");
  }
});

test("a 500 is an http failure", async () => {
  const failing = (async () => ({
    status: 500,
    ok: false,
    text: async () => "",
    json: async () => ({}),
  })) as unknown as typeof fetch;
  const provider = createArbeitnowProvider({ fetchImpl: failing });
  try {
    await provider.search({});
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("http");
  }
});

// --- the contract ---------------------------------------------------------

contractSuite(createArbeitnowProvider({ fetchImpl: fixtureFetch() }), {
  fetchImpl: fixtureFetch(),
  knownRef: String(FEED.data[0].slug),
});
