// Shared error envelope for all *-search portal CLIs: stderr {"error","code"}.
// No default code and no case normalization - every call site passes its
// exact contract code (INVALID_ARG, NOT_FOUND, ...).

export function writeError(message: string, code: string): void {
  process.stderr.write(JSON.stringify({ error: message, code }) + "\n")
}
