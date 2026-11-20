# Implementation Status Ledger

> **Purpose:** one authoritative table of what ApplyOS actually does today, with evidence.
> Every row was verified against the repository at commit `78813db` on **2026-11-13**.
> **Rule:** nothing is claimed here that was not read in source, exercised by a test, or
> observed in a local run.

## Legend

| Marker | Meaning |
|---|---|
| `IMPLEMENTED` | Exists, covered by tests, behaves as described |
| `PARTIAL` | Exists with a stated limitation |
| `PROPOSED` | Designed in this blueprint; not built |
| `EXPERIMENTAL` | Built but unstable; no CI guarantee |
| `DEPRECATED` | Present, scheduled for removal |
| `UNKNOWN` | Not verified — see [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) |

**Verification commands used for this ledger** (all run locally on 2026-11-13):

```
python -m unittest discover -s tests -t .          → 526 pass, 1 skipped
cd applyos && bun run test                        → 196 pass, 0 fail (23 files)
cd applyos && bun run --filter "*" typecheck       → 6/6 exit 0
bun run test (in each .agents/skills/*/cli)       → 12/12 suites, 0 fail
python tools/lint_skills.py                       → OK (34 skills, 12 commands)
python tools/security_guards.py                   → OK
python tools/check_links.py                       → OK
python tools/check_framework_version.py           → OK
```

---

## 1. Workflow commands

Twelve canonical specs in `.claude/commands/`, plus one skill-backed command
(`/scrape` lives in `.claude/skills/job-scraper/SKILL.md`). All are `IMPLEMENTED` as
specifications; **none has a machine-checked conformance test**, which is the gap Phase 8
closes.

| Command | Canonical spec | State | Reads | Writes | Notes |
|---|---|---|---|---|---|
| `/setup` | `.claude/commands/setup.md` | `IMPLEMENTED` | `input/**`, `output/applications/*/`, 6 profile files | `CLAUDE.md`, profile files `01,02,04,05,07`, both stock `.tex`, `search-queries.md`, `salary_data.json` | Three paths (A/B/C) converge on Step 3. Read-before-write and idempotent. Skips profile file `06` |
| `/scrape` | `.claude/skills/job-scraper/SKILL.md` | `IMPLEMENTED` | `workspace/seen_jobs.json`, tracker, `search-queries.md`, every `.agents/skills/*/SKILL.md` | `workspace/seen_jobs.json` | 12-step flow. Portal set is derived from `market:` × `stage:`. Health check may only toggle `enabled:` |
| `/rank` | `.claude/commands/rank.md` | `IMPLEMENTED` | tracker (read-only), `04-job-evaluation.md`, `01-candidate-profile.md` | `workspace/seen_jobs.json` **via `tools/rank_state.py` only** | 5 steps. 4-dimension model-weighted scoring with stage weights. Verdict bands 75+/60-74/45-59/30-44/&lt;30 |
| `/apply` | `.claude/commands/apply.md` | `IMPLEMENTED` | 04/01/03/05/02 profile files, `templates/cv-stock/*`, `output/research/*.json`, tracker | `output/cv/main_*`/`resume_*` (+`.pdf`), `output/research/<company>.json`, tracker row, `output/applications/<company>_<role>/job_posting.md` | Drafter→Reviewer→Drafter→mandatory compile. Page budget: resume exactly 1 page, CV exactly 2 (1 for student/fresher) |
| `/interview` | `.claude/commands/interview.md` | `IMPLEMENTED` | archive files, `output/cv/*`, tracker, `output/research/*.json` | `output/applications/<company>_<role>/interview_prep_<stage>.md` | 6-section prep pack. Prep must not contradict submitted documents |
| `/outcome` | `.claude/commands/outcome.md` | `IMPLEMENTED` | tracker, archive, `output/cv/*` | tracker `status`/`notes`/`date`, archive `cv_draft.tex`, `job_posting.md`, `outcome.md`, `followup_YYYY-MM-DD.md` | Canonical status vocabulary (9 spellings). Follow-ups draft only, max two |
| `/expand` | `.claude/commands/expand.md` | `IMPLEMENTED` | `01`, `02`, `input/**` | `01-candidate-profile.md`, `02-behavioral-profile.md` | Additive only; source-traceable; user confirms before write |
| `/gmail-sync` | `.claude/commands/gmail-sync.md` | `PARTIAL` | tracker, `workspace/gmail_sync/state.json` | tracker `status`/`notes`, `outcome.md` checkboxes | **Requires a Gmail MCP server.** Nothing written before explicit approval. No fallback exists if the MCP is absent |
| `/html-report` | `.claude/commands/html-report.md` | `IMPLEMENTED` | tracker, `output/applications/*/outcome.md` | `output/reports/application-dashboard.html` | Pure read→write. Self-contained: inline SVG, no network requests |
| `/notion-sync` | `.claude/commands/notion-sync.md` | `PARTIAL` | `seen_jobs.json`, tracker, `workspace/notion_sync.json` | `workspace/notion_sync.json` + the Notion database/pages | **Requires a Notion MCP server.** One-way; CVs sync as filenames only |
| `/add-portal` | `.claude/commands/add-portal.md` | `IMPLEMENTED` | `linkedin-search` as reference, target portal | `.agents/skills/<name>/**` | Scaffolds a provider CLI to the portal-skill contract. Mandatory live test run before registration |
| `/add-template` | `.claude/commands/add-template.md` | `IMPLEMENTED` | `templates/**/TEMPLATE.md`, user files | `templates/cv/<name>/**` or `templates/resume/<name>/**`, managed block in `05-cv-templates.md` | Mandatory test compile before activation. Exactly one managed block per document type |
| `/reset` | `.claude/commands/reset.md` | `IMPLEMENTED` | profile files, `input/**` | profile files (restored), `input/*` deleted | Destructive. Requires typing `RESET` in caps |

---

## 2. Methodology skills

| Skill | Path | State | Purpose |
|---|---|---|---|
| Job Scraper | `.claude/skills/job-scraper/` | `IMPLEMENTED` | Portal discovery, dedupe, fit assessment, referral links, health check |
| Job Application Assistant | `.claude/skills/job-application-assistant/` | `PARTIAL` | 8 numbered files (`01,02,03,04,05,07,08,09`). **No `06-*.md`** — the sequence skips 06 and the reason is not recorded anywhere in the repo |
| Job Description Analyzer | `.claude/skills/job-description-analyzer/` | `IMPLEMENTED` | JD decomposition, used by `/rank` |
| Resume Tailor | `.claude/skills/resume-tailor/` | `IMPLEMENTED` | Tailoring rules, read by `/apply` |
| Tech Resume Optimizer | `.claude/skills/tech-resume-optimizer/` | `IMPLEMENTED` | Technical-role formatting guidance |
| Interview Prep Generator | `.claude/skills/interview-prep-generator/` | `IMPLEMENTED` | STAR answer construction, read by `/interview` |
| Application Form Filler | `.claude/skills/application-form-filler/` | `IMPLEMENTED` | Form-field guidance, read by `/apply` |
| Offer Comparison Analyzer | `.claude/skills/offer-comparison-analyzer/` | `IMPLEMENTED` | Offer evaluation, read by `/outcome` |
| Salary Negotiation Prep | `.claude/skills/salary-negotiation-prep/` | `IMPLEMENTED` | Negotiation guidance, read by `/outcome` |
| Upskill | `.claude/skills/upskill/` | `IMPLEMENTED` | Skill-gap analysis and learning plan |

---

## 3. Runtime adapters

| Runtime | Adapter | State | Evidence |
|---|---|---|---|
| OpenCode (reference) | `.opencode/command/*.md` (13 files) | `IMPLEMENTED` | Each is a 7-line thin pointer to a canonical spec |
| Claude Code | `.claude/` native + `.claude/settings.json` | `IMPLEMENTED` | 23-entry Bash allowlist |
| Codex CLI | `AGENTS.md` routing table + `.codex/agents/*.toml` | `IMPLEMENTED` | Adapter is a routing table, not a command set |
| Antigravity | `.agents/skills/` auto-discovery | `IMPLEMENTED` | No dedicated adapter directory; discovery is native |
| ZCode | `AGENTS.md` routing table | `PARTIAL` | **`PROJECT_MAP.md:82` lists a `.zcode/` folder that does not exist on disk.** ZCode currently relies on the routing table alone |
| FreeBuff / other | `AGENTS.md` | `IMPLEMENTED` | No adapter needed |

**Deprecated:** `.codex/agents/gemini-research-expert.toml`, `.opencode/agent/gemini-research-expert.md`,
`.claude/agents/gemini-research-expert.md` — marked `DEPRECATED 2026-10-10`; the `gemini -p`
binary it shells out to was removed on 2026-10-07. Retained as a record; a test keeps the three
copies in sync.

---

## 4. Provider CLIs

Twelve CLIs under `.agents/skills/*-search/cli/`. Every one is zero-runtime-dependency, Bun +
TypeScript, and satisfies the portal-skill contract.

| Provider | Tests | Board coverage | Notes |
|---|---|---|---|
| `naukri-search` | 46 | India, experienced professionals | Bot-gated; `search-queries.md` prescribes a `site:naukri.com` WebSearch fallback |
| `internshala-search` | 35 | India, internships + fresher | Location-driven |
| `unstop-search` | 30 | India, campus hiring | **Migrated onto the provider SDK** — `applyos/packages/provider/src/unstop.ts`; its engine adapter was using Unstop's thin listing, which does not filter |
| `wayup-search` | 24 | US, early career | **Ships disabled** (`enabled: false`) for the India edition |
| `wellfound-search` | 26 | Global startup/jobs | |
| `linkedin-search` | 87 | Global | Personal-use-only ToS warning; the reference implementation for `/add-portal` |
| `remoteok-search` | 36 | Remote global | **Migrated onto the provider SDK** — the board's implementation is `applyos/packages/provider/src/remoteok.ts`; this CLI is a surface over it |
| `remotive-search` | 21 | Remote global | **Migrated onto the provider SDK** — `applyos/packages/provider/src/remotive.ts` |
| `weworkremotely-search` | 28 | Remote global | |
| `freehire-search` | 76 | Aggregator | **Migrated onto the provider SDK** — `applyos/packages/provider/src/freehire.ts` |
| `cutshort-search` | 30 | India, startup | |
| `careers-search` | 56 | 8 ATS connectors | The company-portal scraper; see [COMPANY_PORTAL_SCRAPER.md](./COMPANY_PORTAL_SCRAPER.md) |

**Shared plumbing:** `.agents/skills/cli-shared/src/{errors,flags,entities,text}.ts` — imported by
relative path, never published. `flags.ts` encodes four distinct tokenizer modes because
negative-number semantics genuinely differ per CLI.

**The provider SDK** (`applyos/packages/provider/`) is the next layer up: one implementation per
board, exposed through two thin surfaces — the CLI and the engine. `remoteok` is migrated onto it;
the other boards are not yet. See
[architecture/adr/0008-single-provider-implementation.md](./architecture/adr/0008-single-provider-implementation.md)
and [design/provider-sdk.md](./design/provider-sdk.md).

---

## 5. Engine (`applyos/`)

| Package | State | Notes |
|---|---|---|
| `apps/cli` | `IMPLEMENTED` | `applyos scrape \| rank \| apply [--batch]`. `cli.ts:251-256` is the dispatch |
| `packages/core` | `IMPLEMENTED` | `types.ts` (`JobPosting`, `SearchMeta`, `SourceNote`, `CandidateStage`), `fetch.ts` (20 s timeout, 1 retry, body-read race, 300 ms pacing, UA `applyos/0.1 (personal use)`), `robots.ts`, `dedupe.ts` (URL normalisation + requisition-spread collapse), `format.ts`, `stages.ts`, `guards.ts`, `cli-args.ts` |
| `packages/company-scraper` | `PARTIAL` | 5 connectors (amazon, greenhouse, lever, smartrecruiters, workday) + `registry.yaml` with **7 seeded companies**. Verified live: groww, cred, Freshworks, jiostar |
| `packages/provider` | `IMPLEMENTED` | The provider SDK. One implementation per board behind a typed interface; zero runtime dependencies; `ProviderError` with the shared vocabulary; a reusable `contractSuite`. `remoteok`, `remotive`, `freehire` and `unstop` are implemented; `weworkremotely` is not yet |
| `packages/portals` | `PARTIAL` | 6 adapters. `remoteok.ts`, `remotive.ts`, `freehire.ts` and `unstop.ts` are now thin surfaces over the SDK. `arbeitnow.ts` is EU-only and has no provider-CLI counterpart |
| `packages/matching` | `IMPLEMENTED` | 7 gates (`gates.ts`) + 3-factor scoring (`score.ts`: skill 0.4–0.5, title 0.3–0.35, freshness 0.2–0.25) |
| `packages/docgen` | `IMPLEMENTED` | Builds the pack: resume Markdown, pitch, follow-up, gaps, claim traces |

**Known engine gaps:**

| Gap | Evidence | Phase |
|---|---|---|
| Engine is not reachable from any workflow spec | No `.claude/commands/*.md` references `applyos` | 2 |
| One board still implemented twice (provider CLI **and** engine adapter) with different contracts | `weworkremotely` — `remoteok`, `remotive`, `freehire` and `unstop` are migrated | 4 |
| Engine scoring (3 factors) diverges from spec scoring (4 dimensions) | `score.ts:15-19` vs. `rank.md` stage-weight table | 5 |
| Engine score bands (70/45) differ from spec bands (75/60/45/30) | `score.ts:61` vs. `rank.md` Step 3 | 5 |
| Engine has no tracker or archive writer — `/apply` does that | `apply.ts` writes only the pack | 7 |
| Engine `apply` produces Markdown, not a PDF | `docgen/pack.ts` returns `resumeMarkdown` | 6 |
| Engine has no evaluation harness | no `evals/` directory exists | 9 |
| `bun test` fails on a fresh clone until `bun install` runs | `Cannot find module '@applyos/core'` | 1 |
| Local Bun 1.4.2 vs pinned `applyos/.bun-version` 1.4.3 | version mismatch | 1 |
| Engine `profile.json` format is ad-hoc; `gates.ts:34` says "file wiring lands in Phase 5" | `apply.ts:123-153` implements a JSON reader; the docstring is stale | 6 |

---

## 6. Python tooling

| Tool | State | Purpose |
|---|---|---|
| `tools/rank_state.py` | `IMPLEMENTED` | `candidates` / `sweep` / `apply`; keeps `seen_jobs.json` out of the model context. Encodes `WEIGHTS` + `STAGE_WEIGHTS` (`rank_state.py:54-60`) mirroring `04-job-evaluation.md` |
| `tools/security_guards.py` | `IMPLEMENTED` | Allowlist parity, blanket-grant refusal, `defaultMode` check, gitignore rules, nested-`.gitignore` negation review, manifest scan over `.agents/**` **and** `applyos/` |
| `tools/verify_pdf.py` | `IMPLEMENTED` | Page count, text-layer extraction (pypdf → Poppler), `--contains`, `--check-ats` |
| `tools/lint_skills.py` | `IMPLEMENTED` | 34 skills, 12 commands, `settings.json` |
| `tools/check_links.py` | `IMPLEMENTED` | Links, spec paths, `cd` targets, referenced tools, Mermaid sanity. Wired into CI as the `docs` job |
| `tools/spec_parity.py` | `IMPLEMENTED` | Compares the spec, the tooling, and the engine. Wired into CI as a step in the `lint` job |
| `tools/robots_check.py` | `IMPLEMENTED` | robots.txt evaluation; fail-closed on orphan blocks |
| `tools/check_framework_version.py` | `IMPLEMENTED` | `framework_version` marker drift |
| `tools/convert_salary_excel.py` | `IMPLEMENTED` | Salary spreadsheet → JSON |
| `salary_lookup.py` | `PARTIAL` | Root-level. Requires `salary_data.json`, which **does not exist** in this checkout (only `salary_data.example.json`) |

### Phase 1 additions

| Artefact | State | Purpose |
|---|---|---|
| `applyos/apps/cli/src/doctor.ts` | `IMPLEMENTED` | The `applyos doctor` command — 14 checks over the toolchain, the workspace, the profile, and the git remote. Offline by default; `--check-remote` is the only flag that reaches the network |
| `scripts/bootstrap.sh` | `IMPLEMENTED` | One-command setup and verification. Idempotent; never touches `input/`, `output/`, or `workspace/` |
| `scripts/bootstrap.ps1` | `IMPLEMENTED` | The same flow for PowerShell |
| `tools/check_links.py` | `IMPLEMENTED` | The CI gate that catches documentation drift — including the `cd cv` class (audit D-B1) |
| `tests/test_check_links.py` | `IMPLEMENTED` | 23 tests: every check is proven to fire on a deliberate violation |
| `tests/test_bootstrap_scripts.py` | `IMPLEMENTED` | 11 tests over the bootstrap scripts |

### Phase 2 additions

| Artefact | State | Purpose |
|---|---|---|
| `applyos/packages/core/src/contract.ts` | `IMPLEMENTED` | The shared contract as data — the field names and shapes each boundary uses. The three shapes differ on purpose: the provider result says `date`, the engine row `postedDate`, the seen store `posted_date` |
| `applyos contract` | `IMPLEMENTED` | Publishes that contract so the spec layer reads the shapes instead of guessing them |
| `tools/spec_parity.py` | `IMPLEMENTED` | Compares the spec, the tooling, and the engine. The tooling must match the spec **exactly**; the engine's differences must all be listed in `docs/parity-known-differences.json` |
| `docs/parity-known-differences.json` | `IMPLEMENTED` | The manifest. A new difference fails; a listed difference that no longer occurs also fails — the list may only get shorter |
| `tests/test_spec_parity.py` | `IMPLEMENTED` | 14 tests, including one that changes the spec in a scratch copy and proves the harness fires |
| `tests/test_contract_shapes.py` | `IMPLEMENTED` | 8 tests: the fixture round-trips through the real writer, and every key it writes is documented |
| `tests/fixtures/seen_jobs.json` | `IMPLEMENTED` | A seen store **generated by the real writer**, so the format is provably current |
| The Stage Profile's `engine:` line | `IMPLEMENTED` | `off` (default) · `shadow` · `on` — how much of the search the engine runs |

**What the parity harness established.** The **Python tooling already matches the spec exactly**
— `rank_state.py`'s `STAGE_WEIGHTS` and `BANDS` match `rank.md`'s stage table value for value.
The **engine is the outlier**: it scores 3 factors where the spec scores 4 dimensions, has 3
bands where the spec has 5, and is missing the eligibility, notice-period, and timezone-overlap
gates. That answered Q2 by evidence rather than preference.

### Phase 3 additions

| Artefact | State | Purpose |
|---|---|---|
| `framework/scoring.json` | `IMPLEMENTED` | **The canonical scoring tables** — dimensions, stage weights, bands, and the gate definitions. One file, read by the spec layer (as the reference), the Python tooling, and the engine |
| `applyos/packages/core/src/scoring.ts` | `IMPLEMENTED` | The engine's reader for the canonical tables, plus `bandFor()` and `gateRunsFor()` |
| `applyos/packages/core/src/errors.ts` | `IMPLEMENTED` | The error vocabulary. Every code either layer can emit, with its meaning, its layer, and its retryability |
| `applyos/packages/core/src/state.ts` | `IMPLEMENTED` | The seen-store contract: the format, `schemaVersion`, the legacy-location migration, and an atomic write |
| `tools/rank_state.py compact` | `IMPLEMENTED` | The answer to Q9. Drops entries that can never come back; dry-run by default |
| `tests/test_error_vocabulary.py` | `IMPLEMENTED` | Scans every source file for emitted codes and asserts each is registered |
| `tests/test_state_contract.py` | `IMPLEMENTED` | 12 tests over the compaction rule and the state contract |
| `applyos/packages/core/tests/framework.test.ts` | `IMPLEMENTED` | 20 tests over the three new core modules |

**Why the canonical file lives at the repository root.** The `python-tests` CI job installs
**no Bun** — so the Python tooling must read it with the standard library alone. Putting it at
the root makes it framework content rather than engine content, and both layers read it by
path. The spec markdown stays the **reference**: `tools/spec_parity.py` compares the markdown
against the data and fails if they disagree, so the data cannot drift from the spec unnoticed.

**What changed in behaviour.** None. The Python tooling's 33 tests pass unchanged — it now reads
the same numbers from a file instead of hard-coding them.

---

## 7. Infrastructure

| Item | State | Notes |
|---|---|---|
| CI | `IMPLEMENTED` | `.github/workflows/ci.yml`: **11** jobs (lint, security-guards, **docs**, python-tests, dependency-review, latex-smoke, latex-smoke-bookworm, discover-clis, cli-checks, applyos-checks, placeholder-integrity). Actions pinned to commit SHAs; `permissions: contents: read` |
| Python test matrix | `IMPLEMENTED` | ubuntu + windows + macos, Python 3.12 only |
| Engine CI matrix | `IMPLEMENTED` | Same 3 OSes, `bun run test` + `bun run --filter "*" typecheck` |
| Portal CLI CI | `IMPLEMENTED` | Matrix **discovered** from `.agents/skills/*/cli/package.json`, so `/add-portal` additions are picked up automatically |
| LaTeX smoke | `IMPLEMENTED` | Two legs: `texlive-latest` (every push) and `debian-bookworm` / TeX Live 2022 (weekly + dispatch only) |
| Placeholder integrity | `IMPLEMENTED` | Template repo only — asserts `[YOUR_NAME]`, `[your.email@example.com]` etc. survive |
| Dependency review | `IMPLEMENTED` | Probes the dependency graph and **skips gracefully** when unavailable |
| Live portal testing in CI | `IMPLEMENTED` (as a prohibition) | Seven suites previously spawned the real CLI; now gated behind `APPLYOS_LIVE_TESTS` |
| Release process | `PARTIAL` | `CHANGELOG.md` follows Keep a Changelog with an `[Unreleased]` section; there is **no tag/release automation** in `.github/workflows/` |
| Versioning | `PARTIAL` | `framework_version` markers on methodology files; `applyos/package.json` is `0.1.0` and unpublished |
| Link checking | `IMPLEMENTED` | `tools/check_links.py`, run by the CI `docs` job |
| One-command setup | `IMPLEMENTED` | `scripts/bootstrap.sh` / `scripts/bootstrap.ps1` |

---

## 8. Local environment gaps (this machine, 2026-11-13)

These are **environment** gaps, not repository defects. They blocked two CI legs locally.

| Tool | Present? | Blocks |
|---|---|---|
| `lualatex` | **No** | Local LaTeX smoke; `/apply` Step 5 |
| `pdftotext` / `pdfinfo` (Poppler) | **No** | PDF text extraction (pypdf is an alternative, also absent) |
| `pypdf` | **No** | `verify_pdf.py` text layer |
| Bun 1.4.3 | **No** (1.4.2 installed) | Pinned-version parity with CI |
| Python 3.12 | Yes | — |
| Git 2.55 | Yes | — |

---

## 9. Summary counts

| Category | `IMPLEMENTED` | `PARTIAL` | `PROPOSED` | `DEPRECATED` | `MISSING` |
|---|---|---|---|---|---|
| Commands (13 incl. `/scrape`) | 11 | 2 | 0 | 0 | 0 |
| Methodology skills | 9 | 1 | 0 | 0 | 0 |
| Runtime adapters | 5 | 1 | 0 | 1 | 0 |
| Provider CLIs | 12 | 0 | 0 | 0 | 0 |
| Engine packages | 5 | 2 | 0 | 0 | 0 |
| Engine commands | 5 | 0 | 0 | 0 | 0 |
| Python tools | 9 | 1 | 0 | 0 | 0 |
| Shared contracts | 4 | 0 | 0 | 0 | 0 |
| Infrastructure | 10 | 2 | 0 | 0 | 0 |
