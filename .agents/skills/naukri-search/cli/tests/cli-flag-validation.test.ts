import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("naukri-cli flag validation", () => {
  test("prints help and exits 0 when called with --help", async () => {
    const res = await runCLI(["--help"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("naukri-cli")
  })

  test("prints help and exits 1 when called with no arguments", async () => {
    const res = await runCLI([])
    expect(res.exitCode).toBe(1)
    expect(res.stdout).toContain("naukri-cli")
  })

  test("rejects unknown command with code 1 and error JSON on stderr", async () => {
    const res = await runCLI(["unknown-cmd"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("BAD_CMD")
  })

  test("rejects unknown flag on search command with UNKNOWN_FLAG", async () => {
    const res = await runCLI(["search", "--bogus-flag"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("UNKNOWN_FLAG")
  })

  test("rejects invalid page number", async () => {
    const res = await runCLI(["search", "--page", "0"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("BAD_ARG")
  })

  test("rejects missing id on detail command", async () => {
    const res = await runCLI(["detail"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("NO_ID")
  })
})

describe("naukri-cli silent flag coercion (P-M1/M3/M4/M5/M6)", () => {
  // P-M1: a known value-flag passed without a value parses as `true` and its
  // filter is silently dropped. Must exit 1 with INVALID_ARG before fetching.
  for (const flag of ["location", "query", "experience", "salary", "jobage", "page", "limit", "format"]) {
    test(`bare --${flag} on search exits 1 with INVALID_ARG`, async () => {
      const res = await runCLI(["search", `--${flag}`])
      expect(res.exitCode).toBe(1)
      const err = JSON.parse(res.stderr)
      expect(err.code).toBe("INVALID_ARG")
      expect(err.error).toContain(`--${flag}`)
    })
  }

  test("bare --format on detail exits 1 with INVALID_ARG", async () => {
    const res = await runCLI(["detail", "123", "--format"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_ARG")
  })

  // P-M3: --format typos must fail, never silently coerce to json.
  test("search --format typo exits 1 with INVALID_FORMAT", async () => {
    const res = await runCLI(["search", "--format", "yaml"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_FORMAT")
  })

  test("detail --format table exits 1 with INVALID_FORMAT (detail is json|plain only)", async () => {
    const res = await runCLI(["detail", "123", "--format", "table"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_FORMAT")
  })

  // P-M4: --jobage must be /^\d+$/ and >= 1.
  for (const bad of ["abc", "0", "1.5", "7abc"]) {
    test(`search --jobage ${bad} exits 1 with INVALID_JOBAGE`, async () => {
      const res = await runCLI(["search", "--jobage", bad])
      expect(res.exitCode).toBe(1)
      const err = JSON.parse(res.stderr)
      expect(err.code).toBe("INVALID_JOBAGE")
    })
  }

  test("search --jobage 7 produces no INVALID_JOBAGE", async () => {
    const res = await runCLI(["search", "--jobage", "7", "--limit", "1"])
    if (res.exitCode !== 0) {
      const err = JSON.parse(res.stderr)
      expect(err.code).not.toBe("INVALID_JOBAGE")
    }
  })

  // P-M5: --experience must be a strict integer, never NaN passthrough.
  for (const bad of ["abc", "1.5", "3years"]) {
    test(`search --experience ${bad} exits 1 with INVALID_EXPERIENCE`, async () => {
      const res = await runCLI(["search", "--experience", bad])
      expect(res.exitCode).toBe(1)
      const err = JSON.parse(res.stderr)
      expect(err.code).toBe("INVALID_EXPERIENCE")
    })
  }

  test("search --experience 3 produces no INVALID_EXPERIENCE", async () => {
    const res = await runCLI(["search", "--experience", "3", "--limit", "1"])
    if (res.exitCode !== 0) {
      const err = JSON.parse(res.stderr)
      expect(err.code).not.toBe("INVALID_EXPERIENCE")
    }
  })

  // P-M6: --salary is a number or LPA range ("6-10"); garbage must fail loudly.
  test("search --salary abc exits 1 with INVALID_SALARY", async () => {
    const res = await runCLI(["search", "--salary", "abc"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_SALARY")
  })

  test('search --salary "6-10" range produces no INVALID_SALARY', async () => {
    const res = await runCLI(["search", "--salary", "6-10", "--limit", "1"])
    if (res.exitCode !== 0) {
      const err = JSON.parse(res.stderr)
      expect(err.code).not.toBe("INVALID_SALARY")
    }
  })
})
