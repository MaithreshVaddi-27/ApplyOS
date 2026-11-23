// Phase 4.7 (docs/PROJECT_BLUEPRINT.md) — the Greenhouse ATS connector.
//
// The parity fixtures were captured from the pre-migration engine connector,
// so the SDK must reproduce its rows exactly.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import {
  createGreenhouseProvider,
  greenhouseDetailUrl,
  greenhouseListUrl,
  mapGreenhouseJob,
  mapGreenhouseJobs,
  type GreenhouseRow,
} from "../src/greenhouse.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEED = JSON.parse(readFileSync(join(FIXTURES, "ats-greenhouse-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "ats-greenhouse-expected.json"), "utf8"));
const SEARCH = JSON.parse(readFileSync(join(FIXTURES, "ats-greenhouse-search-expected.json"), "utf8"));
const DETAIL = JSON.parse(readFileSync(join(FIXTURES, "ats-greenhouse-detail-expected.json"), "utf8"));

/** The stand-in tenant. */
function fixtureFetch(): typeof fetch {
  const listUrl = greenhouseListUrl("groww");
  const jobs = FEED.jobs;
  return (async (url: unknown) => {
    const href = String(url);
    if (href.includes("/jobs/") && href.includes("?content=true")) {
      const jobId = decodeURIComponent(href.match(/\/jobs\/([^/?]+)\?/)?.[1] ?? "");
      if (jobId !== String(DETAIL.id)) {
        return { status: 404, ok: false, text: async () => "", json: async () => ({}) };
      }
      const body = JSON.stringify({ id: DETAIL.id, title: "R", absolute_url: `https://boards.greenhouse.io/groww/jobs/${DETAIL.id}`, content: "<p>Listing body.</p>" });
      return { status: 200, ok: true, text: async () => body, json: async () => JSON.parse(body) };
    }
    const body = JSON.stringify({ jobs });
    return { status: 200, ok: true, text: async () => body, json: async () => JSON.parse(body) };
  }) as unknown as typeof fetch;
}

/** The engine's row convention applied to an SDK row. */
function toEngineRow(row: GreenhouseRow) {
  return {
    id: `greenhouse:${row.slug}:${row.id}`,
    title: row.title,
    company: "Groww",
    location: row.location,
    postedDate: row.date ? row.date.slice(0, 10) : null,
    url: row.url,
    portal: "greenhouse",
    source: "adapter",
  };
}

test("the SDK produces the rows the engine connector produced", () => {
  const rows = mapGreenhouseJobs("groww", FEED.jobs);
  expect(rows.map(toEngineRow)).toEqual(EXPECTED);
});

test("the SDK reproduces the pre-migration search, query for query", async () => {
  const provider = createGreenhouseProvider({ slug: "groww", company: "Groww", fetchImpl: fixtureFetch() });
  for (const [name, captured] of Object.entries(SEARCH) as Array<[string, any]>) {
    const page = await provider.search({ query: captured.query, limit: captured.limit });
    expect(page.rows.map(toEngineRow)).toEqual(captured.rows);
    expect(page.truncated).toBe(captured.truncated);
  }
});

test("a posting with no id is not a posting", () => {
  expect(mapGreenhouseJob("groww", {} as any)).toBeNull();
  expect(mapGreenhouseJob("groww", { id: 1, title: "R" })?.title).toBe("R");
});

test("the tenant URLs are built from the slug", () => {
  expect(greenhouseListUrl("groww")).toBe("https://boards-api.greenhouse.io/v1/boards/groww/jobs?content=false");
  expect(greenhouseDetailUrl("groww", "42")).toBe("https://boards-api.greenhouse.io/v1/boards/groww/jobs/42?content=true");
});

test("a 404 is an http failure, not an empty board", async () => {
  const missing = (async () => ({ status: 404, ok: false, text: async () => "", json: async () => ({}) })) as unknown as typeof fetch;
  const provider = createGreenhouseProvider({ slug: "groww", fetchImpl: missing });
  try {
    await provider.search({});
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("http");
  }
});

contractSuite(createGreenhouseProvider({ slug: "groww", company: "Groww", fetchImpl: fixtureFetch() }), {
  fetchImpl: fixtureFetch(),
  knownRef: "4970739101",
});
