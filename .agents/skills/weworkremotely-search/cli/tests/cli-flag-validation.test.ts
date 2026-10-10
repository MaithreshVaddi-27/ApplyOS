import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers.js"

describe("weworkremotely-cli flag validation & errors", () => {
  test("returns help with --help and exits 0", async () => {
    const res = await runCLI(["--help"])
    expect(res.exitCode).toBe(0)
    expect(res.stdout).toContain("weworkremotely-cli")
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

  test("rejects invalid limit number", async () => {
    const res = await runCLI(["search", "--limit", "-1"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_LIMIT")
  })

  test("rejects valueless value-flag --query", async () => {
    const res = await runCLI(["search", "--query"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_ARG")
  })

  test("rejects valueless value-flag --format", async () => {
    const res = await runCLI(["search", "--format"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_ARG")
  })

  test("rejects valueless --format for detail", async () => {
    const res = await runCLI(["detail", "123", "--format"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_ARG")
  })

  test("rejects invalid --format for search", async () => {
    const res = await runCLI(["search", "--format", "xml"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_FORMAT")
  })

  test("rejects invalid --format for detail", async () => {
    const res = await runCLI(["detail", "123", "--format", "table"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_FORMAT")
  })

  test("rejects non-numeric --jobage", async () => {
    const res = await runCLI(["search", "--jobage", "abc"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_JOBAGE")
  })

  test("rejects zero --jobage", async () => {
    const res = await runCLI(["search", "--jobage", "0"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_JOBAGE")
  })

  test("rejects non-integer --jobage", async () => {
    const res = await runCLI(["search", "--jobage", "14abc"])
    expect(res.exitCode).toBe(1)
    const err = JSON.parse(res.stderr)
    expect(err.code).toBe("INVALID_JOBAGE")
  })
})
