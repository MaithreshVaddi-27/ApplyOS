import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_PATH = resolve(__dirname, "../src/cli.ts")

export interface CLIResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function runCLI(args: string[]): Promise<CLIResult> {
  return new Promise((res) => {
    const proc = spawn("bun", ["run", CLI_PATH, ...args], { env: { ...process.env } })
    let stdout = ""
    let stderr = ""
    proc.stdout.on("data", (d) => {
      stdout += d.toString()
    })
    proc.stderr.on("data", (d) => {
      stderr += d.toString()
    })
    proc.on("close", (exitCode) => {
      res({ stdout, stderr, exitCode: exitCode ?? 0 })
    })
  })
}

export function parseJSON<T>(res: CLIResult): T {
  try {
    return JSON.parse(res.stdout) as T
  } catch {
    throw new Error(`Failed to parse stdout as JSON: ${res.stdout}\nStderr: ${res.stderr}`)
  }
}
