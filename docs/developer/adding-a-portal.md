# Adding a Job Portal

> **The reference implementation is `linkedin-search`.** The scaffolder is `/add-portal`.
> **Status:** the CLI contract is `IMPLEMENTED`. The SDK-based flow is `PARTIAL` (Phase 4):
> `remoteok` has moved onto the provider SDK, and the other boards have not.

---

## 1. What you are building

A **provider CLI**: a small, self-contained Bun + TypeScript program that searches one job board
and returns a documented JSON envelope. It has **zero runtime dependencies**.

The candidate runs it; `/scrape` runs it; `/add-portal` scaffolds it.

**The board must not be one this edition already covers with a different implementation.**
Before you write anything, check:

```bash
ls .agents/skills/*-search/
```

If the board already exists, improve it rather than adding a second one. Duplication is exactly
the problem ADR-0008 exists to remove.

### 1.1 Two shapes of contribution

A board can be reached two ways, and the difference matters:

| | The board lives in | Who owns the parsing |
|---|---|---|
| **A CLI-only board** (today's default) | `.agents/skills/<board>-search/cli/src/helpers.ts` | The CLI |
| **An SDK board** (where the project is heading) | `applyos/packages/provider/src/<board>.ts` | The SDK, with the CLI as a thin surface over it |

An SDK board is reached by **both** the CLI and the engine, so a fix lands in both at once. That
is the whole point of ADR-0008: today five boards are implemented twice, and the copies drift.

`remoteok` is the first SDK board. It is the pattern to copy:
the implementation is in `applyos/packages/provider/src/remoteok.ts`; the CLI's `helpers.ts`
re-exports from it; the engine's `portals/src/remoteok.ts` is a surface that applies the engine's
row shape.

**For a new board, prefer the SDK shape.** A board that lives only in a CLI cannot be reached by
the engine, and a board that lives in both places needs two implementations kept in step.

---

## 2. The contract

### 2.1 Commands

```
bun run .agents/skills/<board>-search/cli/src/cli.ts search [flags]
bun run .agents/skills/<board>-search/cli/src/cli.ts detail <id|url> [--format json|table|plain]
```

### 2.2 Search flags

| Flag | Meaning |
|---|---|
| `--query`, `-q` | Keywords |
| `--location`, `-l` | Location (optional — some boards are location-driven, some are not) |
| `--jobage <days>` | Posted within N days |
| `--page <n>` | 1-indexed page |
| `--limit <n>` | Cap the results emitted (client-side) |
| `--format json\|table\|plain` | Default `json` |

A board may accept **extra** flags. Document them in the board's `SKILL.md` — `/scrape` reads it
to know what to pass. **Never invent a flag the SKILL.md does not document**: the spec says a
portal with no recency flag still gets scoped, but it must not be given a flag that does not
exist.

### 2.3 Success output — stdout

```json
{
  "meta": { "count": 12, "page": 1 },
  "results": [
    {
      "id": "12345",
      "title": "Backend Engineer",
      "company": "Acme",
      "location": "Bengaluru, India",
      "date": "2026-10-05",
      "url": "https://boards.example/acme/jobs/12345"
    }
  ]
}
```

| Rule | Detail |
|---|---|
| `meta.count` | **Equals `results.length`** |
| `meta.page` | The page actually returned |
| `id` | Stable within the board; round-trips through `detail` |
| `title`, `company` | As the source states them |
| `location` | `null` when the source states none — **never** `""`, `"Unknown"`, `"-"` |
| `date` | `null` when the source states none — **never** a guess or a placeholder |
| `url` | The posting's canonical URL |

### 2.4 Failure output — stderr

```json
{ "error": "Job board returned HTTP 503", "code": "HTTP_503" }
```

**Exit code 1. Never write errors to stdout.** A consumer that parses stdout must never have to
filter errors out of it.

### 2.5 Unknown flags

Reject loudly. A bare `--query` that parses to the string `"true"` and silently drops the filter
was the single most widespread bug in the 2026-10-09 audit — it was present in **all twelve**
CLIs.

### 2.6 Dependencies

**Zero runtime dependencies.** `bun install` fetches TypeScript types for typechecking and
nothing else.

```json
{
  "dependencies": {},
  "devDependencies": { "typescript": "^5.9.3", "@types/bun": "1.4.2" }
}
```

### 2.7 Credentials

Read **only** from an environment variable named `<SERVICE>_API_TOKEN`.

- Never a CLI flag.
- Never hardcoded.
- Never written to disk.
- If it is missing, write the standard stderr JSON error with code `MISSING_CREDENTIALS` and
  exit 1.

### 2.8 Politeness

- Public or documented endpoints only.
- Backoff on 429 and 5xx.
- Keep volume human. One fetch pass per run.
- Identify yourself honestly. Do not impersonate a browser to bypass a block.

---

## 3. The file layout

### 3.1 A CLI-only board

```
.agents/skills/<board>-search/
├── SKILL.md                  # the description /scrape reads
├── url-reference.md          # the parsing anchors
├── fonts/                    # optional, only if you need one
└── cli/
    ├── package.json
    ├── tsconfig.json
    ├── README.md
    ├── src/
    │   ├── cli.ts            # argument parsing + dispatch
    │   ├── helpers.ts        # board-specific parsing
    │   └── commands/
    │       ├── search.ts
    │       └── detail.ts
    └── tests/
        ├── helpers.ts        # shared fixtures
        └── *.test.ts
```

### 3.2 An SDK board (preferred)

The board's implementation moves into the SDK, and the CLI becomes a surface:

```
applyos/packages/provider/src/
└── <board>.ts                # the implementation - the only place that knows the board

.agents/skills/<board>-search/cli/
└── src/
    ├── cli.ts                # argument parsing + dispatch
    ├── helpers.ts            # re-exports from the SDK, by relative path
    └── commands/
        ├── search.ts         # a surface: flags in, envelope out
        └── detail.ts
```

The CLI reaches the SDK the way it reaches `cli-shared` — by relative path, five levels up:

```ts
export { myBoardProvider } from "../../../../../applyos/packages/provider/src/myboard.js";
```

The SDK has **zero runtime dependencies** and cannot import `@applyos/core`, so the provider
defines the candidate-stage type it needs locally rather than importing it.

**The engine** reaches the SDK as the `@applyos/provider` workspace package, and its adapter
keeps only the engine's row shape:

```ts
import { myBoardProvider } from "@applyos/provider";

export async function searchMyBoard(query: string, limit: number) {
  const page = await myBoardProvider.search({ query, limit });
  return { rows: page.rows.map(toJobPosting), truncated: page.truncated };
}
```

### 3.3 `SKILL.md`

`SKILL.md` needs a frontmatter block the `/scrape` spec reads:

```yaml
---
name: <board>-search
description: <one line, with the trigger words>
allowed-tools: Read, Bash(bun run .agents/skills/<board>-search/cli/src/cli.ts *)
---
```

### 3.4 `url-reference.md`

The parsing anchors, written down so the next maintainer can fix the parser without
re-deriving it:

- The search URL pattern.
- The result list container and how a single result is identified.
- Where each field lives in the markup.
- The detail URL pattern and the id extraction rule.
- The pagination shape.
- What "the posting is closed" looks like, if the board exposes it.

This file is **the reason** a board contribution survives. It is what the 2026-10-09 audit
called the reference for `linkedin-search`.

---

## 4. The tests

**Required. All offline. No network.**

| # | Test | Asserts |
|---|---|---|
| 1 | `search` returns the envelope | `meta.count === results.length`; the top-level keys are exactly `meta` and `results` |
| 2 | Missing fields are `null` | A fixture with an omitted location yields `location === null` — not `undefined`, not `""` |
| 3 | A malformed response throws | `code: "parse"`; it does **not** return an empty page |
| 4 | A network failure throws | `code: "network"`, `retryable: true` |
| 5 | A missing credential throws | `code: "credentials"`, exit 1 |
| 6 | An unknown flag is rejected | Non-zero exit; nothing on stdout |
| 7 | A valueless flag is rejected | Non-zero exit — not the string `"true"` |
| 8 | An invalid `--format` is rejected | `code: "INVALID_FORMAT"`, exit 1 |
| 9 | An invalid `--jobage` is rejected | Non-zero exit — not `undefined` |
| 10 | An out-of-range number is clamped or rejected | Per the flag's documented contract |

**The null test is the one that matters most.** Every provider's suite must have it.

### 4.1 For an SDK board

The SDK's `contractSuite` already asserts rules 1–4 and the row-shape rules for every provider,
so a board's own suite adds only what is specific to that board:

```ts
import { contractSuite } from "../src/contract.js";

contractSuite(createMyBoardProvider({ fetchImpl: fixtureFetch }), {
  fetchImpl: fixtureFetch(),
  knownRef: "123",
  expectedRows: 4,
});
```

Two more things an SDK board's suite must have:

- **The provider is constructed with its dependencies.** `createMyBoardProvider({ fetchImpl })`
  binds a fixture, so the test never reaches the board. The exported singleton is the production
  one.
- **The error code is the provider's.** A surface forwards `err.cliCode` rather than re-deriving
  the mapping, and `tests/test_error_vocabulary.py` scans the SDK, so a code the SDK names
  cannot slip through unregistered.

### 4.2 For a board being migrated

A migration's own test is a **parity** test against the implementation it replaces:

```ts
test("the SDK produces the same rows the CLI produced before the migration", async () => {
  const rows = await fetchMyBoardJobs({ fetchImpl: fixtureFetch });
  expect(rows).toEqual(EXPECTED);
});
```

`EXPECTED` is **captured from the old implementation**, not written by hand. A hand-written
fixture records what someone believed the old code did; a captured one records what it did.

---

## 5. The registration gate

> *"Never register a portal skill that has not returned real results."*

Before the board appears in a search:

1. `bun install` in the CLI directory.
2. `bun run typecheck`.
3. `bun run src/cli.ts search -q "<test query>" --limit 5 --format table` — **must return real
   rows.**
4. `bun run src/cli.ts detail <id> --format plain` — must return a real posting.
5. `bun run test` — green.

Then:

6. Optionally add a `site:` query line to
   `.claude/skills/job-scraper/search-queries.md` (the WebSearch fallback template).
7. Add the board to the **Market × Stage → portal sets** table in the same file.

**CI does the rest.** The `discover-clis` job finds every `.agents/skills/*/cli/package.json`,
and the `cli-checks` matrix typechecks and tests it. **You do not need to edit the CI workflow**
to add a board.

---

## 6. The checklist

- [ ] The board does not already exist under `.agents/skills/`
- [ ] `SKILL.md` has the right frontmatter and documents every flag
- [ ] `url-reference.md` records the parsing anchors
- [ ] `cli/package.json` has `dependencies: {}`
- [ ] `cli/src/cli.ts` rejects unknown and valueless flags
- [ ] Errors go to stderr as `{"error", "code"}` with exit 1
- [ ] Missing fields are `null`, never omitted and never a placeholder
- [ ] `meta.count === results.length`
- [ ] A malformed response throws rather than returning an empty page
- [ ] All ten required tests exist and are offline
- [ ] The live test returned **real rows**
- [ ] `search-queries.md`'s portal-sets table lists the board for the right market×stage pairs
- [ ] `bun run typecheck` and `bun run test` are green
- [ ] `python tools/lint_skills.py` is green

---

## 7. Legal and ToS

**Check the board's terms before you build the scraper.**

- A board that disallows automated access → **do not add it**. If the candidate wants it, it
  belongs in their private fork, and they run it at their own risk.
- A board that requires an account → the credential rules above apply, and the skill must carry
  a personal-use-only warning.
- A board behind a bot-gate (Naukri) → expect it to fail intermittently. Document the fallback.
- A board whose content may not be redistributed → **never commit a full posting as a test
  fixture.** Record a minimal, redacted excerpt instead. This is the same constraint Phase 9's
  corpus has.

`CONTRIBUTING.md`: *"Portal skills copied from third-party forks or sources outside this repository
are not covered by our security policy — read their code in full before running them."*

---

## 8. Shared plumbing

Use `.agents/skills/cli-shared/src/` rather than copying:

| Module | Exports | Use for |
|---|---|---|
| `errors.ts` | `writeError(message, code)` | The stderr envelope |
| `flags.ts` | `parseRawArgs(argv, aliases, mode)` | Argument parsing |
| `entities.ts` | `decodeHtmlEntities` | HTML entity decoding |
| `text.ts` | `slugify`, `sleep` | Small text helpers |

**`flags.ts` has four tokenizer modes**, and they encode **observed per-CLI behaviour**, not
preference:

| Mode | Rule | Used by |
|---|---|---|
| `none` | Any dash-led token is a flag | linkedin, unstop, freehire, internshala, naukri, remotive, wellfound |
| `int-only` | A dash-led token is a value when it is an integer | weworkremotely, remoteok, wayup |
| `cutshort` | `/^-\d/` tokens are values in both positions | cutshort-search |
| `careers` | A bare `-` is a positional; values allow `/^-?\d/` | careers-search |

Pick the mode that matches your board's observed behaviour. **Do not "simplify" the modes** —
changing one changes that CLI's behaviour for inputs its tests pin.

**Deliberately not shared.** `fetchWithBackoff` (retry semantics diverge per CLI and are pinned by
tests) and the table renderers (column widths are a per-CLI output contract).

---

## 9. What comes next

Phase 4 replaces the copy-paste scaffold with a **provider SDK**. The CLI contract stays exactly
as it is — that is the point. A contribution is still a folder with zero runtime dependencies;
only its internals change.

See [../design/provider-sdk.md](../design/provider-sdk.md).
