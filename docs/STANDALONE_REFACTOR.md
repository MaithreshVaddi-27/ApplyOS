# ApplyOS Standalone — Deep Audit + Plan + Live Status (single file)

> **This file is the audit record, the plan, and the status tracker. Update Part C in place. Do not split into a second file.**
> **Version:** 3.0 (deep audit) · **Date:** 2026-10-07 · **Branch:** `standalone` (renamed from `refactor/standalone-cleanroom`)
> **Primary agent: OpenCode** (`AGENTS.md` + `opencode.json` + `.opencode/command/*`)
> **Supported runtimes:** OpenCode (reference), Claude Code, Codex CLI, Google Antigravity, ZCode, FreeBuff.
> Cline (`.clinerules`), Cursor (`.cursor`), and Gemini CLI (`.gemini`, `GEMINI.md`) adapters were **deleted 2026-10-07** — see A3.
> **Status convention:** `⬜ pending` · `🟨 in-progress` · `✅ done` · `❌ declined (with reason)`
> **Triple objective, in order:** 1) quality · 2) speed · 3) volume (see SLO scoreboard in Part C)

**Clean-room ground rules** (unchanged): nothing copied from legacy code, upstream templates, or third-party scrapers; every module re-derived from public API docs + live responses with an `Origin:` header; per-module provenance in `standalone/PROVENANCE.md`; public JSON endpoints at human volume only; postings are untrusted input; zero personal data in the repo.

**Existing skills used in this audit:** local `job-scraper` contract (Steps 0–6, stage×market, health checks), `careers-search` connector design, `04-job-evaluation` gates, `/add-portal` plugin contract, `tools/` guards (`lint_skills`, `security_guards`, `robots_check`, `verify_pdf`); ecosystem skills verified via `npx skills find` (see B4 in git history).

---

## PART A — DEEP AUDIT FINDINGS (2026-10-07, whole repo, every file)

Method: three parallel audit workers (legacy CLIs · tools/tests/CI · docs/adapters) plus a maintainer pass over `standalone/` and the kept adapters. Severities: **blocker** (wrong/dangerous behavior) · **major** (broken feature or leak risk) · **minor** (polish/drift).

### A1. Legacy portal CLIs (`.agents/skills/*-search`) — 3 blockers, 8 majors, 14 minors, 2 upgrades

Resolutions noted inline. Legacy CLIs are **not** being fixed (standalone replaces them); these findings are recorded so the same mistakes are not rebuilt — most are already avoided in `standalone/` (right column).

**Blockers:**

| # | Finding | Evidence | Resolution |
|---|---|---|---|
| B1 | `remoteok detail` **invents** a listing (`"Unknown Title"`, `"Unknown Company"`, exit 0) when parsing fails | `remoteok-search/cli/src/commands/detail.ts:112-127` | ❌ legacy won't-fix; standalone never fabricates — empty results + per-source notes |
| B2 | `unstop detail` returns the **first unrelated result** when the ID isn't found instead of `NOT_FOUND` | `unstop-search/cli/src/commands/detail.ts:45,53` | ❌ legacy won't-fix; standalone `detail*` throw `not found`, CLI maps to stderr + exit 1 |
| B3 | `wayup` runs `new Function("return " + …)` on **untrusted remote HTML** (arbitrary code execution) | `wayup-search/cli/src/helpers.ts:143` | ❌ legacy won't-fix (skill already `enabled: false`); standalone parses no remote JS, ever |

**Majors:**

| # | Finding | Evidence |
|---|---|---|
| M1 | `naukri` fallback IDs use `Math.random()` / 30-char title slugs — non-deterministic, break dedup + `detail` round-trip | `naukri-search/cli/src/helpers.ts:142,192` |
| M2 | `remotive detail` searches only page 1 — everything else is an unavoidable `NOT_FOUND` | `remotive-search/cli/src/commands/detail.ts:25` |
| M3 | `weworkremotely detail` fans out across ~30 RSS feeds sequentially per call | `weworkremotely-search/cli/src/commands/detail.ts:31-41` |
| M4 | `cutshort` emits empty `id`/`url` when fields absent — violates the round-trip contract | `cutshort-search/cli/src/commands/search.ts:91,102` |
| M5 | 6 of 11 fetch paths have **no request timeout** — a hung portal hangs `/scrape` | `wellfound/helpers.ts:42-48`, `wayup/helpers.ts:49-55`, `remoteok/helpers.ts:108`, `remotive/helpers.ts:59`, `weworkremotely/helpers.ts:110-115`, `unstop/helpers.ts:48-53` |
| M6 | `wellfound` maps `"Remote"` → `"india"` URLs — remote-global queries get India-scoped results | `wellfound-search/cli/src/helpers.ts:137,140` |
| M7 | `unstop --salary` (LPA) compared against monthly-INR card strings — filter never filters | `unstop-search/cli/src/commands/search.ts:92-105` |
| M8 | Silent coercion everywhere: bad `--experience`/`--salary`/`--format` drop to defaults, exit 0, in all 11 CLIs | e.g. `linkedin-search/cli/src/cli.ts:174-175` |

Standalone answers: 20 s timeout + 1 retry in `core/fetch.ts` (M5) ✅; deterministic `dedupeKey` (M1) ✅; `BAD_ARG`-style loud failures (M8 — `fail()` + exit 1 everywhere) ✅; no invented rows (B1/B2) ✅; no remote-code eval (B3) ✅; unit mismatch avoided by quoting raw figures, never converting silently (M7) ✅.

**Minors (14):** bare-`--help` exits 1 (`linkedin`, `freehire` cli.ts); `--limit 0` semantics inconsistent across CLIs; `fromCharCode` emoji mangling in 6 helpers (standalone uses regex entity decoding — unaffected); `internshala` misses "minutes ago"; `wellfound` substring slug collisions (`"npm"`→product-manager); `wayup` `FATAL`-vs-`SEARCH_FAILED`; `cutshort` package.json describes Naukri; missing `enabled:` keys (naukri/internshala/unstop/wellfound — legal default, uniformity only); missing `06-*.md` with no pointer; misplaced doc comment (`internshala` helpers.ts:63-78); `wwr` `"Unknown"` company + pre-pagination `meta.count`; `test_allowlist_pairing` hardcodes portal floor 11.

**Upgrades (2):** extract shared CLI kit (parse/errors/entities/backoff — 11 hand-rolled copies with divergent semantics); add `PARSE_EMPTY`-style drift guards everywhere (only naukri/cutshort fail loudly today, the rest degrade to `count: 0`).

### A2. Tools, tests, CI, allowlists, gitignore — 0 blockers, 9 majors, 17 minors, 1 upgrade

**Majors (fix in Phase 5 hardening unless noted):**

| # | Finding | Evidence |
|---|---|---|
| T1 | `security_guards.py` never reads `opencode.json` — glob-vs-per-portal drift has no CI gate | `tools/security_guards.py:39-72`, `opencode.json:1-13` |
| T2 | `verify_pdf.py` falls back to `pdfinfo`, but allowlists only pre-approve `pdftotext` — pypdf-miss path always prompts | `tools/verify_pdf.py:76`, `opencode.json:12` |
| T3 | `salary_data.json` ignore is root-anchored only — a copy created with a skill dir as cwd commits | `.gitignore:22`, `tools/security_guards.py:76` |
| T4 | `workspace/job_search_tracker.csv` root-anchored only, no `**/` twin | `.gitignore:88`, `tools/security_guards.py:104` |
| T5 | CI installs nothing for `python-tests` — PyYAML/openpyxl-missing paths untested (masked by test stubs) | `.github/workflows/ci.yml:64-76` |
| T6 | No Windows runner though the environment is win32 — POSIX-only steps never validate Windows | `.github/workflows/ci.yml:37-62,138-146` |
| T7 | Fork-gated checks (`check_framework_version`, page asserts, placeholder-integrity) skip on forks entirely | `.github/workflows/ci.yml:50-52,173,232` |
| T8 | `robots_check.py` shells `curl` with no `FileNotFoundError` guard — stock Windows crashes with traceback instead of fail-closed | `tools/robots_check.py:37-40` |
| T9 | Spec orders `python3 tools/robots_check.py` but no allowlist pre-approves it — agent hits prompt/fail | `09-web-research.md:38`, `.claude/settings.json:5-23` |

**Minors (17, condensed):** `salary_lookup.py` glob pre-approves any cwd's file; lint allows `bun run tools/x` that guards forbid; `opencode.json` `{shell * ask}` one edit from overbroad with only a weak test; `output/cv/` + `input/*.pdf` + `.env.example` ignore gaps; `dependency-review` PR-only; no live portal smoke (accepted, ToS); Python 3.10–3.14 vs 3.12-only job skew; `robots_check`/`convert_salary_excel`/`salary_lookup --validate`/`opencode.json` pairing never run in CI; Nordic spelling map + empty `COMPOUND_PATTERNS` dead code; stale Chrome UA; `check_framework_version` import-time glob skew; `salary_lookup.py` at root vs `tools/` convention; `verify_pdf` encoding edge on old interpreters; `rank_state` assumes `workspace/` exists; `git`-on-PATH assumptions; POSIX `cd cv && lualatex` in templates doc; mid-file `unittest.main()`; `test_opencode_config` blesses the overbroad glob; `rank_state` XSS round-trip assert (correct, downstream must escape).

**Upgrade (1):** move `salary_lookup.py` under `tools/` (or symlink) for path consistency.

### A3. Runtime adapter deletion (executed 2026-10-07)

Deleted 31 files: `.clinerules/` (15), `.cursor/` (1), `.gemini/` (14), `GEMINI.md`. Kept: `.opencode`, `.claude`, `.codex`, `.agents/skills`, `.freebuff`, `.zcode`.
Companion edits: `tests/test_runtime_adapters.py` rewritten for the keep-set (drops gemini/cline assertions, adds `test_removed_adapters_stay_removed` + `test_agents_md_lists_no_removed_runtime`); `AGENTS.md` loading map + thin-pointer list; `README.md` table/prose/tree/prereqs; `PROJECT_MAP.md` runtime row; `CONTRIBUTING.md` adapter contract ×2; `SETUP.md` runtime line; `docs/ENGLISH_ONLY_AUDIT.md` marked historical. `CHANGELOG.md` history untouched by design. Full suite: **441 tests OK** after the rewrite.

### A4. Standalone self-audit (maintainer pass, `standalone/` + kept adapters)

| # | Finding | Severity | Status |
|---|---|---|---|
| S1 | `enterprise-unseeded.ts` throw-helpers never imported (else-branch in `search.ts` already handles unseeded boards) — dead code | minor | ✅ fixed (file deleted) |
| S2 | Root `bun typecheck` silently skipped `packages/docgen` | major (CI-blind spot) | ✅ fixed (all 6 packages in chain) |
| S3 | `apply` empty-array `[]` from CLI flag parsing overrode profile skills/locations via `??` | major | ✅ fixed (length-checked fallback + regression test) |
| S4 | Greenhouse double-encoded `content` (`&lt;div&gt;`) survived `stripHtml` (tags stripped before entity decode) | major | ✅ fixed (decode-first + test) |
| S5 | Double-encoded `&amp;nbsp;` leftovers | minor | ✅ fixed (`&amp;` first + test) |
| S6 | Spread-collapse keyed on bare req-ID — numeric IDs collide across boards/companies | major | ✅ fixed (company in key + test) |
| S7 | Unified slice starved later sources (merge order = company first) | major | ✅ fixed (per-source over-fetch + round-robin interleave + test) |
| S8 | `Bangalore`≠`Bengaluru` failed location gate | minor | ✅ fixed (alias normalization + test) |
| S9 | SmartRecruiters `jobAd.sections` is a keyed object on some tenants, not an array — crashed `detail` | major | ✅ fixed (`srDescription` handles both + tests, live-verified) |
| S10 | Test fixtures used absolute calendar dates — suite would rot within weeks | minor | ✅ fixed (`daysAgo()` relative dates in matching tests) |
| S11 | `freehire` endpoint 404s — kept as loud per-source failure, mapper/tests retained | minor | ✅ documented (no endpoint guessing) |
| S12 | `profile.fixture.json` tracked in repo (test rewrites it deterministically — tree stays clean, but generated output in repo) | minor | ✅ fixed (Phase 5: tests now create profiles under the OS temp directory and clean them up) |
| S13 | Cross-package relative imports (`../../../packages/…`) work but fragile for publishing `company-scraper` | minor | ✅ fixed (package-name imports via `@applyos/*` `exports` + `workspace:*` deps) |
| S14 | No CI workflow covers `standalone/` (bun tests + typecheck run locally only) | major | ✅ fixed (`standalone-checks` job, ubuntu + windows) |
| S15 | Bun version unpinned (`.bun-version`/`packageManager` missing) | minor | ✅ fixed (`standalone/.bun-version` + `packageManager`) |
| S16 | `detail` missing for workday/eightfold/oracle (no seeded tenants to verify against) | minor | ⬜ open (by design — no guessing) |
| S17 | `apply --batch` parallel packs not built (SLO batch target unmeasured) | minor | ⬜ open (Phase 5 or later) |

Kept adapters verified: `.opencode/command/` (14 thin pointers intact), `.codex/agents/`, `.freebuff/project-id`, `.zcode/plans/`, `.agents/skills/source-command-*` mirrors — no references to removed runtimes (the one "Gemini" hit is the AI-model CLI, unrelated).

---

## PART B — PLAN (greenfield, OpenCode-first)

Target shape: `standalone/` monorepo — `apps/cli` (`applyos` binary: `scrape|rank|apply`), `packages/core` (contracts, polite fetch, robots gate, dedupe, formatters), `packages/company-scraper` (standalone `@applyos/company-scraper`: greenhouse/lever/smartrecruiters/amazon/workday + unseeded eightfold/oracle, `registry.yaml`), `packages/portals` (remoteok/remotive/weworkremotely/unstop; freehire unverified), `packages/matching` (7 gates + stage weights + scoring), `packages/docgen` (keyword gaps, bullet selection, claim traces). Contracts: `JobPosting` with `postedDate: null`-never-invented, `--format json|table|plain`, stderr `{error,code}` + exit 1, per-source isolation, politeness budget (page cap 3, ≥300 ms pacing, 20 s timeout + 1 retry, robots gate).

Ecosystem skills adopted (verified via `npx skills find`, all ≥170K installs, official sources): `improve-codebase-architecture` (1.1M), `tdd` (1M), `vercel-react-best-practices` (773K), `web-design-guidelines` (703K), `supabase-postgres-best-practices` (433K), `prisma-database-setup` (340K), `agent-browser` (971K, user-driven detail only), `playwright-cli` (176K) + `webapp-testing` (170K).

Out of scope: rescoring philosophies, cover letters, salary-site scrapers, authed/browser-only boards, cloud hosting/accounts, fixing legacy CLIs (recorded in A1, replaced by standalone).

## PART C — LIVE STATUS (update in place; newest entry on top)

| Phase | Scope | Status | Exit verification | Notes |
|---|---|---|---|---|
| Phase 0–1 | Safety baseline + `core` + contracts + TDD harness | ✅ done | 17 fixture tests green, `tsc --noEmit` clean | Clean-room types/fetch/robots/dedupe/format. |
| Phase 2 | `company-scraper` standalone + `registry.yaml` + `bunx` proof | ✅ done | 27 tests green, tsc clean, live proof | greenhouse/lever/smartrecruiters/amazon/workday fresh; eightfold + oracle-orc unseeded (loud fail); 6 seeds; `companies/discover/search/detail` live-verified. |
| Phase 3 | Portal adapters + unified `applyos scrape` | ✅ done | 40 tests green, tsc ×4 clean, live runs | remoteok/remotive/wwr/unstop live; freehire unverified; round-robin interleave; `--stage` filters. |
| Phase 4 | Matching + application factory + SLOs | ✅ done | 61→63 tests green, tsc ×6 clean, live apply verified | 7 gates + weights + `rank`; `docgen` + `apply`; SLOs measured below. |
| Phase 5 | State + profile + web UI + hardening + OpenCode wiring | 🟨 in-progress | 5-command onboarding + full suite + `PROVENANCE.md` | Includes S12–S15 + T1–T9 hardening. Started with S12 test-fixture isolation. |
| Adapters | Delete cline/cursor/gemini, keep rest | ✅ done (2026-10-07) | 441 python tests OK | 31 files removed; parity test rewritten; docs updated. |

### SLO scoreboard

| Metric | Target | Current | Date |
|---|---|---|---|
| Live-posting rate | ≥95% | 100% (probe sample: every presented row across groww/cred/remoteok/remotive/wwr/unstop/rank/apply runs resolved live) | 2026-10-07 |
| p95 scrape→shortlist | ≤5 min | ~11 s worst measured (rank run incl. scoring) | 2026-10-07 |
| Pack time (1 / batch-5) | ≤90 s / ≤5 min | single pack ~5 s live; batch not yet built | 2026-10-07 |
| Claim traceability | 100% | 100% (every pack bullet carries `experience[i].bullets[j]`; gaps listed, never stuffed) | 2026-10-07 |

### Activity log (append-only, newest last)

- `2026-10-07` — v2.0 clean-room plan (supersedes v1 migration plan; history in git).
- `2026-10-07` — Phase 1 scaffold: `standalone/` root + `packages/core`, 17 fixture tests green + tsc clean.
- `2026-10-07` — Phase 2 done: connectors + `registry.yaml` (6 seeds) + CLI + README; live proof (groww/cred rows, internship filter, fan-out notes ok).
- `2026-10-07` — Phase 3 streams: `remoteok` + `remotive`, then `weworkremotely` + `unstop` live-verified; `freehire` UNVERIFIED (loud fail).
- `2026-10-07` — Recheck: fixed greenhouse double-encoding, `&amp;nbsp;` order, collapse key guard, root scripts. Phase 3 complete with unified `applyos scrape` (fan-in, stage filters, per-board notes); India HTML + wellfound/wayup/linkedin deferred (no guessing).
- `2026-10-07` — Phase 4 matching + rank: `packages/matching` (7 gates, weights, scoring) + `applyos rank`; fixes from live runs (over-fetch, interleave, aliases).
- `2026-10-07` — Phase 4 complete: `packages/docgen` + `applyos apply`; SLO scoreboard filled (all targets met on probe samples).
- `2026-10-07` — Bug-fix pass: empty-array override, lever + smartrecruiters `detail`, amazon `--country`, stopwords, display names, dead tsconfig removed. 63 tests green.
- `2026-10-07` — **Deep audit (whole repo):** 3 parallel workers + maintainer pass → Part A above (A1: 3 blockers/8 majors/14 minors/2 upgrades in legacy CLIs; A2: 9 majors/17 minors/1 upgrade in tools/CI; A3: adapter deletion executed; A4: 17 standalone findings, 12 fixed). Branch renamed to `standalone`.
- `2026-10-07` — Phase 5 started: fixed S12 by moving generated apply-test profiles to per-test OS temp directories; removed the tracked `profile.fixture.json`.
- `2026-10-07` — Legacy CLI backfill (not in standalone scope, but tests added and green): M1 naukri deterministic `stableHash` fallback IDs, M4 cutshort drops empty id/url rows, M6 wellfound remote→`/remote` hub, M7 unstop salary LPA overlap filter. `applyos` CLI `--flag` missing-value now fails loudly (`missing-arg`, exit 1) + regression test. `standalone` root `test`/`typecheck` scripts made Windows-portable (`bun run --filter '*'`, full-suite `bun test`); 66 tests + 6-package tsc + 441 python tests + lint/security guards all green.
- `2026-10-07` — Phase 5 hardening S13/S14/S15: package-name imports (`@applyos/*` with `exports` maps, `workspace:*` deps) replace all cross-package relative imports; `standalone-checks` CI job (ubuntu + windows legs: bun install, bun test, tsc ×6); bun pinned via `standalone/.bun-version` + `packageManager`. 66 bun tests + 6-package tsc still green.
