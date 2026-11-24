// Phase 4.7, stage four — the Workday ATS connector.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import {
  WORKDAY_MAX_PAGE,
  createWorkdayProvider,
  mapWorkdayDetail,
  mapWorkdayPosting,
  mapWorkdayPostings,
  workdayDate,
  workdayDetailPath,
  workdaySearchUrl,
  type WorkdayRow,
} from "../src/workday.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEED = JSON.parse(readFileSync(join(FIXTURES, "ats-workday-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "ats-workday-expected.json"), "utf8"));
const SEARCH = JSON.parse(readFileSync(join(FIXTURES, "ats-workday-search-expected.json"), "utf8"));
const HELPERS = JSON.parse(readFileSync(join(FIXTURES, "ats-workday-helpers-expected.json"), "utf8"));

const TARGET = { tenant: "jiostar", site: "JioStar", instance: "wd102" };

/** The stand-in board. Records the POST body so the page-size cap can be asserted. */
function fixtureFetch(bodies: string[] = []): typeof fetch {
  const body = JSON.stringify(FEED);
  return (async (url: unknown, init?: RequestInit) => {
    const href = String(url);
    const isDetail = href.includes("/wday/cxs/") && !href.endsWith("/jobs");
    if (isDetail && !href.includes("x_JR1")) {
      return { status: 404, ok: false, text: async () => "", json: async () => ({}) };
    }
    if (isDetail) {
      const detailBody = JSON.stringify({ jobPostingInfo: { title: "Engineer", jobDescription: "<p>Do things</p>", location: "Mumbai", postedOn: "2026-11-20" } });
      return { status: 200, ok: true, text: async () => detailBody, json: async () => JSON.parse(detailBody) };
    }
    const sent = init?.body ? JSON.parse(String(init.body)) : {};
    if (init?.body) bodies.push(String(init.body));
    const text = String(sent.searchText ?? "").toLowerCase();
    const filtered = text
      ? FEED.jobPostings.filter((p: any) => `${p.title ?? ""} ${p.locationsText ?? ""}`.toLowerCase().includes(text))
      : FEED.jobPostings;
    const start = Number(sent.offset ?? 0);
    const sliced = filtered.slice(start, start + (sent.limit ?? filtered.length));
    const body = JSON.stringify({ total: filtered.length, jobPostings: sliced });
    return { status: 200, ok: true, text: async () => body, json: async () => JSON.parse(body) };
  }) as unknown as typeof fetch;
}

function toEngineRow(row: WorkdayRow) {
  return {
    id: `workday:${row.tenant}:${row.ref}`,
    title: row.title,
    company: "JioStar",
    location: row.location,
    postedDate: row.date,
    url: row.url,
    portal: "workday",
    source: "adapter",
  };
}

test("the SDK produces the rows the engine connector produced", () => {
  const rows = mapWorkdayPostings("jiostar", FEED.jobPostings).map((r) => ({ ...r, company: "JioStar" }));
  expect(rows.map(toEngineRow)).toEqual(EXPECTED);
});

test("the SDK reproduces the pre-migration search, query for query", async () => {
  const provider = createWorkdayProvider({ ...TARGET, company: "JioStar", fetchImpl: fixtureFetch() });
  for (const [name, captured] of Object.entries(SEARCH) as Array<[string, any]>) {
    const page = await provider.search({ query: captured.query, limit: captured.limit });
    expect(page.rows.map(toEngineRow)).toEqual(captured.rows);
    expect(page.truncated).toBe(captured.truncated);
  }
});

test("the board's page never exceeds the size it accepts", async () => {
  const bodies: string[] = [];
  const provider = createWorkdayProvider({ ...TARGET, fetchImpl: fixtureFetch(bodies) });
  for (const limit of [0, 20, 50, 200]) {
    await provider.search({ limit });
  }
  const sent = bodies.map((b) => JSON.parse(b).limit);
  // The retired connector sent 50 for limit 0 and min(limit,50) otherwise;
  // the board answers 400 to anything above 20.
  expect(sent).toEqual([20, 20, 20, 20]);
  expect(WORKDAY_MAX_PAGE).toBe(20);
});

test("the date and detail-path helpers match the engine", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  expect(workdayDate("2026-11-20T00:00:00Z")).toBe(HELPERS.iso);
  expect(workdayDate("Posted 5 Days Ago", now)).toBe(HELPERS.relative);
  expect(workdayDate("soon")).toBe(HELPERS.bad);
  expect(workdayDetailPath(HELPERS.pathFromUrl, "JioStar")).toBe(HELPERS.pathFromUrl);
  expect(workdayDetailPath("/job/Some-Job_JR-1", "JioStar")).toBe(HELPERS.bare);
});

test("the detail response maps to the engine's shape", () => {
  const mapped = mapWorkdayDetail("jiostar", "wd102", "JioStar", "/job/x_JR1", {
    title: "Engineer",
    jobDescription: "<p>Do things</p>",
    location: "Mumbai",
    postedOn: "2026-11-20",
  });
  expect(mapped?.row.url).toBe("https://jiostar.wd102.myworkdayjobs.com/en-US/JioStar/job/x_JR1");
  expect(mapped?.row.date).toBe("2026-11-20");
  expect(mapped?.description).toBe("Do things");
  expect(mapWorkdayDetail("jiostar", "wd102", "JioStar", "/x", undefined)).toBeNull();
});

test("a posting with no data is still a row, with a fallback title", () => {
  const row = mapWorkdayPosting("jiostar", {});
  expect(row?.title).toBe("Untitled");
  expect(row?.date).toBeNull();
});

test("the search URL is the board's CXS endpoint", () => {
  expect(workdaySearchUrl(TARGET)).toBe(
    "https://jiostar.wd102.myworkdayjobs.com/wday/cxs/jiostar/JioStar/jobs",
  );
});

test("a 404 is a not-found failure", async () => {
  const missing = (async () => ({ status: 404, ok: false, text: async () => "", json: async () => ({}) })) as unknown as typeof fetch;
  const provider = createWorkdayProvider({ ...TARGET, fetchImpl: missing });
  try {
    await provider.detail("job/x");
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("not-found");
  }
});

contractSuite(createWorkdayProvider({ ...TARGET, company: "JioStar", fetchImpl: fixtureFetch() }), {
  fetchImpl: fixtureFetch(),
  knownRef: "job/x_JR1",
});
