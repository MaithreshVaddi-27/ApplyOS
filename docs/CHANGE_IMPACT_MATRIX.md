# Change Impact Matrix

> **Purpose:** answer "if I change X, what else must change?" without reading the whole repo.
> **How to use:** find the row for the artefact you are changing, then follow the *Consumers*
> and *Gates* columns before opening a file.
> **Status of rows:** all rows were verified against `78813db` on 2026-11-13.

Legend for **Coupling**: `tight` (change breaks consumers silently) · `medium` (change breaks
consumers loudly) · `loose` (safe to change in isolation).

---

## 1. Canonical specification files (`.claude/`)

| Artefact | Consumers | Coupling | Gates that catch a break |
|---|---|---|---|
| `.claude/commands/setup.md` | `/reset` Step 4, `/outcome` Step 5, `/gmail-sync` Step 10 (all hand off to `/setup` Path A) | tight | `tests/test_setup_command.py`, `tests/test_reset_command.py` |
| `.claude/skills/job-scraper/SKILL.md` | `.opencode/command/scrape.md`, `/rank` (input), `/add-portal` Step 5 | tight | `tests/test_scrape_contract.py`, `tests/test_runtime_adapters.py` |
| `.claude/skills/job-scraper/search-queries.md` | `/scrape` Step 0.5, `/rank` Step 1, `/setup` Step 3.9, `/reset` Step 3 | tight | `tests/test_scrape_contract.py`, `tests/test_setup_command.py`, `tests/test_reset_command.py` |
| `.claude/commands/rank.md` | `/notion-sync` (reads ranked entries), `/scrape` Step 5 | tight | `tests/test_rank_command.py`, `tests/test_rank_state.py` |
| `.claude/commands/apply.md` | `/rank` Step 5, `/scrape` Step 5; drives `/outcome` + `/interview` | tight | `tests/test_apply_records_application.py`, `tests/test_document_types.py`, `tests/test_latex_guidance.py` |
| `.claude/commands/outcome.md` | `/interview` Step 5, `/gmail-sync` (status vocabulary), `/notion-sync`, `/html-report` | tight | `tests/test_outcome_followup.py`, `tests/test_tracker_status_vocab.py` |
| `.claude/commands/interview.md` | `/apply` Step 6, `/outcome` Step 6 | medium | `tests/test_apply_records_application.py` |
| `.claude/commands/html-report.md` | — | loose | `tests/test_html_report_command.py` |
| `.claude/commands/notion-sync.md` | — | loose | `tests/test_notion_sync_command.py` |
| `.claude/commands/gmail-sync.md` | — | medium | `tests/test_gmail_sync_command.py` |
| `.claude/commands/add-portal.md` | `/setup` Section 9 | medium | `tests/test_scrape_contract.py` |
| `.claude/commands/add-template.md` | `/apply` Steps 2 and 5 read the managed block it writes | tight | `tests/test_document_types.py`, `tests/test_latex_guidance.py` |
| `.claude/commands/reset.md` | — (points at `/setup`) | medium | `tests/test_reset_command.py` |
| `.claude/commands/expand.md` | — | loose | (none) |
| `.claude/skills/job-application-assistant/01-candidate-profile.md` | `/setup`, `/rank`, `/apply`, `/interview`, `/expand`, `/reset` | tight | `tests/test_placeholder_integrity.py`, `tests/test_setup_command.py`, `tests/test_reset_command.py` |
| `.../04-job-evaluation.md` | `/rank`, `/apply`, `/setup`, `/reset` | tight | `tests/test_rank_command.py`, `tests/test_reset_command.py` |
| `.../05-cv-templates.md` | `/apply`, `/add-template`, `/setup`, `/reset` | tight | `tests/test_latex_guidance.py`, `tests/test_document_types.py` |
| `.../07-interview-prep.md` | `/interview`, `/setup`, `/reset` | medium | `tests/test_setup_command.py`, `tests/test_reset_command.py` |
| `.../03-writing-style.md` | `/apply`, `/outcome` | medium | (none — read-only for specs) |

> **Note:** `06-*.md` does not exist in `job-application-assistant/`. `/setup` Step 3 and
> `/reset` Step 3 both enumerate the file list and neither references `06`. If a `06` file is
> ever introduced, both commands must be updated in the same change.

---

## 2. Portal CLIs (`.agents/skills/*-search/`)

| Artefact | Consumers | Coupling | Gates |
|---|---|---|---|
| A provider CLI's `cli.ts` | `/scrape` Step 1b (via the spec's documented flags) | tight | That CLI's own `bun run test`; the `cli-checks` CI matrix |
| A provider CLI's `SKILL.md` | `/scrape` Step 1b reads it for flags; the health check toggles `enabled:` | tight | `tests/test_scrape_contract.py` |
| `.agents/skills/cli-shared/src/*.ts` | 12 provider CLIs (relative imports) | tight | Every CLI suite; `tests/test_lint_skills.py` |
| `.agents/skills/cli-shared/src/flags.ts` | All 12 CLIs | **tight** | Every CLI suite. The tokenizer has **4 distinct modes** (`none`, `int-only`, `cutshort`, `careers`) that encode per-CLI negative-number semantics. Changing one mode changes one CLI's behaviour |
| `.agents/skills/cli-shared/src/errors.ts` | All 12 CLIs | tight | Every CLI suite. The stderr `{error, code}` shape and exit 1 are the contract |
| `.agents/skills/cli-shared/src/entities.ts` | 7+ CLIs | medium | LinkedIn (strictest) and careers (`&#x2F;`, `&#x3D;`) have different needs |
| `.agents/skills/cli-shared/src/text.ts` | internshala, naukri, wayup, cutshort | medium | Those four suites |
| A new provider skill | `/scrape` auto-discovery, CI `discover-clis` matrix | loose | Auto-detected — no workflow edit needed |
| `.agents/skills/<board>/cli/src/helpers.ts` (Phase 4) | That CLI's `commands/`, whose tests import only from helpers | **tight** — re-exports the SDK's board implementation by relative path | That CLI's suite plus a parity oracle captured from the pre-migration connector |
| `.agents/skills/careers-search/cli/src/connectors/*.ts` (Phase 4.7) | The CLI's 8 ATS boards | tight — thin surfaces over `packages/provider/src/*.ts` | 72 tests in `careers-search/cli/tests/` |

**Board ownership moved in Phase 4 (ADR-0008).** Each board's fetch, parse, query and url rules
live once in `applyos/packages/provider/src/<board>.ts`; these CLIs and the engine adapters are
surfaces over it. A change to a board's meaning goes in the SDK and is verified by both surfaces'
parity tests. The portal-skill contract (ADR-0006) is unchanged: a contribution is still one
zero-runtime-dependency folder with the same commands, flags and JSON shape.

**Deliberately not unified** (per `cli-shared/README.md`): `fetchWithBackoff` (retry semantics
differ per CLI and are pinned by tests) and table renderers (column widths are a per-CLI output
contract). Surface-specific text conventions (1200-character descriptions, a "Remote" place for a
remote-only Ashby job, CLI detail strings) stay at the surface for the same reason.

---

## 3. Engine (`applyos/`)

| Artefact | Consumers | Coupling | Gates |
|---|---|---|---|
| `packages/core/src/types.ts` (`JobPosting`) | Every engine package; `packages/portals`; `packages/company-scraper`; `apps/cli` | **tight** | `packages/core/tests/contract.test.ts`; engine suite |
| `packages/core/src/fetch.ts` | 9 fetch sites across the engine | tight | `packages/core/tests/fetch.test.ts` |
| `packages/core/src/robots.ts` | `apps/cli/src/scrape.ts` (`gatedPortalRun`), `packages/company-scraper` | tight | `apps/cli/tests/robots-gate.test.ts` |
| `packages/core/src/dedupe.ts` | `apps/cli/src/scrape.ts` (`mergePools`, `interleave`, `collapseReqSpread`) | tight | `packages/core/tests/dedupe.test.ts` |
| `packages/core/src/stages.ts` | `apps/cli/src/scrape.ts`, `packages/company-scraper/src/search.ts` | tight | `packages/core/tests/stages.test.ts` |
| `packages/matching/src/gates.ts` | `apps/cli/src/apply.ts`, `apps/cli/src/rank.ts` | tight | `packages/matching/tests/matching.test.ts` |
| `packages/matching/src/score.ts` | `apps/cli/src/rank.ts`, `apps/cli/src/apply.ts` | tight | `packages/matching/tests/matching.test.ts` |
| `packages/docgen/src/pack.ts` | `apps/cli/src/apply.ts` | tight | `packages/docgen/tests/pack.test.ts` |
| `packages/provider/src/<board>.ts` (Phase 4) | Every migrated CLI surface and engine adapter | **tight** — one implementation per board | `packages/provider/tests/` (contract suite + captured parity oracles); both surfaces' suites |
| `packages/provider/registry.yaml` (Phase 4.8) | `packages/provider/src/registry.ts`, `packages/company-scraper/src/registry.ts`, the health check and `/add-portal` | **tight** — the single board inventory | `packages/provider/tests/registry.test.ts`; `tests/test_scrape_contract.py` |
| `packages/company-scraper/registry.yaml` | Redirect only (Phase 4.8) | loose | `tests/test_scrape_contract.py` asserts it stays a redirect |
| `packages/company-scraper/src/connectors/*.ts` (Phase 4.7) | `search.ts`, `cli.ts` and the engine's row consumers | tight — thin surfaces over the SDK | `packages/company-scraper/tests/scraper.test.ts` |
| `applyos/package.json` workspaces list | Every engine package | tight | `bun install --frozen-lockfile` must succeed; CI runs it |

---

## 4. Python tooling (`tools/`)

| Artefact | Consumers | Coupling | Gates |
|---|---|---|---|
| `tools/rank_state.py` | `/rank` Steps 1 and 4 (the **only** writer of `seen_jobs.json` in `/rank`) | tight | `tests/test_rank_state.py`, `tests/test_rank_command.py` |
| `tools/verify_pdf.py` | `/apply` Step 5d, CI LaTeX smoke | tight | `tests/test_verify_pdf.py` |
| `tools/security_guards.py` | CI `security-guards` job | tight | `tests/test_security_guards.py` |
| `tools/lint_skills.py` | CI `lint` job | medium | `tests/test_lint_skills.py` |
| `tools/robots_check.py` | Portal research (`/add-portal` Step 2) | medium | `tests/test_robots_check.py` |
| `tools/check_framework_version.py` | CI `lint` job (template repo only) | loose | `tests/test_check_framework_version.py` |
| `salary_lookup.py` | `/setup` Step 3.10, `/apply` Step 1 | medium | `tests/test_salary_lookup.py`, `tests/test_salary_match.py` |
| `salary_data.json` | `salary_lookup.py` | medium | Not tracked; created from `salary_data.example.json` |

---

## 5. Permission and policy surfaces

| Artefact | Consumers | Coupling | Gates |
|---|---|---|---|
| `.claude/settings.json` | Claude Code runtime | tight | `tests/test_security_guards.py`, `tests/test_allowlist_pairing.py` |
| `opencode.json` | OpenCode runtime | tight | `tests/test_opencode_config.py`, `tests/test_security_guards.py` (parity), `tests/test_allowlist_pairing.py` |
| `.gitignore` | Git | tight | `tools/security_guards.py` (root rules **and** nested-`.gitignore` negations) |
| Any `package.json` under `.agents/**` or `applyos/` | Bun install surface | tight | `tools/security_guards.py` refuses lifecycle scripts |
| `AGENTS.md` routing table | Codex, ZCode, Antigravity, FreeBuff | medium | `tests/test_runtime_adapters.py` |
| `.opencode/command/*.md` | OpenCode | tight | `tests/test_runtime_adapters.py` (thin-pointer assertion) |
| `.agents/skills/<methodology>/` | Mirror of `.claude/skills/<methodology>/` | tight | `tests/test_skill_mirrors.py` (byte-identical) |
| `.claude/agents/gemini-research-expert.md` + 2 mirrors | Claude Code, OpenCode, Codex | medium | `tests/test_runtime_adapters.py` (keeps the deprecation marks in sync) |

---

## 6. Cross-cutting: shared data contracts

| Contract | Defined in | Consumed by | Break impact |
|---|---|---|---|
| Tracker CSV schema (14 columns) | `.claude/commands/outcome.md` | `/apply`, `/outcome`, `/gmail-sync`, `/html-report`, `/notion-sync`, `/rank` | **Highest-fanout contract in the repo.** `cover_letter_file` is legacy and must stay in the header. Tests: `tests/test_tracker_status_vocab.py` |
| Tracker status vocabulary (9 spellings) | `.claude/commands/outcome.md` | `/outcome`, `/gmail-sync`, `/notion-sync`, `/html-report` | Legacy space spellings accepted on read, never written. `interview_only` is archive-only, never a tracker status |
| `seen_jobs.json` shape | `tools/rank_state.py` | `/scrape` (write), `/rank` (via tool only) | Append-only by design. `/apply` must not modify it |
| `JobPosting` | `applyos/packages/core/src/types.ts` | All engine packages | `null` means "source did not state it" — never `""` and never a placeholder string |
| Portal-skill JSON envelope | `.claude/commands/add-portal.md` | `/scrape`, `careers-search` consumers | `{meta:{count,page}, results:[{id,title,company,location,date,url}]}`; missing values are `null`, never omitted |
| `interview_prep_<stage>.md` | `.claude/commands/interview.md` | `/outcome` Step 6 (manual handoff) | Prep must not contradict the submitted document |
| LaTeX page budget | `.claude/commands/apply.md` | `/add-template`, CI LaTeX smoke | Resume exactly 1 page; CV exactly 2 (1 for student/fresher). Both are asserted in CI |
| LaTeX placeholder tokens | `templates/cv-stock/*.tex`, `01-candidate-profile.md` | CI `placeholder-integrity` job | `[YOUR_NAME]`, `[your.email@example.com]`, `[First]`/`[Last]`, `[YOUR_PRIMARY_SKILLS]` must survive |
| Phone placeholder | `templates/cv-stock/*.tex` | `/setup`, `/reset` | `+91 XXXXX XXXXX` — **never** `[YOUR_PHONE]`; a bare `_` is a LaTeX subscript and aborts the compile |

---

## 7. Change-entry checklist

Before opening a pull request, confirm:

1. **Spec change** → did you update the mirror in `.agents/skills/`? (`test_skill_mirrors.py`)
2. **New command** → did you add a routing row in `AGENTS.md` **and** an OpenCode adapter in
   the same change? (`test_runtime_adapters.py`)
3. **New provider** → did you add it under `.agents/skills/<name>-search/`? CI discovers it
   automatically — you do not need to edit the workflow.
4. **Engine change** → does `bun install --frozen-lockfile` still succeed, and does
   `bun run --filter "*" typecheck` pass on all 6 packages?
5. **Permission change** → did you update `.claude/settings.json` and `opencode.json`
   together? Parity is enforced in both directions.
6. **Tracker or status change** → did you update `tests/test_tracker_status_vocab.py`?
7. **Document change** → did you re-run the LaTeX smoke locally and confirm the page count?
8. **Any change at all** → `python -m unittest discover -s tests -t .`,
   `python tools/lint_skills.py`, `python tools/security_guards.py`.
