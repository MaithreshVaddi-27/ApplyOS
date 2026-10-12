// Shared argv tokenizer for the *-search portal CLIs. Only tokenizes: it
// splits `--flag value`, bare `--flag` (true), short aliases, and
// positionals. Validation (known flags, required values, exit codes) stays
// in each cli.ts, where the per-command flag sets live.
//
// The `mode` pins each CLI's negative-number semantics exactly - the four
// tokenizers looked identical until `-3` was compared (see README).

export interface ParsedArgs {
  _: string[]
  [k: string]: string | boolean | string[]
}

export type TokenizerMode = "none" | "int-only" | "cutshort" | "careers"

export function parseRawArgs(
  argv: string[],
  aliases: Record<string, string> = {},
  mode: TokenizerMode,
  repeatableKeys: string[] = [],
): ParsedArgs {
  const flags: ParsedArgs = { _: [] }
  const isValueToken = (t: string): boolean => {
    if (mode === "cutshort") return /^-\d/.test(t)
    if (mode === "careers") return /^-?\d/.test(t)
    if (mode === "int-only") return /^-\d+$/.test(t)
    return false
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const isFlagToken =
      mode === "careers"
        ? a.startsWith("--") || (a.startsWith("-") && a.length > 1)
        : mode === "cutshort"
          ? a.startsWith("--") || (a.startsWith("-") && !/^-\d/.test(a))
          : a.startsWith("--") || a.startsWith("-")
    if (isFlagToken) {
      const key = aliases[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (repeatableKeys.includes(key)) {
        // Repeatable flags accumulate; a bare repeat keeps prior values.
        const acc = Array.isArray(flags[key]) ? (flags[key] as string[]) : []
        if (next !== undefined && !(next.startsWith("-") && !isValueToken(next))) {
          acc.push(next)
          i++
        }
        flags[key] = acc
      } else if (next === undefined || (next.startsWith("-") && !isValueToken(next))) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}
