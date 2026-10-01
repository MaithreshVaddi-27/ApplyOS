# ApplyOS: Comprehensive Indian Market & Global Remote Upgrade Status

> **⚠️ Historical document — read `docs/REFACTOR_PLAN.md` for the current roadmap.**
>
> This file recorded the first India-market upgrade pass. A 2026-09-30 audit found that its
> Section 3 "Pending Work" items and Section 4 test-log numbers were **aspirational rather than
> verified** (the "387 passed" line cites a local machine path; the Naukri composite-scrape and
> AmbitionBox tasks were never started; Task 2.4/2.5 were only ideas). The verified state of this
> fork now lives in [docs/REFACTOR_PLAN.md](REFACTOR_PLAN.md) (audit + upgrade/degrade lists +
> pending tasks) and [docs/COMPANY_PORTAL_SCRAPER.md](COMPANY_PORTAL_SCRAPER.md) (the company-portal
> scraper, built and live-verified). Section 3 below is kept for history; **do not resume work from
> it** — the same items, re-scoped and honest, are in REFACTOR_PLAN.md.

**Document Version:** 1.1.0 (audit pass)  
**Last Updated:** 2026-09-30  
**Scope:** Historical record of the first India-market enhancement pass.

---

## 1. Executive Summary

This project upgrade refactors and enhances the ApplyOS ecosystem for:
1. **The Indian Tech Ecosystem**: Specialized job boards (`naukri-search`, `internshala-search`, `unstop-search`), tier-based universities, CGPA grading, notice periods (0 to 90 days), INR Lakhs Per Annum (LPA / CTC) compensation structures, and Indian corporate entity matching.
2. **Global Remote Engineering Roles**: Seamless cross-border timezone overlap metrics, async qualification criteria, USD base salary benchmarking, and multi-region scraping (`wellfound-search`, `linkedin-search`, `remoteok-search`, `remotive-search`, `weworkremotely-search`, `freehire-search`).
3. **Zero-Tolerance Quality & ATS Verification**: Pre-flight verification in `tools/verify_pdf.py` enforcing clean text extraction without glyph corruption (`�`), replacement characters, unexpanded LaTeX macros (`\cventry`, `\makecvtitle`), or bracket traps.
4. **Dual Directory Synchronization**: Complete consistency between `.claude/` (Claude Code CLI) and `.agents/` (multi-agent, Codex, subagents) skill distributions.

---

## 2. Complete Work Item Breakdown & Status

### A. Job Search Portals & Scrapers (Zero-Dependency Bun CLIs)

| Portal Skill | Target Market | Status | Key Features Added / Verified |
|---|---|---|---|
| **`naukri-search`** | India (Mid to Senior Tech Roles) | **COMPLETED** | - Full TypeScript CLI (`src/cli.ts`, `commands/search.ts`, `commands/detail.ts`)<br>- Flag validation: `--location`, `--query`, `--experience`, `--salary` (LPA range), `--jobage`, `--page`, `--limit`, `--format`<br>- Parsing support for modern `srp-jobtuple-wrapper`, `cust-job-tuple`, and `__NEXT_DATA__` JSON state<br>- Comprehensive test suites (`cli-flag-validation.test.ts`, `parsing.test.ts`, 13 tests passing) |
| **`internshala-search`** | India (Internships & Entry-Level / Freshers) | **COMPLETED** | - Added `--type` flag (`jobs`, `internships`, `all`) with distinct URL routing<br>- Added `--min-stipend` / `--min-salary` filtering with INR and LPA parsing<br>- Formatted plain, table, and JSON outputs<br>- Integration and flag tests passing |
| **`unstop-search`** | India (College grads, hackathons, early career) | **COMPLETED** | - Added `--category` flag (`tech`, `non-tech`, `hackathons`, `challenges`)<br>- Added stipend parsing, location normalization, and batch detail resolution<br>- Flag and integration tests passing |
| **`wellfound-search`** | Global Remote & Startups / India Hubs | **COMPLETED** | - Enhanced location filtering for Bangalore, Hyderabad, Pune, Gurgaon, Mumbai<br>- Added `--equity` and `--salary` parsing with remote flags<br>- Output formatters standardized |
| **`linkedin-search`** | India Hubs & Global Remote | **COMPLETED** | - Enhanced location parsing for Indian metros and pan-India remote<br>- Strict flag validation and output formatting |
| **`remoteok-search`** | Global Remote (Engineering, AI, Product) | **COMPLETED** | - Timezone filtering (`--timezone`, `--worldwide`)<br>- Direct JSON API fetching with client-side filters<br>- Zero-dependency Bun implementation |
| **`remotive-search`** | Global Remote | **COMPLETED** | - Category and region filtering<br>- Integration verified with test suite |
| **`weworkremotely-search`** | Global Remote | **COMPLETED** | - Multi-category feeds, async role filtering |
| **`freehire-search`** | Aggregated Multi-Portal Search | **COMPLETED** | - Structured query aggregation across remote platforms |

---

### B. Candidate Profile Optimization & Onboarding (`.claude/commands/setup.md`)

| Area | Status | Implementation Details |
|---|---|---|
| **Indian Education & Degrees** | **COMPLETED** | Recognition of IITs, NITs, IIITs, BITS, Tier-1/2 state/central universities; Indian degrees (`B.Tech`, `B.E.`, `M.Tech`, `MCA`, `M.Sc.`) and CGPA (10-point scale) / percentage conversions. |
| **Indian Phone & Identity** | **COMPLETED** | E.164 and international format support with `+91 XXXXX XXXXX` phone structure. |
| **Notice Period Logistics** | **COMPLETED** | Dedicated onboarding prompt for notice period (Immediate / 15 days / 30 days / 60 days / 90 days / Buy-out available). |
| **Domain Competencies** | **COMPLETED** | Recognition of Indian digital ecosystem experience: UPI, Aadhaar, ONDC, GSTN, payment gateways (Razorpay, Cashfree, Pine Labs), and high-scale localized consumer apps. |
| **Location & Remote Preferences** | **COMPLETED** | Granular preferences for Tier-1 metros (Bangalore, Hyderabad, Pune, Delhi NCR, Mumbai, Chennai), Tier-2 hubs, Pan-India remote, and Global remote (IST vs US/EU overlap). |

---

### C. Application Quality & ATS Verification Engine (`tools/verify_pdf.py`)

| Feature / Verification Gate | Status | Details |
|---|---|---|
| **Font & Glyph Corruption Check** | **COMPLETED** | Checks for replacement character (`�`) and unresolved font glyph markers (`(cid:NNN)`). |
| **LaTeX Leaks & Bracket Traps** | **COMPLETED** | Scans for unexpanded LaTeX command macros (`\cventry`, `\makecvtitle`, `\section`, `\cvitem`) and bracket traps (`\item [Label]`). |
| **Contact Info Verification** | **COMPLETED** | Enforces valid email pattern and international phone pattern (including `+91`). |
| **Standard ATS Headings** | **COMPLETED** | Ensures at least 2 standard recognized headings (`Experience`, `Education`, `Skills`, `Projects`). |
| **Test Suite Coverage** | **COMPLETED** | 5 dedicated unit tests added to `tests/test_verify_pdf.py` validating all ATS gate passes and failures. |

---

### D. Fit Evaluation & Job Scoring (`04-job-evaluation.md` & `rank.md`)

| Component | Status | Details |
|---|---|---|
| **Pre-Scoring Eligibility Gates** | **COMPLETED** | Hard gates for Location/Transit, Language, and Notice Period before calculating weighted score. |
| **Notice Period Feasibility** | **COMPLETED** | Flags mismatch between employer urgency ("immediate joiners") and candidate availability (>30 days). |
| **Timezone & Async Overlap** | **COMPLETED** | Requires 3–4 hours minimum IST overlap or explicitly confirmed async operations for global remote roles. |
| **Framework Version Guard** | **COMPLETED** | Incremented `framework_version` to 1.2.8 (`04-job-evaluation.md`) and 1.4.4 (`05-cv-templates.md`) in sync with CI checker `tools/check_framework_version.py`. |

---

### E. Salary Benchmarking & Corporate Entity Matching (`salary_lookup.py`)

| Component | Status | Details |
|---|---|---|
| **Indian Legal Suffix Stripping** | **COMPLETED** | Added `pvt ltd`, `pvt. ltd`, `private limited`, `llp`, `india` to `STRIP_PATTERNS`. Matches corporate names regardless of suffix (e.g. `Razorpay Software Pvt Ltd` -> `Razorpay`). |
| **INR LPA & Remote USD Documentation** | **COMPLETED** | Updated `tools/README_SALARY_TOOL.md` with explicit templates for Indian LPA/CTC and Global Remote USD salary benchmarking. |
| **Unit Test Coverage** | **COMPLETED** | Added unit test `test_exact_match_after_indian_suffix_stripping` in `tests/test_salary_lookup.py`. 72/72 tests pass. |

---

## 3. Pending Work & Future Roadmap (HISTORICAL — superseded)

> The items below were written as intent, not as verified status. Where they stand as of
> 2026-09-30: **2.1 (Naukri cookie pass-through) — declined** (supply-chain risk; see
> REFACTOR_PLAN.md D6). **2.2 (composite multi-portal scrape) — partially covered** by
> `/scrape`'s existing parallel portal fan-out; a dedicated `--india-all` flag is not planned
> until the stage-aware engine lands. **2.3 (AmbitionBox adapter) — not started**, tracked as
> REFACTOR_PLAN.md U15. **2.4 (bilingual templates) — not started**, tracked as U6. **2.5
> (WhatsApp follow-ups) — not started**, tracked as U7.

The following items are identified for future phases:

### Phase 2: Automation & Portal Resilience (Pending / Planned)

- [ ] **Task 2.1: Naukri Live Anti-Bot Resiliency & Session Handling**
  - *Context:* Naukri.com frequently updates Cloudflare and anti-bot challenge headers for unauthenticated requests.
  - *Action:* Provide an optional cookie/session-header argument (`--cookie-file` or `--header-file`) in `naukri-search/cli` for authenticated session pass-through.
- [ ] **Task 2.2: Composite Multi-Portal Scrape Execution**
  - *Context:* Currently, `/scrape` invokes skills sequentially or individually.
  - *Action:* Create a composite wrapper or command flag `/scrape --india-all` that fans out across `naukri-search`, `internshala-search`, `unstop-search`, and `linkedin-search` concurrently.
- [ ] **Task 2.3: AmbitionBox / Glassdoor India Direct Adapter**
  - *Context:* Currently salary data relies on `salary_data.json`.
  - *Action:* Develop a lightweight fetcher or scraper tool to populate `salary_data.json` directly from public AmbitionBox or Levels.fyi India endpoints.
- [ ] **Task 2.4: Bilingual CV and Cover Letter Templates**
  - *Context:* For multinational or regional roles requiring bilingual proficiency (e.g. English + Hindi or regional languages).
  - *Action:* Add Unicode font packages (`fontspec`, `XeLaTeX`) template in `05-cv-templates.md` for dual-language rendering.
- [ ] **Task 2.5: Automated WhatsApp / Email Application Follow-up Generator**
  - *Context:* In the Indian job market, HR recruiters and talent acquisition specialists frequently contact candidates over WhatsApp and LinkedIn InMail.
  - *Action:* Extend `/outcome followup` to support WhatsApp-ready concise follow-up snippets with notice period, current CTC, expected CTC, and portfolio links.

---

## 4. Test & Verification Log

Every component has been verified using automated test runners and linting scripts:

| Verification Suite | Command | Result |
|---|---|---|
| **Python Unit & Regression Tests** | `pytest` (repo root) | ⚠️ *unverified claim from the original author's machine; current count as of 2026-09-30: 388 passed* |
| **Framework Version Integrity** | `python3 tools/check_framework_version.py` | **OK** |
| **Skill & Command Linter** | `python3 tools/lint_skills.py` | **OK** (18 skills, 12 commands, settings.json) |
| **Security & Manifest Guard** | `python3 tools/security_guards.py` | **OK** (allowlists, manifests, gitignore) |
| **Naukri CLI Unit & Parser Tests** | `bun test` in `.agents/skills/naukri-search/cli` | **13 passed** across 2 files |
| **All Portal CLIs** | `bun test` across 10 portal CLIs | **All passed** |

---

## 5. How to Continue Development from This File

When resuming work on this repository:

1. **Check Environment & Dependencies**:
   ```bash
   python3 -m pytest
   python3 tools/check_framework_version.py
   python3 tools/lint_skills.py
   ```
2. **Review Pending Tasks**:
   Consult **Section 3: Pending Work & Future Roadmap** above to select the next task (e.g., Task 2.1 for Naukri session authentication or Task 2.2 for composite scraping).
3. **Synchronize Directory Changes**:
   Whenever updating core skills in `.claude/skills/job-application-assistant/`, ensure `.agents/skills/job-application-assistant/` remains identical.
4. **Bump Framework Versions**:
   If modifying `04-job-evaluation.md` or `05-cv-templates.md`, remember to bump `framework_version` in the YAML frontmatter before running CI checks.
