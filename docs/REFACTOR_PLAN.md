# Refactor Plan: Effective Internship & Job Discovery (India + Remote)

**Version:** 1.1 · **Date:** 2026-09-30 · **Supersedes:** the roadmap sections of [docs/PROJECT_STATUS.md](PROJECT_STATUS.md) (Phase 2 items re-audited there)

> **Status summary (2026-10-01):** Phases 0–4 complete. U3 stage engine, U5,
> D5 done 2026-10-01 (Phase 1); U4/P2 `cutshort-search` built and live-verified,
> P1/P3/P4 declined with evidence (Phase 2); C10–C13 resolved (C11 connector
> shipped with seeding declined, C12 declined); U6/U12 documents done; U7–U10,
> U13–U15 and D1–D6 done. **Nothing pending anywhere in the repo.** The last open
> item, bilingual templates (`docs/PROJECT_STATUS.md` Task 2.4), was declined and
> closed by maintainer decision: cover letters are removed from the framework and
> documents are English-only with a fixed professional sans-serif.
> Full task list in [Section 12](#12-pending-tasks-the-authoritative-list).

This document is the working plan for refactoring **ApplyOS**, the India + global-remote job-search framework, so that it finds **internships and jobs available in India or remote** in the most effective way — for students, freshers, and experienced candidates alike. It lists every planned change as an **upgrade** (add/improve) or a **degrade** (remove/simplify), with priority, effort, and the reason.

Grounded in: a full code audit of this fork's pre-refactor codebase (upstream v1.7.1 base plus the initial India-market commits), and web research on the 2026 Indian hiring-platform landscape (Cuvette, Cutshort, Instahyre, Hirist, plus remote platforms).

---

## 1. How the project works today (audit summary)

The framework is an agent-driven pipeline, not an app. Markdown command specs under `.claude/commands/` are the implementation; Bun CLIs under `.agents/skills/*-search/cli/` fetch listings; skills under `.claude/skills/job-application-assistant/` evaluate, draft, and verify.

```
/setup  ──▶ profile files (CLAUDE.md, 01..07 skill files, search-queries.md)
/scrape ──▶ runs every installed portal CLI (auto-discovered), dedupes into job_scraper/seen_jobs.json
/rank   ──▶ batch-scores the pool via 04-job-evaluation.md (gates + 5 weighted dimensions)
/apply  ──▶ fit eval → LaTeX CV + cover letter → reviewer agent → revise → compile → PDF/ATS verification
/outcome┬─▶ tracker + archives + follow-ups; /interview, /gmail-sync, /notion-sync, /html-report support it
```

### What is already strong (keep, don't touch)

| Asset | Why it stays |
|---|---|
| Drafter–reviewer `/apply` pipeline with PDF compile-and-inspect + ATS text-layer verification | The differentiator; nothing in the India scope should weaken it |
| Honesty rules (fabrication guards, profile grounding audit, "gap, never stuffed") | Trust core of the system |
| Portal-skill contract (`search`/`detail` CLI, `--format json|table|plain`, `enabled:` flag, per-skill tests, auto-discovery by `/scrape`) | Clean extension model — every new portal below reuses it verbatim |
| `seen_jobs.json` provenance (`portal`, `source`, `posted_date`, `status`) + Step 4.75 portal health check | Solves ghost jobs and silent parser rot; rare among job-search tools |
| Referral-link generation (`/scrape` Step 4.5) | High-leverage in India's referral-driven market — gets upgraded, not replaced |
| Upstream-sync tooling (`check_upstream_updates.py`, `upstream_triage.py`) | REMOVED in the ApplyOS own-repo refactor — the repo is standalone with no upstream remote; the MIT derivation credit lives in NOTICE, not in sync machinery |
| Test suite (29 Python test files, per-CLI bun tests, CI lint/security guards) | Every change below must pass it |

### Confirmed gaps and defects found in the audit

1. **Only 6 of 14 portal CLIs are pre-approved to run.** `.claude/settings.json` allowlists jobbank/jobdanmark/jobindex/jobnet (Danish portals that don't exist in this fork) + linkedin + freehire. The India-critical CLIs — **naukri, internshala, unstop, wellfound, wayup, remoteok, remotive, weworkremotely** — are missing, so `/scrape` hits a permission prompt (or the agent skips them) on every run. Severity: **blocker**.
2. **`search-queries.md` is 100% placeholder** (`[YOUR_PRIMARY_ROLE_TYPE]`, `[YOUR_CITY]`…). `/scrape` reads it first and gets nothing usable. Severity: **blocker**.
3. **No notion of candidate stage.** The fit framework, scoring weights, CV templates, and portal mix assume one generic candidate. A final-year student and a 5-year professional get identical treatment (2-page CV cap, notice-period gate, CTC benchmarks) — wrong for both. Severity: **core design gap**.
4. **Company-careers discovery doesn't exist as a tool.** Most Indian product companies and GCCs post on their own careers pages (Greenhouse/Lever/SmartRecruiters/Ashby) before portals — or only there. `/apply` prefers employer postings when given a URL, but nothing *finds* them. Severity: **high**.
5. **Phantom features in CLAUDE.md.** `/skill-create`, `/skill-update`, `/skill-test`, `/debug search|latex|ats`, `/scrape --save-profile`, `/html-report --insights`, `/upskill --market-trends` are documented as available; none exist anywhere in the repo. Severity: medium (misleads the agent and the user).
6. **CLAUDE.md is triple-loaded** (project guidance + candidate profile + a stale wishlist). It will fight `/setup`'s personalization and bloats every agent context.
7. **docs/PROJECT_STATUS.md over-claims** ("387 tests passed", tasks 2.1–2.5 "planned") and mixes verified work with aspiration; its unverified claims can steer future work.
8. **Install docs are hardcoded.** README/SETUP list 9 bun tools; the repo ships 14 (`naukri-search` etc. missing). The loop should discover `*-search/cli` dynamically.
9. **Nothing enforces the settings allowlist ↔ portal-skills pairing.** Defect #1 happened silently; no test would catch the next one.
10. **No India-specific fresher signals in the fit framework**: batch eligibility ("2026 batch"), stipend floors, service bonds in hiring challenges, CGPA cutoffs, referral norms, WhatsApp follow-up culture — all absent. Partially present: notice-period gate, LPA salary notes, GCC/media sources in 04-job-evaluation.md.
11. **Minor:** local tool dirs `.codegraph/`, `.freebuff/` are untracked and unignored (git noise); `cv/main_example.tex` contact block uses `+XX` / US-style address placeholders (Indian format guidance lives nowhere).

---

## 2. The core upgrade: a stage-aware search engine

The single highest-impact refactor. One question — *"What stage are you searching from?"* — changes portals, queries, scoring gates, document templates, and follow-up cadence.

### 2.1 Stage model

Four stages, recorded once per user and overridable per run:

| Stage | Profile | Primary portals | Key gates & rules |
|---|---|---|---|
| `student` | Enrolled, seeking internships (incl. WFH) | internshala, unstop, cuvette, wayup | Stipend floor, batch eligibility, enrollment status, 1-page CV |
| `fresher` | Graduated 0–1 yr, entry-level roles | internshala, unstop, cuvette, cutshort, naukri (0–1 yr), wellfound | Batch/grad-year windows, hiring-challenge bonds, fresher CTC vs market |
| `experienced` | 1+ yr, India-based | naukri, cutshort, instahyre, hirist, linkedin, wellfound | Notice period, CTC structure (fixed/variable/ESOP), role-level matching |
| `remote-global` | Any stage, targeting remote abroad/India-remote | remoteok, remotive, weworkremotely, wellfound, linkedin, freehire | Timezone overlap, USD benchmarks, contractor/EOR eligibility |

### 2.2 Mechanism (all within existing architecture — no new infra)

1. **`/setup` gains a Stage step** (and `/setup --section search` re-asks it): stage, preferred cities (Tier-1/Tier-2), remote preference, stipend floor / expected CTC, notice period, graduation year/batch. Written into a new `## Stage Profile` block at the top of `search-queries.md` (already the personalized config surface; stays fork-tracked like today).
2. **`/scrape` Step 0.5 reads the stage.** Unset or ambiguous → the agent asks the user **once**, saves the answer, proceeds. CLI override supported: `/scrape --stage student`, `/scrape --stage remote-global`. Only the stage's portal set runs (others report `skipped (stage)` in the summary line — reusing the existing skip reporting, not new machinery).
3. **`/rank` weights shift by stage** (weights live in 04-job-evaluation.md):
   - `student`: Technical 30 / Experience 15 / Behavioral 15 / Career 40 — "will I learn here" outweighs "have I done this before"; Experience dimension scores *projects and coursework* when work history is thin (explicitly instructed, so scores don't collapse).
   - `fresher`: Technical 35 / Experience 20 / Behavioral 15 / Career 30.
   - `experienced`: current weights (30/25/15/30) stay.
   - `remote-global`: adds a Timezone-Overlap gate next to Location; USD-vs-CTC conversion note in the salary step.
4. **New stage-conditional gates in `04-job-evaluation.md`** (each a hard gate like the existing Eligibility/Language gates, evaluated only for its stage):
   - **Stipend Gate** (`student`): posting's stipend < profile floor → FAIL with the numbers quoted.
   - **Batch Gate** (`student`/`fresher`): "2026 batch only" vs profile graduation year → FAIL/FLAG by wording (exclusive "only" fails; "2025/2026 batch" with an earlier year flags).
   - **Bond Gate** (all India stages): service agreement / training bond in hiring challenges → FLAG with the bond terms; never auto-fail.
   - **Notice-Period Gate** (`experienced`): already specified — wire it into the stage table instead of applying globally.
   - **CTC Gate** (`fresher`/`experienced`): stated CTC below profile floor → FLAG (Indian postings often state CTC; compare against floor net of variable/stock caveat).

---

## 3. New portal-search skills (upgrade)

Each follows the **existing portal-skill contract** exactly — scaffold via `/add-portal` where the board cooperates, hand-port where it doesn't: `cli/src/cli.ts` with `search`/`detail`, `--format json|table|plain`, `date` field on every search hit, per-skill `bun test` suite, `SKILL.md` with ToS/personal-use note + `enabled:` flag, one allowlist entry each in `.claude/settings.json` + `tools/security_guards.py`.

| # | Skill | Board | Why it earns its place (2026 research) | Effort |
|---|---|---|---|---|
| P1 | ~~`cuvette-search`~~ | cuvette.tech | **Declined 2026-10-01 (evidence below)** — no compliant public endpoint | — |
| P2 | `cutshort-search` | [cutshort.io](https://cutshort.io) | AI-matched startup jobs, strong fresher-to-3yr band, Bengaluru/Pune/remote-heavy | M |
| P3 | ~~`instahyre-search`~~ | instahyre.com | **Declined 2026-10-01 (evidence below)** — bot-gated, login-curated | — |
| P4 | ~~`hirist-search`~~ | hirist.tech | **Declined 2026-10-01 (evidence below)** — client-side-only feed despite Next.js rebuild | — |
| P5 | `careers-search` | Greenhouse / Lever / SmartRecruiters / Ashby **public JSON endpoints** | **The company-careers scraper.** Most product companies & GCCs post on their own ATS boards before (or instead of) portals; these four expose stable public JSON — no markup parsing, no bot walls, ToS-friendly | M–L |

### P5 design: company-careers-page scraper (the user-requested separate scraper)

- **Interface:** a portal-type skill, `careers-search`, auto-discovered by `/scrape` like every other CLI:
  ```bash
  bun run .agents/skills/careers-search/cli/src/cli.ts search --board greenhouse --company razorpay -q "backend" --format json
  bun run .agents/skills/careers-search/cli/src/cli.ts search --file companies-india.txt -q "sde intern" --format table
  bun run .agents/skills/careers-search/cli/src/cli.ts detail <url> --format plain
  ```
- **Seeds:** `companies-india.txt` — slugs for ~40 India-relevant employers on these boards (Zerodha, Razorpay, CRED, Groww, Meesho, Zepto, Dream11, Swiggy, Zomato, PhonePe, Flipkart/Walmart GCC, Myntra, Hotstar, Paytm, Freshworks, Postman, Hasura, Zoho… plus GCCs: Google India, Microsoft India, Adobe India, Atlassian India, Goldman Sachs GCC, Walmart GCC, Target India). Maintained by hand; `/outcome` company names can be added later.
- **Contract compliance:** each listing maps to the standard fields (`title, company, location, date, url`) so dedup, `/rank`, and the health check work unchanged. `company` = the careers-page owner (which is also the employer — better than aggregator `company` fields).
- **Rate limits:** one request per board per query run, response cached 24h in `job_scraper/` (gitignored) — the politest portal in the fleet.
- **Explicitly out of scope:** Workday/SuccessFactors-hosted boards (heavy anti-bot, hostile markup) — the WebSearch fallback covers those.

### Portals deliberately **not** added (with reasons)

| Portal | Reason |
|---|---|
| Turing / Toptal / Deel | Vetting-marketplaces, not search boards; require their own assessments. Better served by a note in the `remote-global` stage profile: "register separately; the CV here is input to their funnel" |
| Apna / WorkIndia | Blue/grey-collar focus; outside this framework's tech scope |
| LinkedIn Easy Apply automation, Naukri auto-apply | ToS violations; the framework's value is fit + tailored applications, not bulk |
| Yocket / Shiksha | Study-abroad, not hiring |

---

## 4. Upgrade list (full)

| ID | Upgrade | Files touched | Priority | Effort |
|---|---|---|---|---|
| U1 | **Fix the permission allowlist**: add the 8 missing India/remote portal CLIs; drop the 4 dead Danish entries (see D1) | `.claude/settings.json`, `tools/security_guards.py` | ✅ done | S |
| U2 | **Personalize `search-queries.md`** for India + remote, with the 4-stage structure, real role/skill query categories, India location taxonomy (Tier-1/Tier-2/Pan-India remote/Global remote) and `site:` fallback templates | `.claude/skills/job-scraper/search-queries.md` | ✅ done | S |
| U3 | **Stage-aware engine** (Section 2): Stage Profile in search-queries.md, `/scrape` Step 0.5 ask-once + `--stage` flag + portal-set selection, `/rank` weight table, stage gates in evaluation framework | `search-queries.md`, `job-scraper/SKILL.md`, `.claude/commands/scrape-adjacent` rank command, `04-job-evaluation.md` | P1 | M |
| U4 | **New portals P1–P5** with tests + allowlist entries + CI contract test extension | `.agents/skills/*`, settings, guards | ◐ partially done — **P5 `careers-search` built and live-verified** (Amazon, Greenhouse, Lever, SmartRecruiters, Workday connectors; Salesforce unverified; see COMPANY_PORTAL_SCRAPER.md). P1–P4 (Cuvette, Cutshort, Instahyre, Hirist) pending | M each |
| U5 | **Allowlist-consistency CI test**: every `.agents/skills/*-search` must have a matching `settings.json` entry (and vice-versa) — makes defect #1 impossible to reintroduce | `tests/test_security_guards.py` or new `tests/test_settings_portal_pairing.py` | P1 | S |
| U6 | **Fresher/student document variants**: 1-page CV profile (education + projects + skills up top, CGPA/percentage, DD/MM/YYYY, LinkedIn/GitHub on the header), project-first bullet guidance, cover-letter tone for course/hackathon evidence | `05-cv-templates.md`, `06-cover-letter-templates.md` (stage variants, selected by Stage Profile) | P1 | M |
| U7 | **India recruiter-culture upgrades to `/outcome followup` + `/scrape` Step 4.5**: 7-day follow-up cadence default (vs 10), WhatsApp-ready short-form drafts (text only, drafts never sent — existing rule), referral guidance weighted above cold-apply (employee referral is the highest-conversion channel in India; extend Step 4.5 with alumni-network and LinkedIn-recruiter templates) | `outcome.md`, `job-scraper/SKILL.md` | P2 | S–M |
| U8 | **`/upskill` India market mapping**: gap recommendations reference Indian interview norms (DSA practice, system design, CS fundamentals) and free/low-cost resources (NPTEL, GeeksforGeeks, freeCodeCamp) alongside global ones | `upskill/SKILL.md` | P2 | S |
| U9 | **`/gmail-sync` Indian recruiter patterns**: Naukri/Internshala/Unstop notification formats, "shortlisted"/"next round" phrasing | `gmail-sync.md` | P3 | S |
| U10 | **`/html-report` analytics**: portal-yield table (applications→interviews per portal) and stage breakdown — directly answers "which portal is worth my time" | `html-report.md` | P3 | S |
| U11 | **Dynamic install loop**: README/SETUP install sections discover `.agents/skills/*-search/cli` instead of hardcoding 9 names | `README.md`, `SETUP.md` | P2 | S |
| U12 | **Indian-format contact block** in `cv/main_example.tex` placeholders + guidance (+91 phone format, city/state address, DD/MM/YYYY) | `cv/main_example.tex`, `05-cv-templates.md` | P2 | S |
| U13 | **CLAUDE.md restructure** (see D2/D3): lean project guidance, India guidance folded into the skill files where it actually executes, profile section clearly marked for `/setup` | `CLAUDE.md` | P2 | M |
| U14 | **docs/PROJECT_STATUS.md re-audit pass**: mark each claim verified/unverified; point pending work here | `docs/PROJECT_STATUS.md` | P3 | S |
| U15 | **Salary tool India seed**: `salary_data.json` starter template with LPA/CTC categories per metro tier (AmbitionBox/Glassdoor India exports) — the tool already supports Indian suffix stripping; only data is missing | `tools/README_SALARY_TOOL.md`, new example | P3 | S |

## 5. Degrade list (simplify / remove)

| ID | Degrade | Why | Risk & mitigation |
|---|---|---|---|
| D1 | **Remove the 4 dead Danish allowlist entries** (`jobbank`, `jobdanmark`, `jobindex`, `jobnet`) from settings + guards | The skills don't exist in this fork; entries pre-approve CLIs that aren't there — pure attack surface with zero function | Upstream merges will touch those lines → conflict is the designed signal; resolve by keeping this fork's set |
| D2 | **Delete the phantom-features section of CLAUDE.md** (skill-create, /debug, saved search profiles, --insights, --market-trends) | Documented-but-nonexistent commands make the agent hallucinate capabilities and the user lose trust | None — feature requests land here as U-items if ever wanted |
| D3 | **Slim CLAUDE.md to project rules only**; move India guidance into `job-application-assistant` skill files (where the behavior actually executes) and the Stage Profile into search-queries.md | Three competing documents in one file; bloats every prompt; India advice currently sits where `/setup` never writes | Keep the file's command index; verify with `test_setup_command.py` and the framework-version check |
| D4 | **Stop hardcoding portal lists in docs** (companion to U11) — README/SETUP tables become "auto-discovered; run `/scrape health` to audit" + per-portal ToS notes live only in each skill's SKILL.md | Two more lists to keep in sync | None |
| D5 | **`wayup-search` ships `enabled: false`** in its SKILL.md default (config state, folder stays) | US-only early-career board; near-zero yield for India; still one permission prompt + one network call per `/scrape` | Flip back on with one line if targeting US internships |
| D6 | **Don't build Task 2.1 (Naukri session/cookie pass-through)** from PROJECT_STATUS.md's roadmap | Shipping a `--cookie-file` flag invites credential handling inside a pre-approved CLI — against the repo's own supply-chain posture. If Naukri anti-bot hardens, the health check flags it and LinkedIn/freehire cover the gap | Mark the task *won't-do* with rationale so it isn't re-proposed |
| D7 | **Keep all India/remote portals installed** (per user decision): no trimming of naukri/internshala/unstop/wellfound/remoteok/remotive/weworkremotely/freehire/linkedin | Stage-based selection (U3) already prevents noise — irrelevant portals simply don't run for a given stage | — |

**Degrade status:** D1 ✅ (done with U1), D2 ✅ (CLAUDE.md phantom section replaced with real diagnostics + doc map), D4 ✅ (install loops now auto-discover), D6 ✅ (declined with rationale, recorded in CHANGELOG + PROJECT_STATUS). D3 ✅ done (phantoms gone, doc map added, India guidance relocated into the executing specs; CLAUDE.md is a pointer map). D5 ✅ (wayup `enabled: false`), D7 is a standing decision (all India/remote portals installed).

## 6. Portals audit — current 14, and what each is for after the refactor

| Portal | Stage relevance | Status after refactor |
|---|---|---|
| naukri-search | experienced, fresher (0–1 yr filter) | core, enabled |
| internshala-search | student, fresher | core, enabled |
| unstop-search | student, fresher (hiring challenges!) | core, enabled |
| cuvette-search *(new)* | student, fresher | core, enabled |
| cutshort-search *(new)* | fresher, experienced | core, enabled |
| instahyre-search *(new)* | experienced | core, enabled |
| hirist-search *(new)* | experienced | core, enabled |
| careers-search *(new)* | all stages | core, enabled |
| wellfound-search | all stages (startups) | enabled |
| linkedin-search | all stages | enabled |
| remoteok-search | remote-global | enabled |
| remotive-search | remote-global | enabled |
| weworkremotely-search | remote-global | enabled |
| freehire-search | remote-global (aggregator) | enabled |
| wayup-search | (US only) | `enabled: false` default (D5) |

## 7. Fit-framework additions for the Indian market (detail behind U3/U6)

- **Scoring note for student/fresher Experience dimension:** score *course projects, hackathons, open-source, prior internships* as experience; instruct the scorer to say so explicitly in the notes so a thin work history doesn't read as a red flag.
- **CTC literacy in the salary step:** postings quote CTC (fixed + variable + stock + benefits). Evaluation presents fixed-component estimate when the posting breaks it down; never compares gross CTC against a fixed-only expectation without a note.
- **Hiring-challenge awareness (Unstop):** challenges convert to interviews via leaderboard; `/apply` on a challenge URL detects the pattern and outputs a challenge-prep brief instead of a cover letter when no direct application exists.
- **GCC recognition:** Global Capability Centers (Walmart, Target, Goldman, JPMC, Optum, Bosch…) post India-based roles with global scope — evaluation treats them as career-growth-positive (structured, global exposure) and the Company Research Checklist already lists Indian media sources (Inc42, YourStory, Entrackr).
- **Referral-first strategy note:** `/scrape` Step 4.5 output ordering puts the recruiter-search link first and adds "ask in college alumni groups / batch WhatsApp groups" for student stage.

## 8. Testing & verification strategy

Every change above lands with its guard:

1. **Portal CLIs:** per-skill `bun test` (flag validation + parsing + the shared search-output contract from `tests/test_scrape_contract.py` — new portals inherit it automatically because the test derives the contract from the SKILL.md sentence).
2. **Settings pairing (U5):** new test walks `.agents/skills/*-search` and asserts a matching `settings.json` entry in both directions; guards file and settings file must agree.
3. **Command/skill specs:** `tests/test_setup_command.py`-style structural tests for the new stage steps (a `/scrape` without a Stage Profile section in search-queries.md must instruct asking the user).
4. **Framework changes:** bump `framework_version` in every modified `job-application-assistant` file (CI enforces via `tools/check_framework_version.py`).
5. **Full gates before merge:** `python3 -m pytest`, `python3 tools/lint_skills.py`, `python3 tools/security_guards.py`, `python3 tools/check_framework_version.py`, `bun test` in every portal CLI.

## 9. Execution order (status)

| Phase | Contents | Outcome | Status |
|---|---|---|---|
| **0 — Unblock** | U1, U2, gitignore of local tool dirs, D1, D2, D4, D6 | `/scrape` actually runs the India portals, with real queries, permission-prompt-free | ✅ **done** |
| **1 — Stage engine** | U3, U5, D5 | One question, correctly targeted searches and scoring for every user stage | ✅ **done 2026-10-01** (U3 stage engine + guards in `tests/test_stage_engine.py`; U5 via `tests/test_allowlist_pairing.py`; D5 wayup `enabled: false`) |
| **2 — Coverage** | U4 (P1–P4), C10–C13, U11 | Cuvette/Cutshort/Instahyre/Hirist live; company-careers scraper | ◐ **P5 + P2 done** (built, live-verified, allowlisted); P1 + P3 + P4 **declined with evidence** (Section 12; hirist re-probed post-rebuild); **C10 done** (9 boards seeded, live-verified 2026-10-01), **C11 connector shipped / Goldman seeding declined**, **C12 declined with evidence**, **C13 done** (`/apply` handoff); U11 done for install steps |
| **3 — Documents** | U6, U12 | Fresher-grade CVs and letters that pass Indian recruiter expectations | ✅ **done 2026-10-01** (U6 stage-conditional CV/letter guidance with 1-page fresher target; U12 `+91`/`City, State`/DD-MM-YYYY conventions in template + master CV; `framework_version` 1.4.6 / 1.0.4) |
| **4 — Culture & analytics** | U7, U8, U9, U10, U13, U14, U15 | Referral-first loop, India-aware upskill and dashboards, honest docs | ✅ **done** (U7 7-day follow-ups + WhatsApp drafts + referral-first Step 4.5; U8 NPTEL/GFG/free-option mapping; U9 shortlist-advances/views-are-noise; U10 portal-yield table; U15 salary_data.example.json LPA template; D3 remainder — CLAUDE.md slimmed to pointer + phantom-flag disclaimer; U13–U14 earlier) |

## 10. Resuming from this document

1. Work phase by phase; each U/D item is a standalone commit.
2. After any `job-application-assistant` edit: bump `framework_version`, run the Section 8 gates.
3. New portal skill checklist: scaffold → `bun test` offline → allowlist entry in **both** files → `enabled:` flag + ToS note → run `/scrape health <name>` once live.
4. Anything genuinely new gets appended to Section 4/5 with an ID — don't resurrect PROJECT_STATUS.md as the roadmap.

---

## 12. Pending tasks (the authoritative list)

State as of 2026-09-30, after the careers-search build. Done items are recorded in
[CHANGELOG.md](../CHANGELOG.md) `[Unreleased]`.

### Done this session (for context, not pending)

- ✅ U1 + D1 — allowlist fixed (8 India/remote portals added, 4 dead Danish entries removed, both files)
- ✅ U2 — search-queries.md personalized (Stage Profile block, 5 real query categories, India taxonomy)
- ✅ U4/P5 — `careers-search` company-portal scraper: 7 connectors, seed registry, URL detection,
  22 tests, SKILL.md, allowlisted, live-verified (Amazon India search + detail, CRED, Freshworks,
  Groww/Stripe/Figma/Airbnb/Databricks boards); Google/Microsoft/Ashby evaluated-and-declined with
  documented reasons
- ✅ D2, D4, D6 — phantom commands removed, docs auto-discover install loops, Naukri cookie task declined
- ✅ D3 (partial) — CLAUDE.md doc map + real diagnostics section
- ✅ U13/U14 (partial) — CHANGELOG [Unreleased] written, PROJECT_STATUS.md honestly re-audited
- ✅ .gitignore covers local agent tooling (.codegraph/, .freebuff/)

### Done 2026-10-01 (Phase 1 + Phase 2 first item)

- ✅ **Phase 1 complete** — U3 stage-aware engine (`/scrape` Step 0.5 ask-once + `--stage` +
  `skipped (stage)`, `/rank --stage` + per-stage weight table, stage gates in
  `04-job-evaluation.md` with `framework_version` 1.3.0, `/setup` Stage step), U5 allowlist
  pairing (`tests/test_allowlist_pairing.py`), D5 (`wayup-search` ships `enabled: false`);
  spec guards in `tests/test_stage_engine.py`
- ✅ U4/P2 — `cutshort-search` built and live-verified (2026-10-01; parses the public
  `__NEXT_DATA__` payload; 22 offline tests against real page fixtures; allowlisted in both
  files; `url-reference.md` documents the parsing anchors for the health check)

### Pending — Phase 2 (coverage)

4. **U4/P1–P4 — new India portal skills** — ✅ **resolved 2026-10-01** (2 built, 3 declined with evidence): ~~`cuvette-search`~~, ~~`instahyre-search`~~ and ~~`hirist-search`~~ **declined** (hirist was re-probed on 2026-10-01 after its Next.js rebuild — SSR ships an empty `jobfeed` and a captcha scaffold; full evidence in the Declined section below — do not re-propose without new information); **`cutshort-search` ✅ built** (live-verified 2026-10-01, parsing the public `__NEXT_DATA__` payload; 22 offline tests; allowlisted in both files)
5. **C10 — careers-search seed growth** — ✅ **done 2026-10-01** (9 boards added and live-verified: Paytm, Meesho, Zeta, Nium on Lever; Okta, Coinbase, Twilio, MongoDB, Coursera on Greenhouse, each with India-role evidence; probe-logged in `docs/COMPANY_PORTAL_SCRAPER.md` §2/§6b; guard tests in `cli/tests/registry.test.ts`). The original "~15 companies" shrank to 9 the honest way: most guessed slugs (Zepto, Meesho-on-GH, Dream11, Swiggy…) returned 404, and SmartRecruiters ITS majors answered 200 with 0 postings — all recorded as declined rows, do not re-seed without new information. GCC Workday tenants (Walmart `wd5`, Target, Adobe) also declined: CXS answered 422/404 — per-tenant slug discovery remains the precondition.
6. **C11 — Eightfold connector** — ✅ **connector shipped, Goldman Sachs seeding declined 2026-10-01**: `goldmansachs.eightfold.ai` has no public DNS A records (authoritative NOERROR, zero answers) — the flagship India-GCC tenant is not publicly resolvable. `eightfold` is a registered `BoardKind` with search+detail+URL detection, ready for one-line seeding when a resolvable tenant appears (see `enterprise.ts` and the declined table in `docs/COMPANY_PORTAL_SCRAPER.md`).
7. **C12 — Oracle ORC connector (JPMorgan Chase GCC)** — ❌ **declined 2026-10-01 with evidence**: `jpmc.fa.ocs.oraclecloud.com` CX returns 503 unauthenticated; `careers.jpmorgan.com/api/apply/v2/jobs` 301-redirects into the AEM marketing site (HTML, not JSON). No compliant zero-auth JSON path. Do not re-investigate without new information.
8. **C13 — careers-search ↔ /apply handoff** — ✅ **done 2026-10-01**: `/apply` Step 0 resolves supported careers URLs via `careers-search discover` and fetches the full JD via `detail` (any company on amazon/Salesforce/Greenhouse/Lever/SmartRecruiters/Workday/Eightfold boards, seeded or not), falling back to WebFetch + the escalation order when `discover` reports no board.
9. **U11 — dynamic install loop for the README table** (done for install steps; the per-portal description table remains manual but is now accurate)

### Pending — Phase 3 (documents)

10. **U6 — stage-conditional document variants** — ✅ **done 2026-10-01**: students-and-freshers section in `05-cv-templates.md` (Projects as the score-carrying section with evidence links, hackathon/hiring-challenge entries, CGPA rule, fresher profile shape), stage-conditional section ordering (Projects above Education), 1-page target for student/fresher CVs wired into `/apply` Step 5b's checklist, and fresher evidence guidance + tone rules in `06-cover-letter-templates.md`.
11. **U12 — Indian-format contact block** — ✅ **done 2026-10-01**: the Indian-format conventions block in `05-cv-templates.md` defines the `+91 XXXXX XXXXX` phone, `City, State` address (no street/PIN), DD/MM/YYYY for human-read dates vs ATS-safe `\cventry` dates, and the no-CTC-on-CV rule; template blocks and `cv/main_example.tex` carry the `City, State` address with the conventions in comments, and `/setup`'s contact-block step now instructs the India formatting when the Stage Profile targets India. The phone placeholder is `+91 XXXXX XXXXX`, not `[YOUR_PHONE]`: a bare `_` in a moderncv contact field is typeset as a subscript and aborts the compile before any PDF is written (`cv/main_example.tex` shipped that way and produced nothing on TeX Live 2026; CI's TeX Live 2022 tolerated it, so it went unnoticed — see `CHANGELOG.md`). `framework_version` 1.4.6 / 1.0.4. (`tools/verify_pdf.py --check-ats` already expected `+91` in the compiled PDF.)

### Done — Phase 4 (culture & analytics)

12. **U7 — recruiter-culture upgrades** — ✅ **done**: `/outcome followup` 7-day India cadence + WhatsApp short-form drafts; `/scrape` Step 4.5 referral-first ordering + student alumni/batch-group note
13. **U8 — `/upskill` India mapping** — ✅ **done** (DSA/fundamentals weight, NPTEL, GeeksforGeeks, CodeChef/Codeforces, free-option-per-gap rule)
14. **U9 — `/gmail-sync` Indian recruiter patterns** — ✅ **done** (shortlisted/next-round advances to interview; viewed-without-decision proposes nothing)
15. **U10 — `/html-report` portal-yield analytics** — ✅ **done** (per-portal sent → interview rate table with source normalisation)
16. **U15 — salary_data.json India seed template** — ✅ **done** (`salary_data.example.json`: LPA categories, metro-tier entries, zero placeholders, validates clean)
17. **D3 remainder — relocate India guidance from CLAUDE.md into skill files** — ✅ **done** (CLAUDE.md slimmed to command index + pointer map + phantom-flag disclaimer; all executing guidance already lived in the specs)

### Declined / won't-do (do not re-propose without new information)

- **P1 — Cuvette (`cuvette-search`)** (probed 2026-10-01): `cuvette.tech` and
  `www.cuvette.tech` now serve an unrelated product ("Dr. E Solutions" healthcare login);
  `/job-link` (the listing route search results still point at) answers 404 to a plain
  HTTP client; `app.cuvette.tech` has no DNS record; robots.txt is a Cloudflare
  "content signals" placeholder, not real crawl rules. No public unauthenticated endpoint
  remains reachable without browser emulation, which the portal-skill contract forbids.
- **P4 — Hirist (`hirist-search`)** (probed 2026-10-01): hirist.tech has rebuilt on
  Next.js (the earlier "JS app shell" note was obsolete), but the rebuild did not restore a
  compliant path. The category page (`/c/backend-development-jobs`, HTTP 200) embeds
  `__NEXT_DATA__`, yet it carries only config/ads — the SSR redux store ships
  `jobfeed: []`, `isLoading: true`, `totalJobs: 0`; the real feed is fetched client-side
  post-hydration. Guessed API paths (`/api/v2/jobfeed` etc.) 404; the internal gateway
  (`gladiator.hirist.tech`) is a private SPA shell; `job-static.hirist.com` answers 403;
  and the store ships a `botDetection` captcha scaffold (`captchaSiteKey`), marking the
  client feed endpoint as protected territory. Same class as Cuvette/Instahyre: only
  browser emulation or a private API reaches the listings, and the portal-skill contract
  forbids both.
- **P3 — Instahyre (`instahyre-search`)** (probed 2026-10-01): `/search-jobs/` answers
  **403** to a plain HTTP client; the product is login-curated by design (recruiter-side
  gating). No compliant path.
- **D6 — Naukri session/cookie pass-through** (supply-chain risk)
- **Ashby connector** (API now 401; revisit only if Ashby re-opens a public endpoint)
- **Google/Microsoft careers connectors** (APIs gone; JS-only pages; browser automation is out of scope)
- **Turing/Toptal/Deel, Apna/WorkIndia, LinkedIn/Naukri auto-apply** (REFACTOR_PLAN.md Section 3 rationale)
