import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("remoteok-cli flag validation & errors", () => {
  test("returns help with --help and exits 0", async () => {
    const res = await runCLI(["--help"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("remoteok-cli")
    expect(res.stdout).toContain("SEARCH FLAGS")
  })

  test("rejects unknown commands", async () => {
    const res = await runCLI(["invalid-command"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("UNKNOWN_COMMAND")
  })

  test("rejects unknown flags for search", async () => {
    const res = await runCLI(["search", "--bogus-flag"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("UNKNOWN_FLAG")
  })

  test("rejects unknown flags for detail", async () => {
    const res = await runCLI(["detail", "123", "--unknown"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("UNKNOWN_FLAG")
  })

  test("rejects missing argument for detail", async () => {
    const res = await runCLI(["detail"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("MISSING_ARG")
  })

  test("rejects invalid page number", async () => {
    const res = await runCLI(["search", "--page", "-5"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_PAGE")
  })
})

describe("remoteok-cli silent flag coercion (P-M1/M3/M4/M6)", () => {
  // P-M1: a known value-flag passed without a value parses as `true` and its
  // filter is silently dropped. Must exit 1 with INVALID_ARG before fetching.
  for (const flag of ["query", "location", "tag", "salary", "jobage", "page", "limit", "format"]) {
    test(`bare --${flag} on search exits 1 with INVALID_ARG`, async () => {
      const res = await runCLI(["search", `--${flag}`])
      expect(res.exitCode).toBe(1)
      const err = JSON.parse(res.stderr)
      expect(err.code).toBe("INVALID_ARG")
      expect(err.error).toContain(`--${flag}`)
    })
  }

  test("bare --format on detail exits 1 with INVALID_ARG", async () => {
    const res = await runCLI(["detail", "1137309", "--format"])
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
    const res = await runCLI(["detail", "1137309", "--format", "table"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_FORMAT")
  })

  // P-M4: --jobage must match /^\d+$/ and be >= 1. Unlike the other three
  // CLIs, remoteok's parseFlags consumes "-5" as the flag's value (instead of
  // a stray flag), so it must also fail here with INVALID_JOBAGE.
  for (const bad of ["abc", "0", "1.5", "7abc", "-5"]) {
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

  // P-M6: --salary must be a strict integer, never silently dropped to
  // undefined (remoteok declares no --experience flag).
  for (const bad of ["abc", "1.5", "5x"]) {
    test(`search --salary ${bad} exits 1 with INVALID_SALARY`, async () => {
      const res = await runCLI(["search", "--salary", bad])
      expect(res.exitCode).toBe(1)
      const err = JSON.parse(res.stderr)
      expect(err.code).toBe("INVALID_SALARY")
    })
  }

  test("search --salary 100000 produces no INVALID_SALARY", async () => {
    const res = await runCLI(["search", "--salary", "100000", "--limit", "1"])
    if (res.exitCode !== 0) {
      const err = JSON.parse(res.stderr)
      expect(err.code).not.toBe("INVALID_SALARY")
    }
  })
})
