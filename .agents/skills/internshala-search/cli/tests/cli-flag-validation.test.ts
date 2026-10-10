import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("internshala-cli flag validation", () => {
  test("prints help and exits 0 when called with --help", async () => {
    const res = await runCLI(["--help"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("internshala-cli")
  })

  test("prints help and exits 1 when called with no arguments", async () => {
    const res = await runCLI([])
    expect(res.exitCode).toBe(1)
    expect(res.stdout).toContain("internshala-cli")
  })

  test("rejects unknown command with code 1 and error JSON on stderr", async () => {
    const res = await runCLI(["unknown-cmd"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("UNKNOWN_COMMAND")
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
    expect(err.code).toBe("INVALID_PAGE")
  })

  test("rejects missing id on detail command", async () => {
    const res = await runCLI(["detail"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("MISSING_ARG")
  })

  test("rejects valueless value-flags with INVALID_ARG (P-M1)", async () => {
    for (const flag of ["--query", "--location", "--type", "--jobage", "--page", "--limit", "--format"]) {
      const res = await runCLI(["search", flag])
      expect(res.exitCode).toBe(1)
      const err = JSON.parse(res.stderr)
      expect(err.code).toBe("INVALID_ARG")
    }
  })

  test("rejects invalid --type with INVALID_TYPE (P-M2)", async () => {
    const res = await runCLI(["search", "--type", "bogus"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_TYPE")
  })

  test("rejects invalid --format on search with INVALID_FORMAT (P-M3)", async () => {
    const res = await runCLI(["search", "--format", "bogus"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_FORMAT")
  })

  test("rejects invalid --format on detail with INVALID_FORMAT (P-M3)", async () => {
    const res = await runCLI(["detail", "some-id", "--format", "bogus"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_FORMAT")
  })

  test("rejects invalid --jobage with INVALID_JOBAGE (P-M4)", async () => {
    for (const bad of ["0", "abc", "2.5"]) {
      const res = await runCLI(["search", "--jobage", bad])
      expect(res.exitCode).toBe(1)
      const err = JSON.parse(res.stderr)
      expect(err.code).toBe("INVALID_JOBAGE")
    }
  })
})
