// Phase 4 (docs/PROJECT_BLUEPRINT.md) — the Freehire provider.
//
// The important tests here are the PARITY ones: the SDK must produce exactly
// the rows and the query string the freehire CLI produced before the
// migration, on the same fixture. Those fixtures were captured from the CLI's
// own implementation, so this is a proof that the migration changed nothing a
// reader can see.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contractSuite } from "../src/contract.js";
import { isProviderError, ProviderError } from "../src/errors.js";
import {
  buildFreehireQuery,
  createFreehireProvider,
  freehireBaseUrl,
  freehireProvider,
  normalizeFreehireSlug,
  type FreehireRow,
} from "../src/freehire.js";

const FIXTURES = join(import.meta.dir, "fixtures");
const FEED = JSON.parse(readFileSync(join(FIXTURES, "freehire-feed.json"), "utf8"));
const EXPECTED = JSON.parse(readFileSync(join(FIXTURES, "freehire-expected.json"), "utf8"));
const SEARCH_EXPECTED = JSON.parse(
  readFileSync(join(FIXTURES, "freehire-search-expected.json"), "utf8"),
);

/** One row as the pre-migration CLI's search envelope carried it. */
interface CapturedRow {
  id: string;
  title: string;
  company: string | null;
  company_slug: string | null;
  location: string | null;
  date: string | null;
  url: string;
  work_mode: string | null;
  regions: string[];
  countries: string[];
  skills: string[];
  description: string | null;
}

/**
 * The stand-in board.
 *
 * The board applies its filters server-side, so the stand-in has to as well -
 * otherwise every query returns the same rows and the parity test proves
 * nothing. It parses the query string, filters the captured feed the way
 * freehire.me does, and answers with the board's envelope.
 */
function fixtureFetch(): typeof fetch {
  const all: any[] = FEED.data ?? [];
  return (async (url: unknown) => {
    const href = String(url);
    const qi = href.indexOf("?");
    const path = qi >= 0 ? href.slice(0, qi) : href;
    const p = new URLSearchParams(qi >= 0 ? href.slice(qi + 1) : "");

    // The board's own endpoint for one posting.
    if (path.includes("/api/v1/jobs/")) {
      const slug = decodeURIComponent(path.slice(path.lastIndexOf("/") + 1));
      const job = all.find((r) => r.public_slug === slug);
      if (!job) {
        return { status: 404, ok: false, text: async () => "", json: async () => ({}) };
      }
      const body = JSON.stringify({ data: job });
      return {
        status: 200,
        ok: true,
        text: async () => body,
        json: async () => JSON.parse(body),
      };
    }

    let rows = all.slice();

    const q = (p.get("q") ?? "").toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [r.title, r.company, r.description, (r.skills ?? []).join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    const facet = (key: string, field: string) => {
      const wanted = p.getAll(key);
      if (!wanted.length) return;
      rows = rows.filter((r) => (r[field] ?? []).some((v: string) => wanted.includes(v)));
    };
    facet("regions", "regions");
    facet("countries", "countries");
    facet("cities", "cities");
    facet("skills", "skills");
    const enrichFacet = (key: string) => {
      const wanted = p.getAll(key);
      if (!wanted.length) return;
      rows = rows.filter((r) => wanted.includes(r.enrichment?.[key]));
    };
    enrichFacet("seniority");
    enrichFacet("category");
    if (p.get("company_slug")) {
      const want = p.get("company_slug") as string;
      rows = rows.filter((r) => r.company_slug === want);
    }
    if (p.get("work_mode")) {
      const want = p.get("work_mode") as string;
      rows = rows.filter((r) => (r.work_mode ?? "") === want);
    }

    const limit = Number(p.get("limit") ?? all.length);
    const offset = Number(p.get("offset") ?? 0);
    const body = JSON.stringify({
      data: rows.slice(offset, offset + (limit > 0 ? limit : rows.length)),
      meta: { total: rows.length, limit, offset },
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
    jobAgeDays: opts.jobage,
    page: opts.page,
    limit: opts.limit,
    extra: {
      include_description: opts.includeDescription,
      description_format: opts.descriptionFormat,
      experience_min: opts.experience,
      salary_min: opts.salary,
      work_mode: opts.workMode,
      company_slug: opts.company,
      regions: opts.regions,
      countries: opts.countries,
      cities: opts.cities,
      seniority: opts.seniority,
      category: opts.category,
      skills: opts.skills,
      ...(opts.facets ?? {}),
    },
  };
}

// --- parity: the mapped rows ---------------------------------------------

test("the SDK produces the same rows the CLI produced before the migration", async () => {
  const provider = createFreehireProvider({ fetchImpl: fixtureFetch() });
  const page = await provider.search({ limit: 25 });
  expect(page.rows.length).toBe(EXPECTED.length);

  for (const [i, expected] of EXPECTED.entries()) {
    const actual = page.rows[i];
    expect(actual.id).toBe(expected.id);
    expect(actual.title).toBe(expected.title);
    expect(actual.company).toBe(expected.company);
    expect(actual.company_slug).toBe(expected.company_slug);
    expect(actual.location).toBe(expected.location);
    expect(actual.date).toBe(expected.date);
    expect(actual.url).toBe(expected.url);
    expect(actual.work_mode).toBe(expected.work_mode);
    expect(actual.regions).toEqual(expected.regions);
    expect(actual.countries).toEqual(expected.countries);
    expect(actual.skills).toEqual(expected.skills);
    expect(actual.description).toBe(expected.description);
  }
});

// --- parity: the whole envelope, and the query string ----------------------

test("the SDK reproduces the pre-migration CLI's search, query for query", async () => {
  const provider = createFreehireProvider({ fetchImpl: fixtureFetch() });
  const captures = Object.entries(SEARCH_EXPECTED) as Array<[string, any]>;

  for (const [name, captured] of captures) {
    const opts = captured.opts as Record<string, any>;
    const req = requestFromCaptured(opts);

    // The board's query string must be the same one the CLI sent.
    const expectedQuery = captured.query as string;
    const actualQuery = buildFreehireQuery(req).toString();
    expect(actualQuery).toBe(expectedQuery);

    const page = await provider.search(req);
    const expectedRows = captured.stdout.results as CapturedRow[];
    expect(page.rows.length).toBe(expectedRows.length);

    for (const [i, expected] of expectedRows.entries()) {
      const actual = page.rows[i];
      expect(actual.id).toBe(expected.id);
      expect(actual.title).toBe(expected.title);
      expect(actual.company).toBe(expected.company);
      expect(actual.company_slug).toBe(expected.company_slug);
      expect(actual.location).toBe(expected.location);
      expect(actual.date).toBe(expected.date);
      expect(actual.url).toBe(expected.url);
      expect(actual.work_mode).toBe(expected.work_mode);
      expect(actual.regions).toEqual(expected.regions);
      expect(actual.countries).toEqual(expected.countries);
      expect(actual.skills).toEqual(expected.skills);
      expect(actual.description).toBe(expected.description);
    }
  }
});

// --- the query builder ----------------------------------------------------

test("the query carries the board's own vocabulary", () => {
  const q = buildFreehireQuery({
    query: "python",
    jobAgeDays: 14,
    limit: 5,
    page: 3,
    extra: {
      work_mode: "remote",
      company_slug: "citigroup",
      experience_min: 3,
      regions: ["uk", "eu"],
    },
  });
  expect(q.get("q")).toBe("python");
  expect(q.get("limit")).toBe("5");
  expect(q.get("offset")).toBe("10");
  expect(q.get("semantic_ratio")).toBe("0");
  expect(q.get("posted_within_days")).toBe("14");
  expect(q.get("work_mode")).toBe("remote");
  expect(q.get("company_slug")).toBe("citigroup");
  expect(q.get("experience_min")).toBe("3");
  expect(q.getAll("regions")).toEqual(["uk", "eu"]);
});

test("an unknown extra goes straight through as a query param", () => {
  const q = buildFreehireQuery({ extra: { source: ["adzuna", "linkedin"] } });
  expect(q.getAll("source")).toEqual(["adzuna", "linkedin"]);
});

test("hydration is opt-out, and the format travels with it", () => {
  const withBody = buildFreehireQuery({});
  expect(withBody.get("include_description")).toBe("true");
  expect(withBody.get("description_format")).toBe("markdown");

  const lean = buildFreehireQuery({ extra: { include_description: false } });
  expect(lean.get("include_description")).toBe("false");
  // Without hydration there is no body to render, so no format is sent.
  expect(lean.get("description_format")).toBeNull();
});

// --- the board's identity -------------------------------------------------

test("the base URL is swappable for a self-hosted instance", () => {
  expect(freehireBaseUrl({})).toBe("https://freehire.me");
  expect(freehireBaseUrl({ FREEHIRE_API_URL: "https://jobs.example/" })).toBe(
    "https://jobs.example",
  );
});

test("a slug is read from a bare slug or a /jobs/ url", () => {
  expect(normalizeFreehireSlug("golang-zensar-2bxu6dxm")).toBe("golang-zensar-2bxu6dxm");
  expect(normalizeFreehireSlug("https://freehire.me/jobs/golang-zensar-2bxu6dxm")).toBe(
    "golang-zensar-2bxu6dxm",
  );
  expect(normalizeFreehireSlug("not a slug")).toBeNull();
});

// --- failures -------------------------------------------------------------

test("a feed that is not an envelope is a parse failure", async () => {
  const broken = (async () => ({
    status: 200,
    ok: true,
    text: async () => "not json",
    json: async () => {
      throw new Error("bad json");
    },
  })) as unknown as typeof fetch;
  const provider = createFreehireProvider({ fetchImpl: broken });
  try {
    await provider.search({});
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("parse");
  }
});

test("a 404 on the search endpoint is reported, not swallowed as an empty board", async () => {
  const missing = (async () => ({
    status: 404,
    ok: false,
    text: async () => "not found",
    json: async () => ({}),
  })) as unknown as typeof fetch;
  const provider = createFreehireProvider({ fetchImpl: missing });
  try {
    await provider.search({});
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("not-found");
  }
});

test("a connection failure fails fast rather than retrying", async () => {
  let attempts = 0;
  const refusing = (async () => {
    attempts++;
    throw new Error("connection refused");
  }) as unknown as typeof fetch;
  const provider = createFreehireProvider({ fetchImpl: refusing });
  try {
    await provider.search({});
    throw new Error("should have thrown");
  } catch (e) {
    expect(isProviderError(e)).toBe(true);
    expect((e as ProviderError).code).toBe("network");
    // One attempt, not seven: the connection is refused now.
    expect(attempts).toBe(1);
  }
});

// --- the contract --------------------------------------------------------

contractSuite(createFreehireProvider({ fetchImpl: fixtureFetch() }), {
  fetchImpl: fixtureFetch(),
  knownRef: "python-risk-developer-vice-president-citigroup-ernd2pcz",
});
