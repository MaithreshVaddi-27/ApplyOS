// Phase 4 (docs/PROJECT_BLUEPRINT.md) — the We Work Remotely provider.
//
// The important tests here are the PARITY ones: the SDK must produce exactly
// the rows, the envelope and the feed the weworkremotely CLI produced before
// the migration, on the same fixture. Those fixtures were captured from the
// CLI's own implementation, so this is a proof that the migration changed
// nothing a reader can see.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import {
  WWR_CATEGORY_FEEDS,
  WWR_MAIN_FEED,
  createWwrProvider,
  extractWwrId,
  filterWwr,
  findWwrJob,
  parseWwrJob,
  parseWwrRss,
  stripWwrHtml,
  wwrFeedFor,
  wwrId,
  wwrLocation,
  wwrProvider,
  wwrTags,
  type WwrRawItem,
  type WwrRow,
} from "../src/weworkremotely.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEEDS: Record<string, string> = JSON.parse(readFileSync(join(FIXTURES, "wwr-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "wwr-expected.json"), "utf8"));
const SEARCH_EXPECTED = JSON.parse(
  readFileSync(join(FIXTURES, "wwr-search-expected.json"), "utf8"),
);
const DETAIL_EXPECTED = JSON.parse(
  readFileSync(join(FIXTURES, "wwr-detail-expected.json"), "utf8"),
);

/** One row as the pre-migration CLI's search envelope carried it. */
interface CapturedRow {
  id: string;
  title: string;
  company: string;
  location: string;
  date: string;
  url: string;
  salary: string | null;
  category?: string;
  jobType?: string;
  tags: string[];
}

/**
 * The stand-in board.
 *
 * The feed is not searchable, so the stand-in serves the captured bodies and
 * the CLI's client-side filters do the rest - exactly as they do against the
 * live board. A feed it does not hold answers 404, which the lookup sweep
 * tolerates.
 */
function fixtureFetch(): typeof fetch {
  return (async (url: unknown) => {
    const href = String(url);
    const body = FEEDS[href];
    if (body === undefined) {
      return { status: 404, ok: false, text: async () => "", json: async () => ({}) };
    }
    return { status: 200, ok: true, text: async () => body, json: async () => ({}) };
  }) as unknown as typeof fetch;
}

/** The request the pre-migration CLI turned each query into. */
function requestFromCaptured(opts: Record<string, any>): any {
  return {
    query: opts.query,
    location: opts.location,
    jobAgeDays: opts.jobage,
    page: opts.page,
    limit: opts.limit,
    extra: { category: opts.category, tag: opts.tag },
  };
}

// --- parity: the mapped rows ---------------------------------------------

test("the SDK produces the same rows the CLI produced before the migration", async () => {
  const provider = createWwrProvider({ fetchImpl: fixtureFetch() });
  const page = await provider.search({ limit: 20 });
  expect(page.rows.length).toBe(EXPECTED.length);

  for (const [i, expected] of EXPECTED.entries()) {
    const actual = page.rows[i];
    expect(actual.id).toBe(expected.id);
    expect(actual.title).toBe(expected.title);
    expect(actual.company).toBe(expected.company);
    expect(actual.location).toBe(expected.location);
    expect(actual.date).toBe(expected.date);
    expect(actual.url).toBe(expected.url);
    expect(actual.salary).toBe(expected.salary);
    expect(actual.category).toBe(expected.category ?? null);
    expect(actual.jobType).toBe(expected.jobType ?? null);
    expect(actual.tags).toEqual(expected.tags);
  }
});

// --- parity: the whole envelope, and the feed -----------------------------

test("the SDK reproduces the pre-migration CLI's search, query for query", async () => {
  const provider = createWwrProvider({ fetchImpl: fixtureFetch() });
  const captures = Object.entries(SEARCH_EXPECTED) as Array<[string, any]>;

  for (const [name, captured] of captures) {
    const opts = captured.opts as Record<string, any>;
    const req = requestFromCaptured(opts);

    // The feed the CLI fetched must be the one the SDK fetches.
    const expectedUrl = captured.urls[0] as string;
    expect(wwrFeedFor(req)).toBe(expectedUrl);

    const page = await provider.search(req);
    const expectedRows = captured.stdout.results as CapturedRow[];
    expect(page.rows.length).toBe(expectedRows.length);
    expect(page.page).toBe(captured.stdout.meta.page);

    for (const [i, expected] of expectedRows.entries()) {
      const actual = page.rows[i];
      expect(actual.id).toBe(expected.id);
      expect(actual.title).toBe(expected.title);
      expect(actual.company).toBe(expected.company);
      expect(actual.location).toBe(expected.location);
      expect(actual.date).toBe(expected.date);
      expect(actual.url).toBe(expected.url);
      expect(actual.category).toBe(expected.category ?? null);
      expect(actual.jobType).toBe(expected.jobType ?? null);
      expect(actual.tags).toEqual(expected.tags);
    }
  }
});

// --- parity: the lookup ---------------------------------------------------

test("the SDK finds the same posting by id and by url", async () => {
  const provider = createWwrProvider({ fetchImpl: fixtureFetch() });

  for (const key of ["byId", "byUrl"] as const) {
    const captured = DETAIL_EXPECTED[key];
    const detail = await provider.detail(captured.input);
    const expected = captured.stdout;
    expect(detail.id).toBe(expected.id);
    expect(detail.url).toBe(expected.url);
    expect(detail.title).toBe(expected.title);
    expect(detail.company).toBe(expected.company);
    expect(detail.location).toBe(expected.location);
    expect(detail.tags).toEqual(expected.tags);
    expect(detail.description).toBe(expected.description);
  }
});

test("a posting that is not there is a not-found error", async () => {
  const provider = createWwrProvider({ fetchImpl: fixtureFetch() });
  const captured = DETAIL_EXPECTED.missing;
  try {
    await provider.detail(captured.input);
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("not-found");
  }
});

// --- the board's own rules -----------------------------------------------

test("the employer comes from the title when the feed carries no author", () => {
  // The live feed carries no dc:creator and no author, and writes the
  // employer into the title. Both the CLI and the engine recover it.
  const row = parseWwrJob({ title: "Gusto, Inc.: Software Engineer", link: "https://weworkremotely.com/remote-jobs/gusto-inc-software-engineer" });
  expect(row?.company).toBe("Gusto, Inc.");
  expect(row?.title).toBe("Software Engineer");

  // An author field wins when the board carries one.
  const withAuthor = parseWwrJob({
    title: "Backend Dev",
    company: "Acme",
    link: "https://weworkremotely.com/remote-jobs/backend-dev",
  });
  expect(withAuthor?.company).toBe("Acme");

  // A title with no colon has no employer to recover.
  const noColon = parseWwrJob({ title: "Backend Dev", link: "https://weworkremotely.com/remote-jobs/backend-dev" });
  expect(noColon?.company).toBeNull();
  expect(noColon?.title).toBe("Backend Dev");
});

test("the id is the slug from the url, not the url", () => {
  expect(wwrId("https://weworkremotely.com/remote-jobs/backend-dev-xyz1")).toBe("backend-dev-xyz1");
  expect(extractWwrId("https://weworkremotely.com/remote-jobs/backend-dev-xyz1")).toBe("backend-dev-xyz1");
  expect(extractWwrId("backend-dev-xyz1")).toBe("backend-dev-xyz1");
});

test("the place is built from the three tags the board carries", () => {
  expect(wwrLocation({ region: "Anywhere in the World", country: "USA" })).toBe("USA");
  expect(wwrLocation({ region: "Europe", country: "Germany", state: "Berlin" })).toBe(
    "Europe (Germany), Berlin",
  );
  expect(wwrLocation({})).toBe("");
});

test("the skills are split and de-duplicated", () => {
  expect(wwrTags({ skills: "react and node, react" })).toEqual(["react", "node"]);
  expect(wwrTags({})).toEqual([]);
});

test("a posting with no title or no link is not a posting", () => {
  expect(parseWwrJob({ link: "https://weworkremotely.com/remote-jobs/x" })).toBeNull();
  expect(parseWwrJob({ title: "R" })).toBeNull();
});

test("the board's own html rule keeps its shape", () => {
  // Decode runs AFTER the tag strip: an encoded tag is literal text.
  expect(stripWwrHtml("&lt;script&gt;alert(1)&lt;/script&gt;")).toBe("<script>alert(1)</script>");
  expect(stripWwrHtml("fish &amp;amp; chips")).toBe("fish &amp; chips");
});

test("the feed catalogue is the one the CLI has always accepted", () => {
  expect(WWR_CATEGORY_FEEDS["full-stack"]).toBe(
    "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
  );
  expect(wwrFeedFor({})).toBe(WWR_MAIN_FEED);
  expect(wwrFeedFor({ extra: { category: "DevOps" } })).toBe(
    "https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss",
  );
  // An explicit feed wins, which is how the engine names its own set.
  expect(wwrFeedFor({ extra: { feed: "https://example.com/feed.rss" } })).toBe(
    "https://example.com/feed.rss",
  );
  // A category the board does not have falls back to the main feed.
  expect(wwrFeedFor({ extra: { category: "data-science" } })).toBe(WWR_MAIN_FEED);
});

// --- the client-side filters ----------------------------------------------

test("a query can match the tags, the description or the category", () => {
  const row = (over: Partial<WwrRow>): WwrRow => ({
    id: "x",
    title: "Backend Dev",
    company: "Acme",
    location: "Anywhere in the World",
    date: "2026-11-20T00:00:00.000Z",
    url: "https://weworkremotely.com/remote-jobs/x",
    guid: null,
    category: null,
    jobType: null,
    tags: [],
    description: null,
    ...over,
  });
  const rows = [
    row({ id: "title", title: "Python Backend" }),
    row({ id: "company", company: "Pythonistas" }),
    row({ id: "tag", tags: ["python"] }),
    row({ id: "desc", description: "we write python" }),
    row({ id: "cat", category: "Python" }),
    row({ id: "none", title: "Java Dev" }),
  ];
  expect(filterWwr(rows, { query: "python" }, new Date()).map((r) => r.id)).toEqual([
    "title",
    "company",
    "tag",
    "desc",
    "cat",
  ]);
});

test("the age filter keeps a posting inside the window and drops one outside", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const row = (date: string | null): WwrRow => ({
    id: date ?? "undated",
    title: "R",
    company: "A",
    location: null,
    date,
    url: "https://weworkremotely.com/remote-jobs/x",
    guid: null,
    category: null,
    jobType: null,
    tags: [],
    description: null,
  });
  const rows = [row("2026-11-21T00:00:00.000Z"), row("2026-11-10T00:00:00.000Z"), row(null)];

  const week = filterWwr(rows, { jobAgeDays: 7 }, now);
  expect(week.map((r) => r.id)).toEqual(["2026-11-21T00:00:00.000Z", "undated"]);

  const month = filterWwr(rows, { jobAgeDays: 30 }, now);
  expect(month).toHaveLength(3);
});

// --- the lookup's exact-match rule ----------------------------------------

test("the lookup is exact, with one dash-anchored fallback", () => {
  const row = (over: Partial<WwrRow>): WwrRow => ({
    id: "backend-dev-xyz1",
    title: "Backend Dev",
    company: "Acme",
    location: "Worldwide",
    date: "2026-10-01T00:00:00.000Z",
    url: "https://weworkremotely.com/remote-jobs/backend-dev-xyz1",
    guid: null,
    category: null,
    jobType: null,
    tags: [],
    description: null,
    ...over,
  });
  expect(findWwrJob([row({ id: "Backend-Dev-XYZ1" })], "backend-dev-xyz1", "backend-dev-xyz1")?.id).toBe(
    "Backend-Dev-XYZ1",
  );
  expect(findWwrJob([row({})], "dev", "dev")).toBeUndefined();
  expect(
    findWwrJob(
      [row({ id: "a1", url: "https://weworkremotely.com/remote-jobs/frontend-aaa111" }), row({ id: "b2", url: "https://weworkremotely.com/remote-jobs/backend-bbb222" })],
      "bbb222",
      "bbb222",
    )?.id,
  ).toBe("b2");
});

// --- failures -------------------------------------------------------------

test("a feed that is not there is an http failure", async () => {
  const missing = (async () => ({
    status: 404,
    ok: false,
    text: async () => "",
    json: async () => ({}),
  })) as unknown as typeof fetch;
  const provider = createWwrProvider({ fetchImpl: missing });
  try {
    await provider.search({});
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("http");
  }
});

test("a connection failure is a network failure that names the feed", async () => {
  // One attempt: the point of this test is the code and the message, and the
  // retry budget is the CLI's own concern (its suite pins it).
  const refusing = (async () => {
    throw new Error("connection refused");
  }) as unknown as typeof fetch;
  const provider = createWwrProvider({ fetchImpl: refusing, attempts: 1 });
  try {
    await provider.search({});
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("network");
    expect((e as ProviderError).message).toContain("weworkremotely.com");
  }
});

// --- the contract ---------------------------------------------------------

contractSuite(createWwrProvider({ fetchImpl: fixtureFetch() }), {
  fetchImpl: fixtureFetch(),
  knownRef: "oportun-senior-director-of-product-management-r14361",
});
