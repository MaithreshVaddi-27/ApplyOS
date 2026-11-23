import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("arbeitnow-cli flag validation", () => {
  test("prints help and exits 0 with --help", async () => {
    const res = await runCLI(["--help"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("arbeitnow-cli")
  })
  test("exits 1 with no arguments", async () => {
    const res = await runCLI([])
    expect(res.exitCode).toBe(1)
  })
  test("rejects unknown commands", async () => {
    const res = await runCLI(["nope"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("UNKNOWN_COMMAND")
  })
  test("rejects unknown flags", async () => {
    const res = await runCLI(["search", "--bogus"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("UNKNOWN_FLAG")
  })
  test("rejects valueless value-flags", async () => {
    for (const flag of ["--query", "--location", "--jobage", "--page", "--limit", "--format"]) {
      const res = await runCLI(["search", flag])
      expect(res.exitCode).toBe(1)
      expect(JSON.parse(res.stderr).code).toBe("INVALID_ARG")
    }
  })
  test("rejects invalid page, limit and jobage", async () => {
    for (const [flag, value, code] of [
      ["--page", "0", "INVALID_PAGE"],
      ["--limit", "-1", "INVALID_LIMIT"],
      ["--jobage", "0", "INVALID_JOBAGE"],
      ["--jobage", "abc", "INVALID_JOBAGE"],
    ] as const) {
      const res = await runCLI(["search", flag, value])
      expect(res.exitCode).toBe(1)
      expect(JSON.parse(res.stderr).code).toBe(code)
    }
  })
  test("rejects invalid format", async () => {
    const res = await runCLI(["search", "--format", "xml"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("INVALID_FORMAT")
  })
  test("rejects missing detail argument", async () => {
    const res = await runCLI(["detail"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("MISSING_ARG")
  })
})
