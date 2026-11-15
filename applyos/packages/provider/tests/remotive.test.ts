// Phase 4 (docs/PROJECT_BLUEPRINT.md) — the Remotive provider.
//
// The important test here is the PARITY one: the SDK must produce exactly the
// rows the remotive CLI produced before the migration, on the same fixture.
// That fixture was captured from the CLI's own implementation, so this is a
// proof that the migration changed nothing a reader can see.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import {
  createRemotiveProvider,
  extractRemotiveId,
  fetchRemotiveJobs,
  filterRemotive,
  mapRemotive,
  matchRemotiveJob,
  type RemotiveRow,
} from "../src/remotive.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEED = JSON.parse(readFileSync(join(FIXTURES, "remotive-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "remotive-expected.json"), "utf8"));
const SEARCH_EXPECTED = JSON.parse(
  readFileSync(join(FIXTURES, "remotive-search-expected.json"), "utf8"),
);

/** One row as the pre-migration CLI's search envelope carried it. */
interface CapturedRow {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  date: string | null;
  url: string;
  salary: string | null;
  category: string | null;
  jobType: string | null;
  tags: string[];
}

/** The fixture, as the network. */
function fixtureFetch(): typeof fetch {
  return (async () => {
    const body = JSON.stringify(FEED);
    return {
      status: 200,
      ok: true,
      text: async () => body,
      json: async () => JSON.parse(body),
    };
  }) as unknown as typeof fetch;
}

// --- parity -------------------------------------------------------------

test("the SDK produces the same rows the CLI produced before the migration", async () => {
  const rows = await fetchRemotiveJobs({ fetchImpl: fixtureFetch() });
  expect(rows.length).toBe(EXPECTED.length);

  for (const [i, expected] of EXPECTED.entries()) {
    const actual = rows[i];
    expect(actual.id).toBe(expected.id);
    expect(actual.title).toBe(expected.title);
    expect(actual.url).toBe(expected.url);
    expect(actual.date).toBe(expected.date);
    expect(actual.salary).toBe(expected.salary);
    expect(actual.category).toBe(expected.category);
    expect(actual.jobType).toBe(expected.jobType);
    expect(actual.tags).toEqual(expected.tags);
    expect(actual.description).toBe(expected.description);
  }
});

test("an absent location is null, not an empty string", () => {
  // No live row lacks a location, so this is asserted on a synthetic one.
  const mapped = mapRemotive([
    { id: 1, title: "Real Role", company_name: "A", url: "u1" },
  ]);
  expect(mapped[0].location).toBeNull();
});

test("every row that had a location keeps exactly that location", async () => {
  const rows = await fetchRemotiveJobs({ fetchImpl: fixtureFetch() });
  for (const expected of EXPECTED.filter((e: { location: string }) => e.location !== "")) {
    const actual = rows.find((j) => j.id === expected.id);
    expect(actual?.location).toBe(expected.location);
  }
});

// --- the feed's shape ----------------------------------------------------

test("a row without a title is dropped", () => {
  const mapped = mapRemotive([
    { id: 1, title: "Real Role", company_name: "A", url: "u1" },
    { id: 2, title: "", company_name: "A", url: "u2" },
  ]);
  expect(mapped.length).toBe(1);
  expect(mapped[0].title).toBe("Real Role");
});

test("a row without an id is dropped", () => {
  const mapped = mapRemotive([
    { id: "", title: "No Id", company_name: "A", url: "u1" },
  ]);
  expect(mapped.length).toBe(0);
});

test("a missing url falls back to the board's own url shape", () => {
  const mapped = mapRemotive([{ id: 7, title: "Role", company_name: "A" }]);
  expect(mapped[0].url).toBe("https://remotive.com/remote-jobs/7");
});

test("html entities in the title and company are decoded", () => {
  const mapped = mapRemotive([
    { id: 1, title: "Dev &amp; Ops", company_name: "Acme &lt;Ltd&gt;", url: "u1" },
  ]);
  expect(mapped[0].title).toBe("Dev & Ops");
  expect(mapped[0].company).toBe("Acme <Ltd>");
});

test("a feed without a jobs array is a parse failure, not an empty board", async () => {
  const broken = (async () => ({
    status: 200,
    ok: true,
    text: async () => "{}",
    json: async () => ({}),
  })) as unknown as typeof fetch;
  try {
    await fetchRemotiveJobs({ fetchImpl: broken });
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("parse");
  }
});

// --- filters -------------------------------------------------------------

const all: RemotiveRow[] = [
  {
    id: "1",
    title: "Backend Engineer",
    company: "Acme",
    location: "Bengaluru",
    date: "2026-10-01",
    url: "u1",
    salary: null,
    category: "Software-dev",
    jobType: "full-time",
    tags: ["python"],
  },
  {
    id: "2",
    title: "Frontend Engineer",
    company: "Globex",
    location: "Remote",
    date: "2026-10-02",
    url: "u2",
    salary: null,
    category: "Software-dev",
    jobType: "full-time",
    tags: ["react"],
  },
  {
    id: "3",
    title: "Data Analyst",
    company: "Initech",
    location: null,
    date: "2026-10-03",
    url: "u3",
    salary: null,
    category: "Data",
    jobType: "contract",
    tags: ["python", "sql"],
  },
];

test("a query matches anywhere in the fields the board shows", () => {
  expect(filterRemotive(all, { query: "engineer" }).map((j) => j.id)).toEqual(["1", "2"]);
  expect(filterRemotive(all, { query: "python" }).map((j) => j.id)).toEqual(["1", "3"]);
  expect(filterRemotive(all, { query: "nothing" }).length).toBe(0);
});

test("a query is the whole phrase, not a list of words", () => {
  // The board matches the phrase; matching word-by-word would find postings
  // the board does not consider a match.
  expect(filterRemotive(all, { query: "backend engineer" }).map((j) => j.id)).toEqual(["1"]);
});

test("a location filter drops a posting the board did not place", () => {
  expect(filterRemotive(all, { location: "bengaluru" }).map((j) => j.id)).toEqual(["1"]);
});

test("a category filter ignores hyphens and spaces", () => {
  expect(filterRemotive(all, { extra: { category: "software-dev" } }).length).toBe(2);
  expect(filterRemotive(all, { extra: { category: "software dev" } }).length).toBe(2);
  expect(filterRemotive(all, { extra: { category: "data" } }).map((j) => j.id)).toEqual(["3"]);
});

test("a tag filter matches a tag substring", () => {
  expect(filterRemotive(all, { tag: "pyth" }).map((j) => j.id)).toEqual(["1", "3"]);
  expect(filterRemotive(all, { tag: "react" }).map((j) => j.id)).toEqual(["2"]);
});

test("an age filter keeps postings with no date", () => {
  const undated: RemotiveRow[] = [
    { ...all[0], id: "9", date: null },
  ];
  expect(filterRemotive(undated, { jobAgeDays: 1 }).length).toBe(1);
});

test("a salary filter keeps postings with no salary stated", () => {
  const withSalary: RemotiveRow[] = [
    { ...all[0], id: "1", salary: "$100,000 / year" },
    { ...all[0], id: "2", salary: "$20,000 / year" },
    { ...all[0], id: "3", salary: null },
  ];
  expect(filterRemotive(withSalary, { salaryMin: 50_000 }).map((j) => j.id)).toEqual(["1", "3"]);
});

// --- detail matching -----------------------------------------------------

test("an id matches exactly", () => {
  expect(matchRemotiveJob(all, "1", "1")?.id).toBe("1");
});

test("a mid-token numeric substring does not match", () => {
  const jobs: RemotiveRow[] = [
    { ...all[0], id: "1234", url: "https://remotive.com/remote-jobs/1234-dev" },
  ];
  expect(matchRemotiveJob(jobs, "234", "234")).toBeUndefined();
});

test("a dash-anchored url tail matches when exactly one posting carries it", () => {
  const jobs: RemotiveRow[] = [
    { ...all[0], id: "aaa", url: "https://remotive.com/remote-jobs/foo-777" },
    { ...all[1], id: "bbb", url: "https://remotive.com/remote-jobs/bar-888" },
  ];
  expect(matchRemotiveJob(jobs, "777", "777")?.id).toBe("aaa");
});

test("an ambiguous url tail matches nothing", () => {
  const jobs: RemotiveRow[] = [
    { ...all[0], id: "aaa", url: "https://remotive.com/remote-jobs/foo-777" },
    { ...all[1], id: "bbb", url: "https://remotive.com/remote-jobs/bar-777" },
  ];
  expect(matchRemotiveJob(jobs, "777", "777")).toBeUndefined();
});

test("the numeric id is extracted from a url", () => {
  expect(extractRemotiveId("https://remotive.com/remote-jobs/a-role-5123")).toBe("5123");
  expect(extractRemotiveId("5123")).toBe("5123");
});

// --- the limit contract --------------------------------------------------

test("an undefined limit takes the default page size", async () => {
  const provider = createRemotiveProvider({ fetchImpl: fixtureFetch() });
  const page = await provider.search({});
  expect(page.rows.length).toBe(16);
});

test("a limit of 0 means no cap", async () => {
  const provider = createRemotiveProvider({ fetchImpl: fixtureFetch() });
  const page = await provider.search({ limit: 0 });
  expect(page.rows.length).toBe(16);
  expect(page.truncated).toBe(false);
});

test("a limit caps the page and flags truncation", async () => {
  const provider = createRemotiveProvider({ fetchImpl: fixtureFetch() });
  const page = await provider.search({ limit: 2 });
  expect(page.rows.length).toBe(2);
  expect(page.total).toBe(16);
  expect(page.truncated).toBe(true);
});

// --- the surface parity oracle -------------------------------------------

/**
 * The whole envelope, captured from the pre-migration CLI's own search
 * command running against the same fixed feed.
 *
 * The row-level fixture above proves the parsing is unchanged. This one
 * proves the filters and the paging are unchanged too - which is the part
 * that is easy to get wrong, because the board ignores its query parameters
 * and every filter is applied client-side.
 */
test("the SDK's search reproduces the pre-migration CLI's search, query for query", async () => {
  const provider = createRemotiveProvider({ fetchImpl: fixtureFetch() });
  const captures = Object.entries(SEARCH_EXPECTED) as Array<[string, any]>;

  for (const [name, captured] of captures) {
    const opts = captured.opts as Record<string, unknown>;
    const page = await provider.search({
      query: opts.query as string | undefined,
      location: opts.location as string | undefined,
      tag: opts.tag as string | undefined,
      jobAgeDays: opts.jobage as number | undefined,
      page: opts.page as number | undefined,
      limit: opts.limit as number | undefined,
      extra: { category: opts.category as string | undefined },
    });

    // The CLI's envelope carries the page's rows and its count; the SDK's
    // page carries the rows, the total and the truncation flag.
    const expectedRows = captured.stdout.results as CapturedRow[];
    expect(page.rows.length).toBe(expectedRows.length);

    for (const [i, expected] of expectedRows.entries()) {
      const actual = page.rows[i];
      expect(actual.id).toBe(expected.id);
      expect(actual.title).toBe(expected.title);
      expect(actual.url).toBe(expected.url);
      expect(actual.date).toBe(expected.date);
      expect(actual.salary).toBe(expected.salary);
      expect(actual.category).toBe(expected.category);
      expect(actual.jobType).toBe(expected.jobType);
      expect(actual.tags).toEqual(expected.tags);
      // The one deliberate difference: an absent location is null.
      expect(actual.location).toBe(expected.location === "" ? null : expected.location);
    }
  }
});

// --- the contract --------------------------------------------------------

contractSuite(createRemotiveProvider({ fetchImpl: fixtureFetch() }), {
  fetchImpl: fixtureFetch(),
  knownRef: "1680495",
  expectedRows: 16,
});
