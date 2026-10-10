import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("cutshort-cli flag validation", () => {
  test("prints help and exits 0 when called with --help", async () => {
    const res = await runCLI(["--help"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("cutshort-cli")
  })

  test("prints help and exits 1 when called with no arguments", async () => {
    const res = await runCLI([])
    expect(res.exitCode).toBe(1)
    expect(res.stdout).toContain("cutshort-cli")
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

  test("rejects fractional and zero jobage values", async () => {
    for (const bad of ["0", "2.5", "-3"]) {
      const res = await runCLI(["search", "-c", "reactjs-jobs", "--jobage", bad])
      expect(res.exitCode).toBe(1)
      const err = JSON.parse(res.stderr)
      expect(err.code).toBe("BAD_ARG")
    }
  })

  test("rejects fractional limit values", async () => {
    const res = await runCLI(["search", "-c", "reactjs-jobs", "--limit", "1.5"])
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

  test("search with neither category nor query exits NO_CATEGORY without network", async () => {
    const res = await runCLI(["search"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("NO_CATEGORY")
  })

  test("rejects valueless value-flags with INVALID_ARG (P-M1)", async () => {
    for (const flag of ["--category", "--query", "--location", "--jobage", "--limit", "--format"]) {
      const res = await runCLI(["search", flag])
      expect(res.exitCode).toBe(1)
      const err = JSON.parse(res.stderr)
      expect(err.code).toBe("INVALID_ARG")
    }
  })

  test("rejects invalid --format on search with INVALID_FORMAT (P-M3)", async () => {
    const res = await runCLI(["search", "-c", "reactjs-jobs", "--format", "bogus"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_FORMAT")
  })

  test("rejects invalid --format on detail with INVALID_FORMAT (P-M3)", async () => {
    const res = await runCLI(["detail", "some-slug", "--format", "bogus"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_FORMAT")
  })

  test("rejects non-numeric --jobage without silent coercion (P-M4)", async () => {
    const res = await runCLI(["search", "-c", "reactjs-jobs", "--jobage", "abc"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("BAD_ARG")
  })
})
