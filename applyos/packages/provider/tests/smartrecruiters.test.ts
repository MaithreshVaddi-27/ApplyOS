// Phase 4.7, stage three — the SmartRecruiters ATS connector.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import {
  createSmartRecruitersProvider,
  mapSmartRecruitersJob,
  mapSmartRecruitersJobs,
  srListUrl,
  srSections,
  type SmartRecruitersRow,
} from "../src/smartrecruiters.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEED = JSON.parse(readFileSync(join(FIXTURES, "ats-smartrecruiters-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "ats-smartrecruiters-expected.json"), "utf8"));
const SEARCH = JSON.parse(readFileSync(join(FIXTURES, "ats-smartrecruiters-search-expected.json"), "utf8"));
const DETAIL = JSON.parse(readFileSync(join(FIXTURES, "ats-smartrecruiters-detail-expected.json"), "utf8"));

function fixtureFetch(): typeof fetch {
  const listBody = JSON.stringify(FEED);
  const detailBody = JSON.stringify(DETAIL.raw);
  return (async (url: unknown) => {
    const href = String(url);
    const isDetail = href.includes("/postings/") && !href.includes("?limit=");
    if (isDetail) {
      const ref = decodeURIComponent(href.slice(href.lastIndexOf("/") + 1));
      if (ref !== DETAIL.id) {
        return { status: 404, ok: false, text: async () => "", json: async () => ({}) };
      }
    }
    const body = isDetail ? detailBody : listBody;
    return { status: 200, ok: true, text: async () => body, json: async () => JSON.parse(body) };
  }) as unknown as typeof fetch;
}

function toEngineRow(row: SmartRecruitersRow) {
  return {
    id: `smartrecruiters:Freshworks:${row.id}`,
    title: row.title,
    company: "Freshworks",
    location: row.location,
    postedDate: row.date ? row.date.slice(0, 10) : null,
    url: row.url,
    portal: "smartrecruiters",
    source: "adapter",
  };
}

test("the SDK produces the rows the engine connector produced", () => {
  const rows = mapSmartRecruitersJobs("Freshworks", FEED.content).map((r) => ({ ...r, company: "Freshworks" }));
  expect(rows.map(toEngineRow)).toEqual(EXPECTED);
});

test("the SDK reproduces the pre-migration search, query for query", async () => {
  const provider = createSmartRecruitersProvider({ slug: "Freshworks", company: "Freshworks", fetchImpl: fixtureFetch() });
  for (const [name, captured] of Object.entries(SEARCH) as Array<[string, any]>) {
    const page = await provider.search({
      query: captured.query,
      limit: captured.limit,
      extra: { maxPages: captured.maxPages },
    });
    expect(page.rows.map(toEngineRow)).toEqual(captured.rows);
    expect(page.truncated).toBe(captured.truncated);
  }
});

test("a posting with no id is not a posting", () => {
  expect(mapSmartRecruitersJob("Freshworks", {} as any)).toBeNull();
  expect(mapSmartRecruitersJob("Freshworks", { id: "1", name: "R" })?.title).toBe("R");
});

test("the id and url come from the API slug, not the display name", () => {
  const row = mapSmartRecruitersJob("Freshworks", { id: "42", name: "Engineer" });
  expect(row?.id).toBe("42");
  expect(row?.url).toBe("https://jobs.smartrecruiters.com/Freshworks/42");
});

test("sections ship as an object on this tenant and are assembled defensively", () => {
  expect(DETAIL.sectionsShape ?? typeof DETAIL.raw.jobAd.sections).toBe("object");
  expect(srSections(DETAIL.raw.jobAd)).toBe(DETAIL.description);
  expect(srSections({ sections: [{ title: "A", text: "<p>B</p>" }] })).toBe("A\nB");
});

test("the detail lookup reproduces the engine's body exactly", async () => {
  const provider = createSmartRecruitersProvider({ slug: "Freshworks", company: "Freshworks", fetchImpl: fixtureFetch() });
  const detail = await provider.detail(DETAIL.id);
  expect(detail.description).toBe(DETAIL.description);
  expect(detail.title).toBe(DETAIL.raw.name);
});

test("the listing URL is paged by offset", () => {
  expect(srListUrl("Freshworks", 0)).toBe("https://api.smartrecruiters.com/v1/companies/Freshworks/postings?limit=50&offset=0");
  expect(srListUrl("Freshworks", 50)).toContain("offset=50");
});

test("a 404 is a not-found failure", async () => {
  const missing = (async () => ({ status: 404, ok: false, text: async () => "", json: async () => ({}) })) as unknown as typeof fetch;
  const provider = createSmartRecruitersProvider({ slug: "Freshworks", fetchImpl: missing });
  try {
    await provider.detail("x");
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("not-found");
  }
});

contractSuite(
  createSmartRecruitersProvider({ slug: "Freshworks", company: "Freshworks", fetchImpl: fixtureFetch() }),
  { fetchImpl: fixtureFetch(), knownRef: DETAIL.id },
);
