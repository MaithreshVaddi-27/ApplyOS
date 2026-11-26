# CLI Design

> **Status:** `IMPLEMENTED` and **stable as of Phase 10**. Every command below exists; additive
> changes only within a major version. The published field shapes live in
> [public-api.md](public-api.md) §2, which is the authority for consumers.

---

## 1. Design principles

1. **One binary, one shape.** `applyos <command> --flags`. A flag that means the same thing
   means the same thing everywhere.
2. **Machine-readable by default, human-readable on request.** `--format json` is the default
   for the engine CLI; the provider CLIs default to `json` too. A human runs `--format table`.
3. **Failure is loud and typed.** Exit 1 with a stable error code. Never a silent empty result
   that reads as success.
4. **Nothing is destroyed without a flag that says so.** Destructive operations need an explicit
   subcommand.
5. **No interactive prompts.** Every command is scriptable. The agent asks the human; the CLI
   does not.
6. **Offline by default.** No command makes a network request unless it is a fetch command.
   `eval`, `tracker`, `doctor`, and `profile` are all offline.

---

## 2. Command surface

```
applyos scrape    [-q query] [-l location] [--stage S] [--type T] [--jobage D]
                 [-n limit] [--max-pages N] [--format json|table|plain]

applyos rank      [-q query] [-l location] [--stage S] [--type T]
                 [--skills a,b,c] [--locations X,Y] [--grad-year YYYY]
                 [--stipend-floor N] [--ctc-floor N] [--max-age D]
                 [-n limit] [--format json|table]

applyos apply     <url|id> [--profile profile.json] [--description text]
                 [--skills a,b] [--locations X] [--stage S]
                 [--grad-year YYYY] [--stipend-floor N] [--ctc-floor N]
                 [--format json|table]

applyos apply     --batch batch.json [--profile profile.json] [flags…]

applyos doctor [--check-remote] [--format json|table|plain]
applyos --version
```

The Phase 7–10 additions, all implemented:

```
applyos tracker list [--status S] [--format json|table]
applyos tracker set <company> <role> [--status S] [--notes N] [--date YYYY-MM-DD]
applyos tracker migrate --to N [--dry-run] [--write]
applyos snapshot [--format json|table]
applyos profile validate <file.json> [--format json|table]
applyos eval [suite] [--format json|table] [--update-baseline]
```

`tracker set` is positional (company, role) rather than two flags: the company and role identify
one row, the same key the specs use. `tracker migrate` is dry-run by default; `--write` applies it.
`--update-baseline` is a maintainer action. `eval` exits 1 on a tolerance breach and never touches
the network. `snapshot` is the stable consumer contract from Q10. No command prompts.

---

## 3. Argument policy

### 3.1 Unknown flags are rejected

A recognised flag that is missing its value fails loudly. The 2026-10-09 audit recorded the
opposite behaviour as a major finding across every portal CLI: a bare `--query` parsed to the
string `"true"`, and the filter was then silently dropped while the command exited 0.

| Situation | Required behaviour | Code |
|---|---|---|
| Unknown flag | Reject | exit 1 |
| Known flag, missing value | Reject | exit 1 |
| Known flag, invalid value (`--format xml`, `--jobage abc`) | Reject | exit 1 |
| Known flag, value out of range (`--limit -3`, `--max-pages 0`) | Clamp or reject, per the flag's contract | exit 0 or 1 |
| Negative numbers | Per-CLI tokenizer semantics — see below | — |

### 3.2 The negative-number problem

`--limit -3` is ambiguous: a negative number, or a flag named `3`? The repository already
solved this per-CLI, and the solutions genuinely differ. `cli-shared/src/flags.ts` encodes four
modes:

| Mode | Rule | Used by |
|---|---|---|
| `none` | Any dash-led token is a flag; a dash-led next token is never a value | linkedin, unstop, freehire, internshala, naukri, remotive, wellfound |
| `int-only` | A dash-led next token counts as a value when it is an integer (`-3` yes, `-3.5` no) | weworkremotely, remoteok, wayup |
| `cutshort` | `/^-\d/` tokens are values in both positions | cutshort-search |
| `careers` | A bare `-` is a positional; values allow `/^-?\d/` | careers-search |

**This is a deliberate non-unification.** `cli-shared/README.md` records why: the modes encode
*observed* per-CLI behaviour, and changing one would change that CLI's behaviour. The SDK
(Phase 4) must preserve these semantics, not flatten them.

### 3.3 Numeric range clamping

`packages/core/src/fetch.ts` provides the shared helper:

```ts
clampLimit(limit, fallback, max)  // 0 = no cap, passes through
parseNumArg(raw, fallback, max)   // missing/NaN → fallback
```

Behaviour: `undefined` or `NaN` → fallback; `0` → passes through as "no cap"; negatives clamp to
1; values above `max` clamp to `max`.

### 3.4 Empty versus absent

An empty array means "not given", so the profile remains the fallback rather than being
silently overridden (`apply.ts:229-241`). The same rule applies to the numeric floors: an
unpopulated floor would make the batch, stipend, and ctc gates pass everything.

---

## 4. Output formats

| Format | Use | Guarantee |
|---|---|---|
| `json` | Scripts, agents, the TUI | One JSON document on stdout. Stable top-level shape. |
| `table` | Humans | Fixed column set, stable ordering |
| `plain` | Piping, grep | One record per line, no decoration |

**Rules.**

- `json` output goes to stdout; errors go to stderr. A consumer can parse stdout without
  filtering.
- `table` output includes the per-source notes and the run summary, so a human sees why a board
  is missing rows (`cli.ts:46-49`).
- `plain` output is empty-safe: an empty result prints `No matches.` rather than nothing
  (`cli.ts:44`, `cli.ts:46`).
- **No output format ever invents a value.** An absent location is empty in `table` and `null` in
  `json` — the same fact, rendered appropriately.

---

## 5. Exit codes

| Code | When |
|---|---|
| 0 | The operation completed and produced a usable result |
| 1 | The operation failed, or produced nothing when something was expected |

**The empty-result rule.** "The board has no postings" is a success. "Every board failed" is a
failure. A command that cannot distinguish these is lying to its caller.

`applyos apply --batch` is the reference implementation: it builds packs sequentially in file
order, isolates each entry (a bad entry becomes a row, not an abort), and exits 0 when at least
one pack was built and 1 when none was (`cli.ts:246-248`).

---

## 6. Progress and interactivity

- The CLI prints a summary line at the end of a table run: `total=… truncated=… elapsedMs=…`.
- The CLI **never prompts**. It does not ask for confirmation, does not read from stdin, and does
  not open a pager. Anything requiring human judgement is the agent's job.
- Long-running commands may print progress to stderr; stdout stays parseable.

---

## 7. The `doctor` command

**`IMPLEMENTED`** (Phase 1, 2026-11-13) — `applyos/apps/cli/src/doctor.ts`.

The single most useful command for a new user, and the answer to "why does nothing work".

```
applyos doctor
```

| Check | Reports |
|---|---|
| `bun` | Version; warn if it differs from `applyos/.bun-version` |
| `python` | Version; warn below 3.10 |
| `lualatex` | Present? Version? Warn if `moderncv` is missing |
| `pdftotext` / `pdfinfo` | Present? (or `pypdf` importable) |
| `applyos` install | Workspace links resolvable? `bun install` needed? |
| Provider CLIs | Which of the 12 have `node_modules`? Which typecheck? |
| Workspace | `input/`, `output/`, `workspace/` present and writable? |
| Profile | Present? Which stage? Which document type? |
| Salary data | `salary_data.json` present? |
| Privacy | Is the git remote public? (warn: use a private repo) |

Exit 0 when every required check passes; exit 1 when a required check fails, listing them.

---

## 8. Naming conventions

| Element | Convention | Example |
|---|---|---|
| Commands | Lowercase, one word | `scrape`, `rank`, `apply` |
| Flags | Lowercase, `--kebab-case` | `--grad-year`, `--max-pages` |
| Short flags | `q`, `l`, `n`, `-h` only | |
| Error codes | Lowercase, kebab, stable | `invalid-format`, `batch-file` |
| Provider ids | Lowercase, board name | `naukri`, `weworkremotely` |
| Tracker columns | Lowercase, underscore | `contact_person`, `fit_rating` |
| Tracker statuses | Lowercase, underscore | `no_response`, `offer_declined` |

---

## 9. Portability

| Platform | Constraint | Evidence |
|---|---|---|
| Windows | `pdftotext` needs Poppler; PowerShell differs from bash | CI runs a `windows-latest` leg for both the Python suite and the engine |
| macOS | Same Poppler requirement | CI runs a `macos-latest` leg |
| Linux | The reference environment | CI runs `ubuntu-latest` |

**The known portability gap.** `09-web-research.md:51,68` and `add-template.md:114,135` use POSIX-only
`cd "$SCRATCHPAD" && curl` retry patterns — audit finding T-M4, recorded as **not yet fixed** in
the 2026-10-09 audit. Phase 11 addresses it.

**Runtime version pinning.** `applyos/.bun-version` pins **1.4.3**; CI installs from that file.
A local Bun of a different patch version will warn via `doctor` but will still run.
