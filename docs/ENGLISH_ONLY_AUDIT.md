# English-Only Audit + Working Improvements — ApplyOS

Date: 2026-10-04
Status: PHASE 2 DONE — careers-search works for all candidate types (jobs + internships)
Phase 1: IMPLEMENTED — English-only, 439 tests OK, lint OK, security OK
Phase 2: IMPLEMENTED — `--type jobs|internships|all` + `--stage student|fresher|experienced|remote-global` on careers-search; student defaults to internships, remote-global to remote rows; careers-search added to remote-global stage map; /scrape passes stage through; bun 42 pass, python 439 pass, lint/security/framework-version OK
Phase 3: IMPLEMENTED — `/setup` Step 3 gains substep 10 (salary_data.json provision + `--validate`, lualatex/bun pre-flight); pinned by SetupPreflightStep; 440 tests OK, lint/security/framework-version OK
Method: `code-review-and-quality`, `systematic-debugging`, `verification-before-completion`

## Health check 2026-10-04 (post-push, working tree clean at 652aff2)

- Python: 440 tests OK (`python -m unittest discover -s tests -t .`, 33 test files)
- Portal CLIs: 12/12 `bun test` suites green, 248 pass / 0 fail (careers 42, cutshort 22, freehire 44, internshala 9, linkedin 62, naukri 13, remoteok 9, remotive 10, unstop 9, wayup 9, wellfound 9, weworkremotely 10)
- `lint_skills.py` OK (20 skills, 12 commands) · `security_guards.py` OK · `check_framework_version.py` OK
- Mirrors in sync (`.claude` ↔ `.agents`, enforced by `test_skill_mirrors.py`)
- `bunx tsc --noEmit` (careers-search) still fails on missing `bun-types` — pre-existing env issue, not caused by recent changes

## Health check 2026-10-05 (post-push, working tree clean at b572870)

- Python: 440 tests OK (33 test files) · `lint_skills.py` OK · `security_guards.py` OK · `check_framework_version.py` OK
- Portal CLIs: 12/12 `bun test` suites green (248 pass), and **12/12 `tsc --noEmit` clean** after `bun install` in each `cli/` (the earlier `bun-types` failure was uninstalled devDependencies, not a code issue)
- English-only completed: Languages table and proficiency comparison removed framework-wide; Language Gate is binary (non-English working language fails); verified no multilanguage text remains outside historical records
- Internshala `parseJobDetail` re-anchored to live markup (perks/skills/who-can-apply/openings) and pinned with fixture tests; LinkedIn detail now extracts the posted date from the main job header's `<time datetime>`

Verified baseline:

* `python tools/lint_skills.py` -> OK (20 skills, 12 commands)
* `python tools/security_guards.py` -> OK
* `python -m unittest discover -s tests -t .` -> 439 tests OK
* Policy already in `.claude/skills/job-application-assistant/03-writing-style.md:67-69`: English always.

## A. English-only: changes required

Residual Danish from upstream fork. No Hindi content found except trigger example.

1. `.claude/skills/job-application-assistant/SKILL.md:6` - remove `ansøgning, stilling` triggers.
2. `.claude/skills/job-application-assistant/03-writing-style.md:30` - replace `"Ansogning til stilling som ingeniør"` bad-example with English-only e.g. `"Application for Engineer Position"`.
3. `salary_lookup.py:15` - `--city "København"` -> `"Bengaluru"`.
4. `salary_lookup.py:29-33,176-181` - `SPELLING_VARIANTS`, `anglicize()` Danish/Nordic comment + logic -> remove or reduce to ascii-only; keep `Pvt Ltd/LLP` stripping.
5. `salary_lookup.py:172,189` - regex `[^a-zæøåöäü0-9]`, `[a-zæøåöäü0-9]+` -> `[^a-z0-9]`, `[a-z0-9]+`.
6. `salary_lookup.py:424` - `like 'A/S' or 'ApS'` -> `like 'Pvt Ltd' or 'LLP'`.
7. `tools/convert_salary_excel.py:41-54` - `COMPANY_PATTERNS={"firma","virksomhed","arbejdsgiver"}`, `CITY_PATTERNS={"by","kommune","lokation","sted"}`, `COUNT_PATTERNS={"antal","medarbejdere"}`, `INDEX_PATTERNS={"indeks","løn","gennemsnit"}`, `COMPOUND_PATTERNS`, `ID_PATTERNS={"personnummer"}` -> English-only sets + update comments.
8. `tools/convert_salary_excel.py:93,113` - same regex fix as #5.
9. `tools/convert_salary_excel.py:20-21,368` - `"Company" or "Firma"`, `"City" or "By"` -> `"Company"`, `"City"`.
10. `tools/README_SALARY_TOOL.md:11,32-33,40-41,81,151-153,162` - `Danish/Nordic`, `Novo Nordisk A/S / Bagsværd`, `Ørsted A/S / Fredericia`, `Firma/By`, `COWI`, `Danish variations` -> India examples (`Razorpay / Flipkart / Bangalore`, `Pvt Ltd`, `AmbitionBox`).
11. `tests/test_salary_lookup.py`, `test_convert_salary_excel.py` - Danish fixtures (`Mærsk, Carlsberg Danmark, Foo A/S, Aarhus`) -> English fixtures; otherwise tests lock in Danish.
12. `documents/README.md:118` - `Novo Nordisk A/S` -> `Example Pvt Ltd`.
13. `README.md:288` - `Indian and Danish legal-suffix` -> `Indian`.
14. `.claude/commands/add-portal.md:27` - `e.g. "नौकरी" / "job vacancy" for Hindi-language portals` -> remove if strictly English-only; conflicts with Document Language rule.

Keep `CHANGELOG.md` history as-is.

## B. Better working: changes required

1. **Correctness:** `salary_data.json` missing by design - `/setup` should auto-copy from `salary_data.example.json`; now silent skip.
2. **Architecture:** 12 commands vs 2 `source-command-*` mirrors; `.opencode/command/` 14 files, `.gemini/.clinerules/.cursor/.codex` thin pointers - add coverage for all new commands or drop mirror layer.
3. **Docs drift:** `docs/REFACTOR_PLAN.md`, `docs/PROJECT_STATUS.md`, `CHANGELOG.md` still reference deleted `06-cover-letter-templates.md`, Danish portals `jobbank/jobdanmark/jobindex`, `check_upstream_updates.py` - mark as historical.
4. **Portal gaps:** roadmap lists Cuvette/Instahyre/Hirist missing; `wayup-search` disabled US-only - either enable or remove to avoid dead code.
5. **Readability:** `salary_lookup.py:193-263` match scoring + `convert_salary_excel.py:128-175` header detection are oversized - extract helpers, add comments for thresholds `30/70/80/100`.
6. **Security:** already guarded; keep manual copy rule for third-party portal skills - no auto-installer.
7. **Verification:** CI already pins LaTeX + `bun test` per CLI; add local pre-flight: `lualatex` present, `bun install` loop done, `salary_data.json` present.
