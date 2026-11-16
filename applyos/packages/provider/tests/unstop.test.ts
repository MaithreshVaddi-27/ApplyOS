// Phase 4 (docs/PROJECT_BLUEPRINT.md) — the Unstop provider.
//
// The important tests here are the PARITY ones: the SDK must produce exactly
// the rows, the envelope and the query string the unstop CLI produced before
// the migration, on the same fixture. Those fixtures were captured from the
// CLI's own implementation, so this is a proof that the migration changed
// nothing a reader can see.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import {
  buildUnstopQuery,
  createUnstopProvider,
  extractUnstopId,
  filterUnstop,
  formatUnstopSalary,
  parseUnstopDetail,
  parseUnstopOpportunity,
  salaryToLpaRange,
  stripUnstopHtml,
  unstopDate,
  unstopProvider,
  type UnstopRow,
} from "../src/unstop.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEED = JSON.parse(readFileSync(join(FIXTURES, "unstop-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "unstop-expected.json"), "utf8"));
const SEARCH_EXPECTED = JSON.parse(
  readFileSync(join(FIXTURES, "unstop-search-expected.json"), "utf8"),
);
const DETAIL_EXPECTED = JSON.parse(
  readFileSync(join(FIXTURES, "unstop-detail-expected.json"), "utf8"),
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
  type: string | null;
  employmentType: string | null;
  workplaceType: string | null;
}

/**
 * The stand-in board.
 *
 * The board applies its text search and its paging server-side, so the
 * stand-in has to as well - otherwise every query answers with the same rows
 * and the parity test proves nothing. It parses the query string, filters the
 * captured listing the way unstop.com does, and answers with the board's
 * envelope.
 *
 * The stand-in's matching rule is a stand-in: every token of the term must
 * appear somewhere in the listing's text. The board's own matching is not
 * reproduced - what is reproduced is that the SAME query string yields the
 * SAME rows, before and after the migration.
 */
function fixtureFetch(): typeof fetch {
  const pools: Record<string, any[]> = { jobs: FEED.jobs ?? [], internships: FEED.internships ?? [] };
  const PER_PAGE = 10;

  const searchable = (row: any): string => {
    const parts: string[] = [String(row.id ?? ""), row.title ?? "", row.organisation?.name ?? ""];
    for (const l of row.locations ?? []) parts.push(l.city ?? "", l.state ?? "", l.country ?? "");
    for (const l of row.jobDetail?.locations ?? []) parts.push(l);
    for (const s of row.required_skills ?? []) parts.push(s.skill_name ?? s.skill ?? "");
    parts.push(String(row.details ?? ""));
    return parts.join(" ").toLowerCase();
  };

  return (async (url: unknown) => {
    const href = String(url);
    const qi = href.indexOf("?");
    const p = new URLSearchParams(qi >= 0 ? href.slice(qi + 1) : "");
    const opportunity = p.get("opportunity") === "internships" ? "internships" : "jobs";
    const page = Math.max(1, Number(p.get("page") ?? 1));
    const term = p.get("searchTerm") ?? "";

    let pool = pools[opportunity].slice();
    if (term) {
      const tokens = term.toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length) {
        pool = pool.filter((row) => {
          const hay = searchable(row);
          return tokens.every((t) => hay.includes(t));
        });
      }
    }
    const start = (page - 1) * PER_PAGE;
    const body = JSON.stringify({
      data: {
        data: pool.slice(start, start + PER_PAGE),
        total: pool.length,
        current_page: page,
        per_page: PER_PAGE,
      },
    });
    return {
      status: 200,
      ok: true,
      text: async () => body,
      json: async () => JSON.parse(body),
    };
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
    extra: {
      opportunity: opts.type,
      salary_lpa: opts.salary,
    },
  };
}

// --- parity: the mapped rows ---------------------------------------------

test("the SDK produces the same rows the CLI produced before the migration", async () => {
  const provider = createUnstopProvider({ fetchImpl: fixtureFetch() });
  const page = await provider.search({ page: 1 });
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
    expect(actual.type).toBe(expected.type);
    expect(actual.employmentType).toBe(expected.employmentType);
    expect(actual.workplaceType).toBe(expected.workplaceType);
  }
});

// --- parity: the whole envelope, and the query string ----------------------

test("the SDK reproduces the pre-migration CLI's search, query for query", async () => {
  const provider = createUnstopProvider({ fetchImpl: fixtureFetch() });
  const captures = Object.entries(SEARCH_EXPECTED) as Array<[string, any]>;

  for (const [name, captured] of captures) {
    const opts = captured.opts as Record<string, any>;
    const req = requestFromCaptured(opts);

    // The board's query string must be the same one the CLI sent.
    const expectedQuery = captured.query as string;
    const actualQuery = buildUnstopQuery(req).toString();
    expect(actualQuery).toBe(expectedQuery);

    const page = await provider.search(req);
    const expectedRows = captured.stdout.results as CapturedRow[];

    // The CLI's `--limit` caps what it emits, and `--limit 0` emits NOTHING.
    // The SDK's `0` means "no cap", so the surface applies the cap itself.
    // The two conventions are translated at the surface, and this is where
    // that translation is pinned.
    const rows = opts.limit === undefined ? page.rows : page.rows.slice(0, opts.limit);
    expect(rows.length).toBe(expectedRows.length);
    expect(page.total).toBe(captured.stdout.meta.total);
    expect(page.page).toBe(captured.stdout.meta.page);

    for (const [i, expected] of expectedRows.entries()) {
      const actual = rows[i];
      expect(actual.id).toBe(expected.id);
      expect(actual.title).toBe(expected.title);
      expect(actual.company).toBe(expected.company);
      expect(actual.location).toBe(expected.location);
      expect(actual.date).toBe(expected.date);
      expect(actual.url).toBe(expected.url);
      expect(actual.salary).toBe(expected.salary);
      expect(actual.type).toBe(expected.type);
      expect(actual.employmentType).toBe(expected.employmentType);
      expect(actual.workplaceType).toBe(expected.workplaceType);
    }
  }
});

// --- parity: the lookup by id ---------------------------------------------

test("the SDK finds the same posting by id, and misses the same ones", async () => {
  const provider = createUnstopProvider({ fetchImpl: fixtureFetch() });

  for (const key of ["job", "internship"] as const) {
    const captured = DETAIL_EXPECTED[key];
    const detail = await provider.detail(captured.id);
    const expected = captured.stdout;
    expect(detail.id).toBe(expected.id);
    expect(detail.url).toBe(expected.url);
    expect(detail.title).toBe(expected.title);
    expect(detail.company).toBe(expected.company);
    expect(detail.location).toBe(expected.location);
    expect(detail.date).toBe(expected.date);
    expect(detail.salary).toBe(expected.salary);
    expect(detail.employmentType).toBe(expected.employmentType);
    expect(detail.workplaceType).toBe(expected.workplaceType);
    expect(detail.deadline).toBe(expected.deadline);
    expect(detail.skills).toEqual(expected.skills);
    expect(detail.eligibility).toEqual(expected.eligibility);
    // The CLI reported an absent body as an empty string. The SDK says null,
    // which is the honest answer; see the phase doc.
    expect(detail.description ?? "").toBe(expected.description);
  }
});

test("an id that is not there is a not-found error, not the first result", async () => {
  const provider = createUnstopProvider({ fetchImpl: fixtureFetch() });
  const captured = DETAIL_EXPECTED.missing;
  try {
    await provider.detail(captured.id);
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("not-found");
  }
});

// --- the board's own rules -----------------------------------------------

test("the id comes from the LAST numeric segment of a url", () => {
  expect(extractUnstopId("https://unstop.com/jobs/software-engineer-visheneracom-1739954")).toBe(
    "1739954",
  );
  expect(extractUnstopId("https://unstop.com/jobs/team-111/finale-222")).toBe("222");
  expect(extractUnstopId("1739954")).toBe("1739954");
  expect(extractUnstopId("  1765373  ")).toBe("1765373");
});

test("the date is the board's update date, never an invented one", () => {
  expect(unstopDate("2026-09-01T15:22:02+05:30")).toBe("2026-09-01");
  expect(unstopDate("not-a-date")).toBeNull();
  expect(unstopDate(undefined)).toBeNull();
});

test("a row with no id is not referenceable and is dropped", () => {
  expect(parseUnstopOpportunity({ id: "" })).toBeNull();
  expect(parseUnstopOpportunity({ id: undefined as unknown as number })).toBeNull();
});

test("a row with no title keeps the CLI's long-standing placeholder", () => {
  // The CLI has always called a title-less row "Untitled", and its own suite
  // pins it. The title is a required field, not an optional one.
  expect(parseUnstopOpportunity({ id: 1 })?.title).toBe("Untitled");
});

test("the title is the board's own string, verbatim", () => {
  // The board sends a trailing space on some titles, and the CLI has always
  // shown exactly what the board sent.
  expect(parseUnstopOpportunity({ id: 1, title: "Digital Officer " })?.title).toBe(
    "Digital Officer ",
  );
});

test("the url is absolute: the board's public_url is a path", () => {
  const row = parseUnstopOpportunity({
    id: 1813094,
    title: "R",
    public_url: "jobs/business-development-executive-1813094",
  });
  expect(row?.url).toBe("https://unstop.com/jobs/business-development-executive-1813094");
});

test("an absent employer and an absent place stay null", () => {
  const row = parseUnstopOpportunity({ id: 1, title: "R" });
  expect(row?.company).toBeNull();
  expect(row?.location).toBeNull();
});

test("the salary line keeps the board's own currency and grouping", () => {
  expect(
    formatUnstopSalary({ min_salary: 20000, max_salary: 30000, currency: "fa-rupee" }),
  ).toBe("₹ 20,000 - 30,000");
  expect(formatUnstopSalary({ min_salary: 20000, max_salary: 20000, currency: "fa-rupee" })).toBe(
    "₹ 20,000",
  );
  expect(formatUnstopSalary(undefined)).toBeNull();
});

test("a monthly salary is annualized, a bare figure is not", () => {
  expect(salaryToLpaRange("₹ 30,000 per month")).toEqual([3.6, 3.6]);
  expect(salaryToLpaRange("₹4,50,000")).toEqual([4.5, 4.5]);
  expect(salaryToLpaRange("₹4.5L/yr")).toEqual([4.5, 4.5]);
  expect(salaryToLpaRange("₹12,00,000 per annum")).toEqual([12, 12]);
  expect(salaryToLpaRange("$80,000")).toEqual([0.8, 0.8]);
  expect(salaryToLpaRange("6-8 LPA")).toEqual([6, 8]);
  expect(salaryToLpaRange("competitive")).toBeNull();
});

test("the board's own html rule keeps its shape", () => {
  const html = "<p>Intro</p><ul><li>One</li><li>Two</li></ul>";
  expect(stripUnstopHtml(html)).toBe("Intro\n\n• One\n• Two");
  expect(stripUnstopHtml("")).toBe("");
});

// --- the query ------------------------------------------------------------

test("the query carries the board's own vocabulary", () => {
  const q = buildUnstopQuery({
    query: "python",
    location: "Mumbai",
    page: 2,
    extra: { opportunity: "internships" },
  });
  expect(q.get("opportunity")).toBe("internships");
  expect(q.get("page")).toBe("2");
  expect(q.get("searchTerm")).toBe("python Mumbai");
});

test("a lookup by id does not name a page", () => {
  const q = buildUnstopQuery({ query: "1813094", extra: { opportunity: "jobs" } });
  expect(q.get("opportunity")).toBe("jobs");
  expect(q.get("page")).toBeNull();
  expect(q.get("searchTerm")).toBe("1813094");
});

// --- the age filter -------------------------------------------------------

test("the age filter keeps a posting inside the window and drops one outside", () => {
  // The clock is injected, so the fixture does not depend on today's date.
  const now = new Date("2026-11-16T12:00:00Z");
  const row = (date: string): UnstopRow => ({
    id: date,
    title: "R",
    company: "A",
    location: null,
    date,
    url: "https://unstop.com/x",
    type: "jobs",
    employmentType: null,
    workplaceType: null,
    deadline: null,
    updatedAt: null,
    skills: [],
    eligibility: [],
  });
  const rows = [row("2026-11-16"), row("2026-11-10"), row("2026-01-01")];

  const week = filterUnstop(rows, { jobAgeDays: 3 }, now);
  expect(week.map((r) => r.date)).toEqual(["2026-11-16"]);

  const month = filterUnstop(rows, { jobAgeDays: 30 }, now);
  expect(month.map((r) => r.date)).toEqual(["2026-11-16", "2026-11-10"]);

  // A posting with no date is kept: the board did not say.
  const undated = filterUnstop([row("") as UnstopRow], { jobAgeDays: 7 }, now);
  expect(undated.length).toBe(1);
});

// --- failures -------------------------------------------------------------

test("a listing that is not an envelope is a parse failure", async () => {
  const broken = (async () => ({
    status: 200,
    ok: true,
    text: async () => "not json",
    json: async () => {
      throw new Error("bad json");
    },
  })) as unknown as typeof fetch;
  const provider = createUnstopProvider({ fetchImpl: broken });
  try {
    await provider.search({ page: 1 });
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("parse");
  }
});

test("a 500 is reported as an http failure", async () => {
  const failing = (async () => ({
    status: 500,
    ok: false,
    statusText: "Server Error",
    text: async () => "",
    json: async () => ({}),
  })) as unknown as typeof fetch;
  const provider = createUnstopProvider({ fetchImpl: failing });
  try {
    await provider.search({ page: 1 });
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("http");
  }
});

// --- the client-side filters ----------------------------------------------

test("a place that matches nothing yields nothing, not the whole board", () => {
  // The board matches a term anywhere in a listing, so a posting can come
  // back for a city's search while its own place is a different one. The
  // refinement exists to drop exactly that posting - and never to fall back
  // to the unfiltered board, which would misstate the answer.
  const row = (location: string | null): UnstopRow => ({
    id: "1",
    title: "R",
    company: "A",
    location,
    date: null,
    url: "https://unstop.com/x",
    type: "jobs",
    employmentType: null,
    workplaceType: null,
    deadline: null,
    updatedAt: null,
    skills: [],
    eligibility: [],
  });
  const rows = [row("Mumbai, Maharashtra"), row("Pune, Maharashtra"), row(null)];

  const mumbai = filterUnstop(rows, { location: "Mumbai" }, new Date());
  expect(mumbai.map((r) => r.location)).toEqual(["Mumbai, Maharashtra"]);

  const nowhere = filterUnstop(rows, { location: "Berlin" }, new Date());
  expect(nowhere).toEqual([]);
});

test("a salary range keeps the postings whose range overlaps it", () => {
  const row = (id: string, salary: string | null): UnstopRow => ({
    id,
    title: "R",
    company: "A",
    location: null,
    date: null,
    url: "https://unstop.com/x",
    salary,
    type: "jobs",
    employmentType: null,
    workplaceType: null,
    deadline: null,
    updatedAt: null,
    skills: [],
    eligibility: [],
  });
  const rows = [
    row("low", "₹ 2,00,000"),
    row("mid", "₹ 6,00,000"),
    row("high", "₹ 20,00,000"),
    row("none", null),
  ];

  const sixToTen = filterUnstop(rows, { extra: { salary_lpa: "6-10" } }, new Date());
  // The overlap test keeps the postings whose range intersects 6-10 LPA. A
  // posting with no salary is kept: the board did not say.
  expect(sixToTen.map((r) => r.id)).toEqual(["mid", "none"]);
});

// --- the contract ---------------------------------------------------------

contractSuite(createUnstopProvider({ fetchImpl: fixtureFetch() }), {
  fetchImpl: fixtureFetch(),
  knownRef: "1813093",
});
