// Phase 4 (docs/PROJECT_BLUEPRINT.md) — the RemoteOK provider.
//
// The important test here is the PARITY one: the SDK must produce exactly the
// rows the remoteok CLI produced before the migration, on the same fixture.
// That fixture was captured from the CLI's own implementation, so this is a
// proof that the migration changed nothing a reader can see.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import {
  fetchRemoteOkJobs,
  filterRemoteOk,
  mapRemoteOk,
  matchRemoteOkJob,
  extractRemoteOkId,
  createRemoteOkProvider,
  remoteOkProvider,
  type RemoteOkJob,
} from "../src/remoteok.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEED = JSON.parse(readFileSync(join(FIXTURES, "remoteok-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "remoteok-expected.json"), "utf8"));

/**
 * The fixture, as the network.
 *
 * It models a real board: the API answers with the feed, and a listing page
 * that does not exist answers 404. Without that second behaviour the
 * detail-fallback path would read the feed's JSON as if it were a page and
 * report a parse failure where a real board would report "not found".
 */
function fixtureFetch(): typeof fetch {
  return (async (url: unknown) => {
    const href = String(url);
    if (!href.includes("/api")) {
      return {
        status: 404,
        ok: false,
        text: async () => "not found",
        json: async () => ({}),
      };
    }
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
  const jobs = await fetchRemoteOkJobs({ fetchImpl: fixtureFetch() });
  expect(jobs.length).toBe(EXPECTED.length);

  for (const [i, expected] of EXPECTED.entries()) {
    const actual = jobs[i];
    expect(actual.id).toBe(expected.id);
    expect(actual.title).toBe(expected.title);
    expect(actual.company).toBe(expected.company);
    expect(actual.url).toBe(expected.url);
    expect(actual.date).toBe(expected.date);
    expect(actual.salary).toBe(expected.salary);
    expect(actual.tags).toEqual(expected.tags);
    expect(actual.description).toBe(expected.description);
    expect(actual.applyUrl).toBe(expected.applyUrl);
  }
});

test("the one deliberate difference: an absent location is null, not an empty string", async () => {
  const jobs = await fetchRemoteOkJobs({ fetchImpl: fixtureFetch() });
  const expectedEmpty = EXPECTED.filter((e: { location: string }) => e.location === "");
  expect(expectedEmpty.length).toBeGreaterThan(0);

  for (const expected of expectedEmpty) {
    const actual = jobs.find((j) => j.id === expected.id);
    expect(actual?.location).toBeNull();
  }
});

test("every row that had a location keeps exactly that location", async () => {
  const jobs = await fetchRemoteOkJobs({ fetchImpl: fixtureFetch() });
  for (const expected of EXPECTED.filter((e: { location: string }) => e.location !== "")) {
    const actual = jobs.find((j) => j.id === expected.id);
    expect(actual?.location).toBe(expected.location);
  }
});

// --- the feed's shape ----------------------------------------------------

test("the legal-notice row is not a posting", async () => {
  const jobs = await fetchRemoteOkJobs({ fetchImpl: fixtureFetch() });
  // The feed's first row is legal metadata, not a posting.
  expect(FEED[0].legal).toBeTruthy();
  expect(FEED[0].position).toBeUndefined();
  for (const job of jobs) {
    expect(job.title.length).toBeGreaterThan(0);
  }
});

test("a row without a position is dropped", () => {
  const mapped = mapRemoteOk([
    { id: 1, position: "Real Role", url: "https://remoteok.com/remote-jobs/a-role-1" },
    { id: 2, url: "https://remoteok.com/remote-jobs/b-2" },
    { id: 3, position: "", url: "https://remoteok.com/remote-jobs/c-3" },
  ]);
  expect(mapped.length).toBe(1);
  expect(mapped[0].title).toBe("Real Role");
});

test("a row with no usable url is dropped rather than given a guessed one", () => {
  // The board states neither a url nor a slug, so there is no url we can
  // stand behind. A url built from the id alone would be a guess.
  const mapped = mapRemoteOk([
    { id: 1, position: "Real Role" },
    { id: 2, position: "Also Real", slug: "a-slug-2" },
  ]);
  expect(mapped.length).toBe(1);
  expect(mapped[0].url).toBe("https://remoteok.com/remote-jobs/a-slug-2");
});

test("a url that is not a string is never cast into the url field", () => {
  const mapped = mapRemoteOk([
    { id: 1, position: "Real Role", url: 12345 as unknown as string },
  ]);
  expect(mapped.length).toBe(0);
});

test("a row without an id is dropped", () => {
  expect(mapRemoteOk([{ position: "No Id" }])).toEqual([]);
});

test("a slug without a url falls back to the slug path", () => {
  const mapped = mapRemoteOk([{ id: 7, position: "Role", slug: "a-role-7" }]);
  expect(mapped[0].url).toBe("https://remoteok.com/remote-jobs/a-role-7");
});

test("the board's own url casing is preserved", () => {
  const mapped = mapRemoteOk([{ id: 8, position: "Role", url: "https://remoteOK.com/remote-jobs/x-8" }]);
  expect(mapped[0].url).toBe("https://remoteOK.com/remote-jobs/x-8");
});

// --- filters -------------------------------------------------------------

/** A row, with the fields a real feed always carries. */
function job(over: Partial<RemoteOkJob>): RemoteOkJob {
  return {
    id: "1",
    slug: "",
    title: "Backend Engineer",
    company: "Acme",
    location: null,
    date: null,
    url: "u1",
    ...over,
  };
}

const all: RemoteOkJob[] = [
  job({ id: "1", title: "Backend Engineer", company: "Acme", location: "Bengaluru", date: "2026-10-01", url: "u1", tags: ["python"] }),
  job({ id: "2", title: "Frontend Engineer", company: "Globex", location: "Remote", date: "2026-10-02", url: "u2", tags: ["react"] }),
  job({ id: "3", title: "Data Analyst", company: "Initech", location: null, date: "2026-10-03", url: "u3", tags: ["python", "sql"] }),
];

test("every query word must appear", () => {
  expect(filterRemoteOk(all, { query: "engineer" }).length).toBe(2);
  expect(filterRemoteOk(all, { query: "engineer python" }).length).toBe(1);
  expect(filterRemoteOk(all, { query: "nothing" }).length).toBe(0);
});

test("a tag filter matches a tag substring", () => {
  expect(filterRemoteOk(all, { tag: "pyth" }).length).toBe(2);
  expect(filterRemoteOk(all, { tag: "react" }).length).toBe(1);
});

test("a location filter keeps worldwide and unlocated postings", () => {
  // A posting the board did not narrow (no location at all) is kept for any
  // location filter - it was never restricted.
  expect(filterRemoteOk(all, { location: "Bengaluru" }).map((j) => j.id)).toEqual(["1", "3"]);
  expect(filterRemoteOk(all, { location: "remote" }).length).toBe(3);
});

test("a salary filter keeps postings with no salary stated", () => {
  const withSalary: RemoteOkJob[] = [
    job({ id: "1", title: "A", company: "B", url: "u1", salary: "$100,000 / year" }),
    job({ id: "2", title: "A", company: "B", url: "u2", salary: "$20,000 / year" }),
    job({ id: "3", title: "A", company: "B", url: "u3" }),
  ];
  expect(filterRemoteOk(withSalary, { salaryMin: 50_000 }).map((j) => j.id)).toEqual(["1", "3"]);
});

test("an age filter keeps postings with no date", () => {
  const undated: RemoteOkJob[] = [job({ id: "1", title: "A", company: "B", url: "u1" })];
  expect(filterRemoteOk(undated, { jobAgeDays: 1 }).length).toBe(1);
});

// --- detail matching -----------------------------------------------------

test("an id matches exactly", () => {
  expect(matchRemoteOkJob(all, "1", "1")?.id).toBe("1");
});

test("a mid-token numeric substring does not match", () => {
  // The old fallback turned a search for "123" into the "...-dev-5123"
  // posting. Only a dash-anchored url tail may match.
  const jobs: RemoteOkJob[] = [
    job({ id: "5123", title: "A", company: "B", url: "https://remoteok.com/remote-jobs/dev-5123" }),
  ];
  expect(matchRemoteOkJob(jobs, "123", "123")).toBeUndefined();
});

test("a dash-anchored url tail matches when exactly one posting carries it", () => {
  // The fallback matches a url that ENDS with "-<id>". It is not a
  // mid-token substring match - ".../dev-5123" does not match "123".
  const jobs: RemoteOkJob[] = [
    job({ id: "5123", title: "A", company: "B", url: "https://remoteok.com/remote-jobs/x-123" }),
  ];
  expect(matchRemoteOkJob(jobs, "123", "123")?.id).toBe("5123");
});

test("a url tail that only matches mid-token does not match", () => {
  const jobs: RemoteOkJob[] = [
    job({ id: "5123", title: "A", company: "B", url: "https://remoteok.com/remote-jobs/dev-5123" }),
  ];
  expect(matchRemoteOkJob(jobs, "123", "123")).toBeUndefined();
});

test("an ambiguous url tail matches nothing", () => {
  const jobs: RemoteOkJob[] = [
    job({ id: "5123", title: "A", company: "B", url: "https://remoteok.com/remote-jobs/dev-5123" }),
    job({ id: "6123", title: "A", company: "B", url: "https://remoteok.com/remote-jobs/x-6123" }),
  ];
  expect(matchRemoteOkJob(jobs, "123", "123")).toBeUndefined();
});

test("the numeric id is extracted from a url", () => {
  expect(extractRemoteOkId("https://remoteok.com/remote-jobs/a-role-5123")).toBe("5123");
  expect(extractRemoteOkId("5123")).toBe("5123");
});

// --- the limit contract ---------------------------------------------------

test("an undefined limit takes the default page size", async () => {
  const provider = createRemoteOkProvider({ fetchImpl: fixtureFetch() });
  const page = await provider.search({});
  expect(page.rows.length).toBe(4);
});

test("a limit of 0 means no cap", async () => {
  const provider = createRemoteOkProvider({ fetchImpl: fixtureFetch() });
  const page = await provider.search({ limit: 0 });
  expect(page.rows.length).toBe(4);
  expect(page.truncated).toBe(false);
});

test("a limit caps the page and flags truncation", async () => {
  const provider = createRemoteOkProvider({ fetchImpl: fixtureFetch() });
  const page = await provider.search({ limit: 2 });
  expect(page.rows.length).toBe(2);
  expect(page.total).toBe(4);
  expect(page.truncated).toBe(true);
});

// --- the contract --------------------------------------------------------

contractSuite(createRemoteOkProvider({ fetchImpl: fixtureFetch() }), {
  fetchImpl: fixtureFetch(),
  knownRef: "1137716",
  expectedRows: 4,
});

test("an unknown reference raises a not-found provider error", async () => {
  const provider = createRemoteOkProvider({ fetchImpl: fixtureFetch() });
  try {
    await provider.detail("nope-999999999");
    throw new Error("detail should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("not-found");
    expect((e as ProviderError).cliCode).toBe("NOT_FOUND");
  }
});
