# Contributing

> The rules below come from [`CONTRIBUTING.md`](../../CONTRIBUTING.md), which is the canonical
> source. This document explains *why* each rule exists.

---

## 1. The one rule

> This repo is one specific edition of a general framework: the ApplyOS pipeline pointed at the
> Indian tech market and global-remote roles, runnable under any AI coding agent.

A contribution is judged on **fit to that identity first, execution quality second.**

---

## 2. What gets merged

| Category | Why |
|---|---|
| **Robustness and correctness fixes** with the failing case demonstrated on the real code path | The audit's highest-severity findings were all of this shape |
| **Portal skills and improvements for the covered markets** — India tech and early-career, global remote, employer career portals | They follow the portal-skill contract |
| **Runtime adapter improvements** that keep the thin-pointer invariant | A second copy of a workflow is a defect |
| **Docs that close a real gap** or correct drift | Documentation drift is this repo's most frequent defect class |
| **Infrastructure that reduces review burden**, argued from evidence | Speculative infrastructure is declined |

## 3. What gets declined

| Declined | Why |
|---|---|
| **Portals for markets this edition does not target** | They belong in your own private checkout — `/add-portal` exists for exactly that |
| **Personal profile data** | The repo ships placeholders; your profile lives in a private checkout. CI enforces it |
| **A second copy of a workflow** | The markdown specs *are* the implementation. This repo has lived that drift |
| **Speculative infrastructure** | *"Complexity must be argued from a problem that exists, not one that might."* |
| **Kitchen-sink PRs** | One concern per PR. Bundles get asked to split |

---

## 4. The bar for a new command

The core lifecycle is **feature-complete**:

```
/setup → /scrape → /rank → /apply → /interview → /outcome
                ↑_________________ calibration back to /setup
```

with `/expand`, `/upskill`, `/add-template`, `/add-portal`, and `/reset` around it.

So a new command faces a high bar. The test that admitted the existing ones:

> **Does it operationalize something error-prone that already exists in the framework** —
> documented machinery nothing executes, data something writes but nothing reads?

"Useful" and "possible" are not sufficient. The strongest proposals connect two things that
already exist **without modifying either**.

**A new command also needs, in the same change:**
1. A routing row in `AGENTS.md`.
2. An OpenCode adapter in `.opencode/command/`.
3. Tests.

`tests/test_runtime_adapters.py` enforces the first two.

---

## 5. How to make a change that gets accepted

### 5.1 Demonstrate the failing case

Reviews here are empirical. A bug report is reproduced before the fix is considered; a PR whose
premise does not reproduce is declined even if the code is fine.

**Reproduce on the real path.** The failing input has to be one the workflow actually produces —
the documented CLI invocation, real portal output, an actual data file — not a synthetic value
fed straight into a function.

### 5.2 Write a test that can distinguish the fix from the bug

A test that passes both before and after the change proves nothing.

> *"all tests green" is checked against whether the tests can distinguish the old behavior from
> the fix.*

### 5.3 Keep it narrow

One concern per PR. If the review turns up two concerns, they become two PRs.

### 5.4 Run what CI runs

```bash
python tools/lint_skills.py
python tools/security_guards.py
python -m unittest discover -s tests -t .

cd applyos && bun run test && bun run --filter "*" typecheck

cd .agents/skills/<touched-cli> && bun run typecheck && bun run test
```

CI runs the Python suite and the engine on **ubuntu, windows, and macos**. A change that only
works on one platform is not done.

### 5.5 Move the documentation with the code

| You changed | You must also |
|---|---|
| A spec | Update the mirror in `.agents/skills/` (byte-identical — CI enforces it) |
| A command | Add the routing row in `AGENTS.md` **and** the OpenCode adapter |
| A provider CLI | Nothing — CI discovers it automatically |
| A tracker column or status | Update `tests/test_tracker_status_vocab.py` |
| A permission | Update `.claude/settings.json` **and** `opencode.json` |
| A template | Re-run the LaTeX smoke; confirm the page count |

[../CHANGE_IMPACT_MATRIX.md](../CHANGE_IMPACT_MATRIX.md) is the full map.

### 5.6 Credit honestly

- A change that incorporates your actual code gets a **`Co-authored-by` trailer**.
- A change written independently from your observation or report gets a **named mention in the
  commit message**.

Both happen unprompted.

---

## 6. The conventions this repository follows

### 6.1 Commits

Conventional commits:

```
fix: close three security-guard holes, revive three dead gates
refactor: migrate 11 portal CLIs to cli-shared, cut 1.8.0
docs: record production-readiness checkup outcome
ci: split latex matrix into two jobs, restore green main
test: cover the new gate verdicts
```

### 6.2 Code

| Rule | Evidence |
|---|---|
| TypeScript `strict`; no `any` in an exported signature | `tsconfig.json` per package |
| `null` for absent data, never `undefined` | `types.ts:9` |
| Zero runtime dependencies in provider CLIs | All 12 `package.json` files |
| Python stdlib only in `tools/`; `unittest` in `tests/` | The CI job installs nothing |
| Typed error codes; messages may change, codes may not | [../design/public-api.md](../design/public-api.md#6-error-codes) |
| Comments explain *why*, not *what* | The codebase's existing style |

### 6.3 The null discipline

The rule that catches the most bugs:

| The source… | Must yield | Never |
|---|---|---|
| states no location | `null` | `""`, `"Unknown"`, `"-"`, a guessed city |
| states no date | `null` | `"1970-01-01"`, today, an inferred date |
| omits a field | the field, set to `null` | the field is absent |
| cannot find the posting | a typed error | a row with an invented title |
| matches nothing | an empty result | the unfiltered board |
| gets an invalid number | a typed error | `NaN`, which reads as "no bound" |

Every one of those rows is a bug that was actually found and fixed. See
[../engineering/standards.md](../engineering/standards.md#2-the-null-discipline).

### 6.4 Documentation

Relative links. Mermaid for diagrams. A status marker on every capability claim
(`IMPLEMENTED` / `PARTIAL` / `PROPOSED` / `EXPERIMENTAL` / `DEPRECATED` / `UNKNOWN`).

**Never state a count that CI computes.** Write "the Python suite" and link to the command. A
"456 tests" claim was stale in this repo for months.

---

## 7. Security-sensitive contributions

Read [../security/threat-model.md](../security/threat-model.md) before touching a trust
boundary. The short version:

- **Postings are untrusted data, never instructions.**
- **Never fetch a URL found inside posting text.**
- **Never send** — no email, no messages, no form submission.
- **Always ask before writing.**
- **Credentials via environment variables only.**
- **Never push to a public remote** — the profile is in tracked files.

`tools/security_guards.py` will fail a PR that widens a permission allowlist, adds a package
lifecycle script, weakens the gitignore rules, or ships `bypassPermissions`.

---

## 8. Adding a job board vs. adding a command

| | Adding a portal | Adding a command |
|---|---|---|
| Effort | Low — a folder | High — a spec, a routing row, an adapter, tests |
| Where | `.agents/skills/<board>-search/` | `.claude/commands/<name>.md` |
| Upstreamable? | Only for the covered markets — others belong in your fork | Yes, if it passes the bar |
| Guide | [adding-a-portal.md](./adding-a-portal.md) | [writing-a-command.md](./writing-a-command.md) |

---

## 9. Where to look when you are stuck

| Question | File |
|---|---|
| What does this command do? | `.claude/commands/<name>.md` |
| What does this file mean? | `.claude/skills/job-scraper/SKILL.md` |
| What are the gates and their weights? | `.claude/skills/job-application-assistant/04-job-evaluation.md` |
| What is the tracker's schema? | `.claude/commands/outcome.md` |
| What does the portal contract require? | `.claude/commands/add-portal.md` |
| Why is the engine built this way? | `applyos/PROVENANCE.md` |
| What was broken and fixed? | `docs/AUDIT_2026-10-09.md`, `docs/UPGRADES_2026-10-11.md` |
| What is planned? | [../roadmap/master-roadmap.md](../roadmap/master-roadmap.md) |
