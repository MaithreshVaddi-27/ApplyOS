# ADR-0006: Every provider ships to one contract

**Date**: 2026-10-07
**Status**: accepted
**Deciders**: ApplyOS maintainers

## Context

ApplyOS reaches job boards through separate implementations. They differ in source format
(JSON API, RSS, HTML), in pagination, in field availability, in credential requirements, and in
how they fail.

Twelve provider CLIs already exist. They were written independently, which produced eleven
near-duplicate `writeError` helpers, four different flag tokenizers with genuinely different
negative-number semantics, and divergent table renderers. The 2026-10-09 audit recorded the
consequences as "majors": a `--format` typo coercing to `json` instead of failing, a `--jobage
abc` becoming `undefined`, a bare `--query` becoming the string `true` and silently dropping the
filter.

## Decision

Every provider implements **one contract**, defined in `.claude/commands/add-portal.md` and
enforced by the provider's own test suite.

**Commands.** `search` and `detail <id|url>`.

**Search flags.** `--query`/`-q`, `--location`/`-l` (optional), `--jobage <days>`, `--page <n>`,
`--limit <n>`, `--format json|table|plain` (default `json`).

**Success output** (stdout):

```json
{ "meta": { "count": 12, "page": 1 }, "results": [ … ] }
```

**Result fields.** `id`, `title`, `company`, `location`, `date`, `url`. **Missing values are
`null`, never omitted.** A source that does not state a location yields `null`, not `""` and
not `"Unknown"`.

**Failure output** (stderr):

```json
{ "error": "…", "code": "…" }
```

Exit code **1**. Errors never go to stdout. Known codes: `INVALID_FORMAT`,
`INVALID_SALARY`, `MISSING_CREDENTIALS`.

**Dependencies.** Zero runtime dependencies. `bun install` fetches TypeScript types for
typechecking only.

**Credentials.** Read only from an environment variable named `<SERVICE>_API_TOKEN`. Never a
flag, never hardcoded, never written to disk.

**Politeness.** Public or documented endpoints only. Backoff on 429/5xx. Volume kept human.

**Registration.** A provider is not registered until it has returned real results in a live test
run. `/add-portal` Step 4 enforces this.

## Alternatives Considered

### Alternative 1: One mega-CLI with a `--board` flag
- **Pros**: One binary, one install.
- **Cons**: One flag set cannot express twelve different boards' real options without
  conditionals everywhere. The audit's `--format` and `--jobage` findings would still occur, and
  would now affect every board at once.
- **Why not**: A shared flag vocabulary is not the same as a shared command surface.

### Alternative 2: A runtime plugin protocol (HTTP, WASM, or a binary protocol)
- **Pros**: Richer providers, potentially non-Bun implementations.
- **Cons**: A supply-chain surface, a protocol to specify, and a host to trust. A third-party
  provider process would run with the candidate's file access.
- **Why not**: The candidate's data is the trust boundary; the extension surface should be as
  small as possible. Phase 4 proposes extending the *contract*, not the *trust model*.

### Alternative 3: Let each provider define its own interface and adapt at the call site
- **Pros**: Total freedom per board.
- **Cons**: The 2026-10-09 audit found this produced nine majors and three blockers in twelve
  implementations. Silent wrong answers are the failure mode, and freedom is what produces them.
- **Why not**: Evidence, not preference.

## Consequences

### Positive
- A new board is a predictable amount of work with a predictable shape.
- `/scrape` can treat every provider identically, and a new one is auto-discovered.
- The contract is checkable: a test asserts the envelope, the null semantics, the error shape,
  and the exit code.
- The `cli-shared` module reduces duplication without flattening genuinely different behaviour:
  `flags.ts` encodes four tokenizer modes because the boards really do differ.

### Negative
- Some boards' real capabilities do not fit the common flags. The contract has an extension
  mechanism (a board's `SKILL.md` documents extra flags), but the core set stays small.
- A contract change ripples across twelve implementations. The CI matrix discovers them
  automatically, but the work is real.

### Risks
- **A contract change lands in one CLI only.** Mitigation: the CI matrix runs every discovered
  CLI; the shared module means most contract logic lives in one place.
- **A board genuinely needs a different error code.** Allowed: the codes are a set, not a closed
  enumeration, and the envelope is what must not change.
