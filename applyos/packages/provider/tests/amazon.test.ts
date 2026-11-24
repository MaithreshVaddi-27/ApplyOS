// Phase 4.7, stage five — the Amazon connector.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import {
  AMAZON_RESULT_LIMIT,
  amazonDate,
  amazonDescription,
  amazonDetailUrl,
  amazonSearchUrl,
  createAmazonProvider,
  findAmazonJob,
  mapAmazonJobs,
  type AmazonRow,
} from "../src/amazon.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEED = JSON.parse(readFileSync(join(FIXTURES, "ats-amazon-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "ats-amazon-expected.json"), "utf8"));
const SEARCH = JSON.parse(readFileSync(join(FIXTURES, "ats-amazon-search-expected.json"), "utf8"));
const DETAIL = JSON.parse(readFileSync(join(FIXTURES, "ats-amazon-detail-expected.json"), "utf8"));

/** The live feed behind a small stand-in: search filters; detail finds by id. */
function fixtureFetch(): typeof fetch {
  return (async (url: unknown) => {
    const params = new URL(String(url)).searchParams;
    const isDetail = !params.has("sort");
    if (isDetail) {
      const ref = params.get("base_query") ?? "";
      const jobs = findAmazonJob(FEED.jobs, ref) ? [findAmazonJob(FEED.jobs, ref)] : [];
      const body = JSON.stringify({ jobs });
      return { status: 200, ok: true, text: async () => body, json: async () => JSON.parse(body) };
    }
    const text = (params.get("base_query") ?? "").toLowerCase();
    const jobs = text
      ? FEED.jobs.filter((j: any) => `${j.title ?? ""} ${j.location ?? ""}`.toLowerCase().includes(text))
      : FEED.jobs;
    const body = JSON.stringify({ jobs, hits: jobs.length });
    return { status: 200, ok: true, text: async () => body, json: async () => JSON.parse(body) };
  }) as unknown as typeof fetch;
}

function toEngineRow(row: AmazonRow) {
  return {
    id: `amazon:${row.id}`,
    title: row.title,
    company: "Amazon",
    location: row.location,
    postedDate: row.date,
    url: row.url,
    portal: "amazon",
    source: "adapter",
  };
}

test("the SDK produces the rows the engine connector produced", () => {
  expect(mapAmazonJobs(FEED.jobs).map(toEngineRow)).toEqual(EXPECTED);
});

test("the SDK reproduces the pre-migration search, query for query", async () => {
  const provider = createAmazonProvider({ fetchImpl: fixtureFetch() });
  for (const [name, captured] of Object.entries(SEARCH) as Array<[string, any]>) {
    if (name === "full-page") continue; // covered separately with its synthetic page
    const page = await provider.search({ query: captured.query, limit: captured.limit });
    expect(page.rows.map(toEngineRow)).toEqual(captured.rows);
    expect(page.truncated).toBe(captured.truncated);
  }
});

test("a full server page still flags may-hold-more", async () => {
  const page = Array.from({ length: AMAZON_RESULT_LIMIT }, (_, i) => ({
    id: i + 1, title: `SDE ${i + 1}`, job_path: `/en/jobs/${i + 1}`,
  }));
  const fetchImpl = (async () => {
    const body = JSON.stringify({ jobs: page, hits: page.length });
    return { status: 200, ok: true, text: async () => body, json: async () => JSON.parse(body) };
  }) as unknown as typeof fetch;
  const provider = createAmazonProvider({ fetchImpl });
  const result = await provider.search({ query: "sde", limit: 0 });
  expect(result.truncated).toBe(true);
  expect(result.rows).toHaveLength(AMAZON_RESULT_LIMIT);
  const captured = (SEARCH as any)["full-page"].rows;
  expect(result.rows.map(toEngineRow)).toEqual(captured);
});

test("the lenient ISO parse keeps real dates and nulls invalid ones", () => {
  expect(amazonDate("2026-11-20")).toBe("2026-11-20");
  expect(amazonDate("not a date")).toBeNull();
  expect(amazonDate(undefined)).toBeNull();
});

test("the detail body keeps the engine's description rule", () => {
  const body = amazonDescription({ id: 1, title: "R", description: "<p>Build <b>things</b></p>", qualifications: "<p>BS</p>" });
  // The board's rule collapses whitespace to single spaces, so the blank line
  // between the two fields becomes one space.
  expect(body).toBe("Build things BS");
});

test("the detail lookup reproduces the engine's matched posting", async () => {
  const provider = createAmazonProvider({ fetchImpl: fixtureFetch() });
  const detail = await provider.detail(DETAIL.id);
  expect({ ...toEngineRow(detail), description: detail.description }).toEqual(DETAIL.cases.matched);
});

test("a detail search with no exact id match is a not-found failure", async () => {
  const provider = createAmazonProvider({ fetchImpl: fixtureFetch() });
  try {
    await provider.detail("definitely-missing-999");
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("not-found");
    expect((e as Error).message).toBe(DETAIL.cases.missing.error);
  }
});

test("the URLs carry the board's own parameters", () => {
  expect(amazonSearchUrl("sde", "IND")).toContain("result_limit=100");
  expect(amazonSearchUrl("sde")).toContain("base_query=sde");
  expect(amazonSearchUrl("sde")).toContain("country=IND");
  expect(amazonDetailUrl("42")).toBe("https://www.amazon.jobs/en/search.json?base_query=42&result_limit=10");
});

contractSuite(createAmazonProvider({ fetchImpl: fixtureFetch() }), {
  fetchImpl: fixtureFetch(),
  knownRef: DETAIL.id,
});
