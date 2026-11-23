// Phase 4.7, stage two — the Lever ATS connector.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import { createLeverProvider, leverDescription, leverListUrl, mapLeverJob, mapLeverJobs, type LeverRow } from "../src/lever.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEED = JSON.parse(readFileSync(join(FIXTURES, "ats-lever-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "ats-lever-expected.json"), "utf8"));
const SEARCH = JSON.parse(readFileSync(join(FIXTURES, "ats-lever-search-expected.json"), "utf8"));
const DETAIL = JSON.parse(readFileSync(join(FIXTURES, "ats-lever-detail-expected.json"), "utf8"));

function fixtureFetch(): typeof fetch {
  const body = JSON.stringify(FEED);
  return (async () => ({ status: 200, ok: true, text: async () => body, json: async () => JSON.parse(body) })) as unknown as typeof fetch;
}

function toEngineRow(row: LeverRow) {
  return {
    id: `lever:${row.slug}:${row.id}`,
    title: row.title,
    company: "CRED",
    location: row.location,
    postedDate: row.date ? row.date.slice(0, 10) : null,
    url: row.url,
    portal: "lever",
    source: "adapter",
  };
}

test("the SDK produces the rows the engine connector produced", () => {
  const rows = mapLeverJobs("cred", FEED).map((r) => ({ ...r, company: "CRED" }));
  expect(rows.map(toEngineRow)).toEqual(EXPECTED);
});

test("the SDK reproduces the pre-migration search, query for query", async () => {
  const provider = createLeverProvider({ slug: "cred", company: "CRED", fetchImpl: fixtureFetch() });
  for (const [name, captured] of Object.entries(SEARCH) as Array<[string, any]>) {
    const page = await provider.search({ query: captured.query, limit: captured.limit });
    expect(page.rows.map(toEngineRow)).toEqual(captured.rows);
    expect(page.truncated).toBe(captured.truncated);
  }
});

test("a posting with no id is not a posting", () => {
  expect(mapLeverJob("cred", {} as any)).toBeNull();
  expect(mapLeverJob("cred", { id: "1", text: "R" })?.title).toBe("R");
});

test("the detail body is the description plus the sections", async () => {
  const provider = createLeverProvider({ slug: "cred", company: "CRED", fetchImpl: fixtureFetch() });
  const detail = await provider.detail(DETAIL.id);
  // The engine caps its detail body at 4000 characters; the SDK keeps the whole text.
  expect((detail.description ?? "").slice(0, 4000)).toBe(DETAIL.detail.description);
});

test("the tenant URL is built from the slug", () => {
  expect(leverListUrl("cred")).toBe("https://api.lever.co/v0/postings/cred?mode=json");
});

test("the board's description rule keeps its shape", () => {
  expect(leverDescription({ id: "x", description: "<p>Hi</p>", lists: [{ text: "More", content: "<p>There</p>" }] })).toBe(
    "Hi\n\nMore\nThere",
  );
});

test("a 404 is an http failure, not an empty board", async () => {
  const missing = (async () => ({ status: 404, ok: false, text: async () => "", json: async () => ({}) })) as unknown as typeof fetch;
  const provider = createLeverProvider({ slug: "cred", fetchImpl: missing });
  try {
    await provider.search({});
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("http");
  }
});

contractSuite(createLeverProvider({ slug: "cred", company: "CRED", fetchImpl: fixtureFetch() }), {
  fetchImpl: fixtureFetch(),
  knownRef: String(FEED[0].id),
});
