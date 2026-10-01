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
