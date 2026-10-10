import { describe, test, expect } from "bun:test";
import { runCLI } from "./helpers";

// These assert on validation error codes that are emitted BEFORE any network
// call (or independently of it), so the suite is network-free: a valid-flag case
// still runs offline because it only checks the ABSENCE of a validation error.

function parsedStderr(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr);
  } catch {
    return {};
  }
}

describe("freehire CLI flag validation", () => {
  describe("numeric flag validation", () => {
    for (const name of ["page", "limit"]) {
      test(`--${name} non-numeric exits 1 with BAD_ARG`, async () => {
        const result = await runCLI(["search", `--${name}`, "foo"]);
        expect(result.exitCode).not.toBe(0);
        const err = parsedStderr(result.stderr);
        expect(err.code).toBe("BAD_ARG");
        expect(err.error).toMatch(new RegExp(name));
      });
    }

    // Fractional values must be rejected, not truncated: parseInt("0.5") is 0,
    // and jobage 0 fails search.ts's `> 0` guard, so posted_within_days is
    // silently omitted from the outbound request while the CLI exits 0 —
    // the discarded-filter failure the UNKNOWN_FLAG guard exists to prevent (#373).
    for (const name of ["page", "limit"]) {
      test(`--${name} fractional exits 1 with BAD_ARG instead of truncating`, async () => {
        const result = await runCLI(["search", `--${name}`, "1.5"]);
        expect(result.exitCode).not.toBe(0);
        const err = parsedStderr(result.stderr);
        expect(err.code).toBe("BAD_ARG");
        expect(err.error).toMatch(new RegExp(name));
      });
    }

    test("--jobage 0.5 (truncates to 0 on master, dropping the freshness filter) exits 1 with INVALID_JOBAGE", async () => {
      const result = await runCLI(["search", "--jobage", "0.5"]);
      expect(result.exitCode).not.toBe(0);
      expect(parsedStderr(result.stderr).code).toBe("INVALID_JOBAGE");
    });

    test("--jobage 0 exits 1 with INVALID_JOBAGE (0 silently disables the filter, like the Danish CLIs' min(1))", async () => {
      const result = await runCLI(["search", "--jobage", "0"]);
      expect(result.exitCode).not.toBe(0);
      expect(parsedStderr(result.stderr).code).toBe("INVALID_JOBAGE");
    });

    test("--jobage non-numeric exits 1 with INVALID_JOBAGE", async () => {
      const result = await runCLI(["search", "--jobage", "foo"]);
      expect(result.exitCode).not.toBe(0);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("INVALID_JOBAGE");
      expect(err.error).toMatch(/jobage/);
    });

    test("valid integers produce no BAD_ARG", async () => {
      const result = await runCLI(["search", "--jobage", "7", "--page", "1", "--limit", "1"]);
      expect(parsedStderr(result.stderr).code).not.toBe("BAD_ARG");
    });
  });

  describe("--description-format validation", () => {
    test("an unsupported format exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "--description-format", "tekst"]);
      expect(result.exitCode).not.toBe(0);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("BAD_ARG");
      expect(err.error).toMatch(/description-format/);
    });
  });

  describe("--facet validation", () => {
    test("a facet without '=' exits 1 with BAD_ARG", async () => {
      const result = await runCLI(["search", "--facet", "novalue"]);
      expect(result.exitCode).not.toBe(0);
      expect(parsedStderr(result.stderr).code).toBe("BAD_ARG");
    });
  });

  describe("detail argument validation", () => {
    test("missing slug exits 1 with NO_ID", async () => {
      const result = await runCLI(["detail"]);
      expect(result.exitCode).not.toBe(0);
      expect(parsedStderr(result.stderr).code).toBe("NO_ID");
    });

    test("an unparseable slug exits 1 with BAD_ID (no network)", async () => {
      const result = await runCLI(["detail", "not a slug!"]);
      expect(result.exitCode).not.toBe(0);
      expect(parsedStderr(result.stderr).code).toBe("BAD_ID");
    });
  });

  describe("command dispatch", () => {
    test("unknown command exits 1 with BAD_CMD", async () => {
      const result = await runCLI(["frobnicate"]);
      expect(result.exitCode).not.toBe(0);
      expect(parsedStderr(result.stderr).code).toBe("BAD_CMD");
    });

    test("no command prints help and exits 1", async () => {
      const result = await runCLI([]);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toMatch(/USAGE/);
    });
  });
});


describe("unknown flag rejection", () => {
  // add-portal.md's contract: "a bogus flag or missing required arg exits 1
  // with a JSON error on stderr". A silently discarded flag is worse than an
  // error: on jobdanmark a wrong flag name returned the entire database
  // (13,862 results) as if it matched the query (review finding F13,
  // 2026-08-19). Rejection happens before dispatch, so these are network-free.
  test("a bogus --flag exits 1 with a JSON error instead of being silently discarded", async () => {
    const result = await runCLI(["search", "--query", "test", "--bogus-flag", "xyz"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    const error = JSON.parse(result.stderr);
    expect(error.code).toBe("UNKNOWN_FLAG");
    expect(error.error).toContain("--bogus-flag");
  });
});

describe("silent flag coercion (P-M1/M3/M4/M5/M6)", () => {
  // P-M1: a known value-flag passed without a value parses as `true` and its
  // filter is silently dropped. Must exit 1 with INVALID_ARG before fetching.
  // --no-description is a genuine boolean and bare --remote means "remote",
  // so neither is a value-flag; both keep working (covered below).
  for (const flag of [
    "query", "category", "city", "company", "country", "experience",
    "salary", "facet", "format", "jobage", "limit", "page", "region",
    "seniority", "skill", "description-format",
  ]) {
    test(`bare --${flag} on search exits 1 with INVALID_ARG`, async () => {
      const result = await runCLI(["search", `--${flag}`]);
      expect(result.exitCode).toBe(1);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("INVALID_ARG");
      expect(err.error).toContain(`--${flag}`);
    });
  }

  test("bare --no-description still works (genuine boolean, not a value-flag)", async () => {
    const result = await runCLI(["search", "--query", "test", "--no-description", "--limit", "1"]);
    expect(parsedStderr(result.stderr).code).not.toBe("INVALID_ARG");
  });

  test("bare --remote still means remote (defined default, not a silent drop)", async () => {
    const result = await runCLI(["search", "--query", "test", "--remote", "--limit", "1"]);
    expect(parsedStderr(result.stderr).code).not.toBe("INVALID_ARG");
  });

  test("bare --format on detail exits 1 with INVALID_ARG", async () => {
    const result = await runCLI(["detail", "golang-zensar-2bxu6dxm", "--format"]);
    expect(result.exitCode).toBe(1);
    expect(parsedStderr(result.stderr).code).toBe("INVALID_ARG");
  });

  // P-M3: --format typos must fail, never silently coerce to json.
  test("search --format typo exits 1 with INVALID_FORMAT", async () => {
    const result = await runCLI(["search", "--format", "yaml"]);
    expect(result.exitCode).toBe(1);
    expect(parsedStderr(result.stderr).code).toBe("INVALID_FORMAT");
  });

  test("detail --format table exits 1 with INVALID_FORMAT (detail is json|plain only)", async () => {
    const result = await runCLI(["detail", "golang-zensar-2bxu6dxm", "--format", "table"]);
    expect(result.exitCode).toBe(1);
    expect(parsedStderr(result.stderr).code).toBe("INVALID_FORMAT");
  });

  // P-M4: --jobage must match /^\d+$/ and be >= 1.
  for (const bad of ["abc", "0", "1.5", "7abc"]) {
    test(`search --jobage ${bad} exits 1 with INVALID_JOBAGE`, async () => {
      const result = await runCLI(["search", "--jobage", bad]);
      expect(result.exitCode).toBe(1);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("INVALID_JOBAGE");
      expect(err.error).toMatch(/jobage/);
    });
  }

  test("search --jobage 7 produces no INVALID_JOBAGE", async () => {
    const result = await runCLI(["search", "--jobage", "7", "--limit", "1"]);
    expect(parsedStderr(result.stderr).code).not.toBe("INVALID_JOBAGE");
  });

  // P-M5/P-M6: --experience/--salary must be strict integers, never NaN
  // passthrough or a silent drop to undefined.
  for (const bad of ["abc", "1.5", "5x"]) {
    test(`search --experience ${bad} exits 1 with INVALID_EXPERIENCE`, async () => {
      const result = await runCLI(["search", "--experience", bad]);
      expect(result.exitCode).toBe(1);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("INVALID_EXPERIENCE");
    });

    test(`search --salary ${bad} exits 1 with INVALID_SALARY`, async () => {
      const result = await runCLI(["search", "--salary", bad]);
      expect(result.exitCode).toBe(1);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("INVALID_SALARY");
    });
  }

  test("valid --experience/--salary produce no INVALID_* error", async () => {
    const result = await runCLI(["search", "--experience", "3", "--salary", "100000", "--limit", "1"]);
    const err = parsedStderr(result.stderr);
    expect(err.code).not.toBe("INVALID_EXPERIENCE");
    expect(err.code).not.toBe("INVALID_SALARY");
  });
});
