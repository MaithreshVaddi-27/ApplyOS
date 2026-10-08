<p align="center">
  <img src="assets/mascot/applyos-mascot.svg" alt="ApplyOS" width="200">
</p>

# ApplyOS — India + Global Remote Edition

*The operating system for your job search — pointed at the Indian tech market and global remote roles, English-only end to end, and switchable to any market via one `market:` setting.*

An AI-powered job application framework. Clone it, fill in your profile, and let your AI coding agent search job portals, evaluate postings, tailor your CV, and prepare you for interviews. The reference runtime is [OpenCode](https://opencode.ai), and the framework is **runtime-agnostic**: thin adapters ship for ZCode, Claude Code, Codex CLI, and Google Antigravity, and any other agent (FreeBuff, …) can run every workflow through the universal [`AGENTS.md`](AGENTS.md) entry point.

> Note: This is an independent open-source project and is not affiliated with, endorsed by, sponsored by, or maintained by Anthropic. Anthropic and Claude Code are referenced only to describe the toolchain this workflow uses.
>
> This project has **no affiliated cryptocurrency, token, or paid sponsorship program**. Anything claiming otherwise is unauthorized and should be treated as a scam.

## What this is

A structured workflow that turns Claude Code into a full-stack job application assistant. The core pipeline — self-profiling, fit evaluation, and the drafter-reviewer application workflow — is **language- and country-agnostic**. This edition extends it with:

- **Indian tech & early-career portal coverage** — Naukri (experienced professionals), Internshala (internships and fresher roles), and Unstop (campus hiring challenges) join the global boards.
- **Direct company career-portal scraping** — `careers-search` queries employers' own ATS boards (amazon.jobs, Greenhouse, Lever, SmartRecruiters, Workday) for listings that never reach aggregators, seeded with Amazon India, Groww, CRED, Freshworks, Stripe, Figma, Airbnb, and Databricks. See [docs/COMPANY_PORTAL_SCRAPER.md](docs/COMPANY_PORTAL_SCRAPER.md).
- **Stage-aware search configuration** — `search-queries.md` ships working defaults mapped to a career stage (student/fresher, experienced, remote-global) instead of placeholders, with an India location taxonomy (Tier-1 metros, Tier-2 hubs, pan-India remote).
- **India-aware quality controls** — ATS checks tuned to Indian recruiter expectations, India salary sourcing guidance (AmbitionBox, Glassdoor India), and DD/MM/YYYY date conventions in the document checklist.

```
/setup          /scrape              /apply <url>
  |                |                     |
  v                v                     v
Fill in        Search job           Evaluate fit
your profile   portals              Score & recommend
  |                |                     |
  v                v                     v
Profile        Present matches      Draft CV or resume
files ready    with fit ratings     (LaTeX, tailored)
                   |                     |
                   v                     v
               Pick a match         Reviewer agent critiques
               -> /rank -> /apply   -> Revise -> Final output
```

## Runtime support

The workflow specs live once, under `.claude/` (single source of truth). Every other runtime
gets thin adapters that point at them — no copies, no drift. [`AGENTS.md`](AGENTS.md) is the
universal entry point with the full command-routing table.

| Runtime | Auto-loads | Slash commands |
|---|---|---|
| OpenCode (reference) | `AGENTS.md` + `opencode.json` | `.opencode/command/*.md` (native commands, thin pointers) |
| Claude Code | `CLAUDE.md` + `.claude/skills/` + `.claude/agents/` | native |
| ZCode | `AGENTS.md` + `.agents/skills/` (native skill discovery) | routing table |
| Codex CLI | `AGENTS.md` | ask for the workflow by name — the routing table is the adapter |
| Google Antigravity | `AGENTS.md` + `.agents/skills/` | routing table |
| FreeBuff & others | `AGENTS.md` (or equivalent) | routing table |

A CI spec-guard (`tests/test_runtime_adapters.py`) pins the parity invariant: every canonical
workflow has its adapters, every adapter references an existing spec, and the routing table
covers everything — the drift that killed earlier embedded copies can't come back silently.

## Prerequisites

- An AI coding agent. [OpenCode](https://opencode.ai) is the reference runtime (native slash commands, permission gating in `opencode.json`, subagents). Claude Code, Codex CLI, Google Antigravity, ZCode, FreeBuff, and any `AGENTS.md`-compatible agent work through the adapters above.
- Python 3.10+
- [Bun](https://bun.sh) (for the job-portal CLI tools)
- LaTeX distribution with `lualatex`: [TeX Live](https://tug.org/texlive/), [MacTeX](https://tug.org/mactex/), [TinyTeX](https://yihui.org/tinytex/), or [MiKTeX](https://miktex.org/). The CV compiles with `lualatex`. Minimal TeX installs need the extra packages listed in [SETUP.md](SETUP.md#minimal-tex-install-tinytexbasictex).
- Optional: `pip install pypdf` for `/apply`'s ATS parseability check (no Poppler required). Poppler `pdftotext` remains a fallback (macOS: `brew install poppler`, Debian/Ubuntu: `apt install poppler-utils`, Windows: `choco install poppler`).

## Quick start

> **Where things live:** you provide materials in `input/`, the framework writes results to
> `output/`, and pipeline state sits in `workspace/` — all personal and gitignored. The full
> annotated map is [PROJECT_MAP.md](PROJECT_MAP.md).

### 1. Clone

```bash
git clone https://github.com/<you>/<your-repo>.git
cd <your-repo>
```

> [!IMPORTANT]
> **Run your own search from a private repository.** `/setup` writes your personal data (name,
> contact details, employment history, salary expectations) into **tracked** files. If this copy
> is for your own job search rather than for publishing improvements, create a **private
> repository** and push this code there — every workflow works identically. Publish only
> to contribute back, and never after populating your profile.

### 2. Install the portal CLI tools

Bash / zsh / Git Bash:

```bash
for d in .agents/skills/*-search/cli; do (cd "$d" && bun install); done
```

PowerShell:

```powershell
Get-ChildItem ".agents/skills/*-search/cli" | ForEach-Object {
  Push-Location $_.FullName; bun install; Pop-Location
}
```

All CLI tools are built with zero runtime dependencies and run directly with `bun`; `bun install` only pulls TypeScript dev types for typechecking. The loop discovers every installed portal skill automatically — including `careers-search`.

### 3. Set up your profile

```bash
claude          # or: opencode / codex / your AGENTS.md-compatible agent
# Then inside your agent:
/setup
```

`/setup` offers three paths: read your `input/` folder if you have one populated (resume PDF, LinkedIn export, diplomas, reference letters — plus your application archives from `output/applications/`), import a single resume pasted in chat, or walk through an interview. It auto-detects what you have and asks. Input-folder mode is idempotent and safe to re-run as you add more material; see `input/README.md` for what goes where.

### 4. Search for jobs

```bash
/scrape
```

This searches multiple job portals for positions matching your profile, deduplicates results, and presents them sorted by fit. When a scrape returns more jobs than you want to eyeball, run `/rank` to batch-score them against the fit framework and get a ranked shortlist first.

### 5. Apply to a job

```bash
/apply https://jobs.lever.co/cred/<posting-id>
```

If the URL can't be fetched (some job portals block automated access), you can paste the job description directly instead:

```bash
/apply <paste the full job description here>
```

This runs the full workflow: evaluate fit, draft a tailored CV, review with a second agent, revise, and present the final output.

Postings are treated as untrusted input (the workflow follows no instructions embedded in them and fetches no links from their body), but agentic defenses are instruction-level, not a sandbox — on an unfamiliar job board, skim what was fetched and written before you hit send. Details in [SECURITY.md](SECURITY.md).

## Search coverage

Twelve portal skills ship in `.agents/skills/`, all following one contract (a `search`/`detail` Bun CLI, `--format json|table|plain` output, zero runtime dependencies, offline tests):

| Skill | Market | Source |
|---|---|---|
| `linkedin-search` | Global + India cities | LinkedIn public guest search (`-l "Bengaluru, Karnataka, India"`) |
| `naukri-search` | India, experienced professionals | Naukri.com public listings (keyword, location, experience, salary in LPA) |
| `internshala-search` | India, internships & freshers | Internshala jobs/internships |
| `unstop-search` | India, students & campus | Unstop public API (hackathons, hiring challenges) |
| `careers-search` | India + global | **Employers' own career portals** — amazon.jobs, Greenhouse, Lever, SmartRecruiters, Workday boards |
| `cutshort-search` | India, fresher & early-career | Cutshort AI-matched board (category slugs, `internship` category) |
| `wellfound-search` | Global startups | Wellfound (AngelList) role/location slugs |
| `wayup-search` | US early-career | WayUp category search (ships `enabled: false`; flip on for US internships) |
| `remoteok-search` | Global remote | RemoteOK public API |
| `remotive-search` | Global remote | Remotive public API |
| `weworkremotely-search` | Global remote | We Work Remotely RSS feeds |
| `freehire-search` | Multi-market | freehire.me aggregator API (~50 ATS backends) |

A practical stage-based strategy is preconfigured in `search-queries.md`:

**Using ApplyOS in another market.** The framework is English-only everywhere and ships this India edition as its default, but every market-specific behavior hangs off one setting: the `market:` line in the Stage Profile at the top of [`search-queries.md`](.claude/skills/job-scraper/search-queries.md). Set it to `us`, `uk`, `eu`, or `other` (or let `/setup --section search` ask once) and `/scrape` switches to the global portal set — `linkedin-search`, `wellfound-search`, `careers-search`, `freehire-search`, plus `wayup-search` for US internships (flip its `enabled:` line to `true`). Run `/setup` to record the market's cities, currency, and compensation floors; add a local board with `/add-portal`; everything else — ranking, gating, input/, interview prep — works unchanged and in English.

1. **Internships / fresher roles** — internshala + unstop
2. **Experienced roles** — naukri + linkedin + wellfound + company career portals
3. **Global remote** — remoteok + remotive + weworkremotely + linkedin remote filters

To add a job board, run `/add-portal` — it investigates the portal (search-URL pattern, result structure, robots.txt/access rules), scaffolds a CLI skill with the same contract, and test-runs a live query before registering anything. Auth-walled portals are declined.

## Standalone clean-room build (this branch)

Alongside the workflow above, this branch carries a greenfield rebuild under
`standalone/` — a Bun monorepo (`applyos-standalone`, Bun 1.4.2 pinned via
`standalone/.bun-version` + `packageManager`) with one unified binary instead
of twelve hand-rolled CLIs:

- `apps/cli` — the `applyos` binary: `scrape` (unified fan-in with per-source
  notes and `--stage` filters), `rank` (7 gates + stage weights), `apply`
  (tailored pack with claim traces). The primary interface for OpenCode agents.
- `packages/core` — shared contracts (`JobPosting`, `postedDate: null` never
  invented), polite fetch (20 s timeout + 1 retry, ≥300 ms pacing, page cap 3),
  robots gate, dedupe, and `json|table|plain` formatters.
- `packages/company-scraper` — employer ATS boards (amazon.jobs, Greenhouse,
  Lever, SmartRecruiters, Workday) plus `registry.yaml` seeds.
- `packages/portals` — one fresh adapter per board (remoteok, remotive,
  weworkremotely, unstop; freehire fails loudly until its endpoint verifies).
- `packages/matching` + `packages/docgen` — the two-stage ranker and the
  application factory (keyword gaps listed, never stuffed).

Every module is written fresh from public API docs and live responses — nothing
copied from the legacy tree — with per-module origins in
[`standalone/PROVENANCE.md`](standalone/PROVENANCE.md). Run it with
`bun install && bun test` inside `standalone/`; CI covers it on Ubuntu and
Windows (`standalone-checks` job). The audit record, plan, and live status are
a single file: [`docs/STANDALONE_REFACTOR.md`](docs/STANDALONE_REFACTOR.md)
(Part C is updated in place).

## Other commands

`/setup`, `/scrape`, `/rank`, and `/apply` form the core workflow. These extend it once your profile is in place:

- **`/interview`** builds a stage-specific prep pack from the application's archive (the exact posting, the CV the interviewer actually read, feedback from earlier rounds), researches the company, maps likely questions to your STAR examples, and offers a mock interview. Gaps get honest bridge answers, never invented experience.
- **`/outcome`** records what happened to an application and archives the submitted materials into `output/applications/<company>_<role>/`. `/outcome followup` surfaces quiet applications, drafts follow-ups in your writing style (never sends; at most twice per application), and offers thank-you notes the day an interview stage is recorded.
- **`/gmail-sync`** reads your Gmail for status signals on open applications and proposes them as a batch for approval before anything is written, citing the source email on every change. Offers stop short of proposing `hired`/`offer_declined` — that's your call.
- **`/expand`** enriches your profile from public sources you've linked (GitHub, portfolio, Kaggle, Google Scholar), adding competencies with source tags.
- **`/upskill`** analyzes the gap between your profile and your tracked/ranked postings — or a single posting — producing a skill-gap heatmap and a web-searched learning plan.
- **`/html-report`** generates a self-contained offline HTML dashboard from the tracker and archives — stat cards, funnel charts (inline SVG, no dependencies), and a filterable applications table.
- **`/notion-sync`** publishes a one-way, read-only pipeline view into a Notion database via the official MCP server. The repo files stay the system of record.
- **`/add-template`** registers your own CV **or resume** toolchain (LaTeX, Typst, or anything that compiles to PDF from the CLI), with a mandatory test compile. The two types are registered and activated independently.
- **`/add-portal`** generates a portal-search skill for a job board in your market (see above).
- **`/reset`** wipes profile data or the input/ folder — it shows exactly what will be deleted and requires you to type `RESET`.

## File structure

The full annotated map lives in [PROJECT_MAP.md](PROJECT_MAP.md). Short version:

```
applyos/
├── INPUT ──────────────────────────────────────────────────────────
│   └── input/                     # Your career source materials (gitignored).
│       │                          # Put your details HERE: resume, diplomas,
│       ├── cv/                    #   LinkedIn export, references, postings.
│       ├── linkedin/  diplomas/   #   Then run /setup.
│       ├── references/  postings/
│       └── README.md              # START-HERE guide: what to put where.
├── OUTPUT ─────────────────────────────────────────────────────────
│   └── output/                    # Everything the framework generates (personal).
│       ├── cv/                    # Tailored CV/resume .tex + compiled PDFs (/apply)
│       ├── applications/          # Per-application archives (/apply, /outcome, /interview)
│       ├── research/              # Company cache + manual search results
│       └── reports/               # /html-report dashboards, /upskill reports
├── STATE ──────────────────────────────────────────────────────────
│   └── workspace/                 # Pipeline state (gitignored): seen_jobs.json,
│                                  #   job_search_tracker.csv, gmail_sync/
├── AGENT & RUNTIME FOLDERS (fixed names — do not rename) ─────────
│   ├── .claude/                   # Commands, methodology skills, permissions
│   ├── .agents/skills/            # Portal CLIs + mirrored methodology skills
│   ├── .opencode/  .codex/  .zcode/  .freebuff/
│   │                          # (Cline/Cursor/Gemini adapters removed 2026-10-07)
│   └── .github/                   # CI workflows, templates
├── STANDALONE (clean-room rebuild, this branch) ──────────────────
│   └── standalone/                # Greenfield monorepo: `applyos` CLI + packages
│       ├── apps/cli/              # Unified `applyos` binary (scrape|rank|apply)
│       ├── packages/core/         # Contracts, polite fetch, robots gate, dedupe
│       ├── packages/company-scraper/  # Employer ATS boards + registry.yaml
│       ├── packages/portals/      # Fresh per-board adapters
│       ├── packages/matching/ + packages/docgen/  # Ranker + application factory
│       ├── PROVENANCE.md          # Clean-room origin log (every module)
│       └── README.md              # Standalone overview (plan lives in
│                                  #   docs/STANDALONE_REFACTOR.md Part C)
├── FRAMEWORK INTERNALS ────────────────────────────────────────────
│   ├── templates/                 # Stock LaTeX (cv-stock/) + custom templates
│   ├── docs/                      # Design docs, audits, examples
│   ├── tools/  tests/  salary_lookup.py
│   └── README.md  SETUP.md  AGENTS.md  CLAUDE.md  PROJECT_MAP.md
```

## How `/apply` works

The `/apply` command runs a **drafter-reviewer workflow** with mandatory PDF compilation:

1. **Parse** the job posting (URL or text)
2. **Evaluate fit** against your profile (skills, experience, culture, location, career alignment)
3. **Draft** a tailored CV or resume in LaTeX (`--resume` / `--cv`; defaults to your profile's `Document type:`), compiled into `output/cv/`
4. **Spawn a reviewer agent** that researches the company and critiques the drafts
5. **Revise** based on the reviewer's feedback
6. **Compile and inspect** the PDF: `lualatex` for the CV. Claude reads the rendered pages and iterates until the CV is exactly 2 pages (1 for students and freshers) with no orphaned entry titles.
7. **ATS-check the CV**: extract the PDF's text layer and verify it the way an ATS parser sees it — contact details as literal text, no garbled glyphs, sane reading order — then score the posting's keyword coverage against the extraction. Keywords the profile genuinely supports get added; genuine gaps stay visible, never stuffed.
8. **Present** the final output with a verification checklist

All claims in the CV are verified against your actual profile. The system never fabricates skills or experience.

**What makes this workflow different:**

- **PDF verification loop** — compiles and visually inspects every PDF, fixing orphaned titles, overflowing pages, and silent font fallbacks before you see the output.
- **ATS verification on the text layer** — an ATS reads the PDF's embedded text, not the rendered page; the workflow verifies what a parser actually sees.
- **Relevance-weighted CV cutting** — when a CV overflows 2 pages, lines are scored by posting relevance, uniqueness, and narrative load, and the lowest scorer is cut first.
- **Drafter-reviewer separation** — a second agent with fresh context critiques the drafts; the drafter revises. This catches missed keywords and generic framing a single pass leaves in.

## Customization

### Which files to edit manually

If you prefer editing files directly instead of using `/setup` (these live under `.claude/skills/job-application-assistant/`, except `search-queries.md`, which is under `.claude/skills/job-scraper/`):

| File | What to change |
|------|---------------|
| `CLAUDE.md` | Your full profile (name, education, experience, skills, goals) |
| `01-candidate-profile.md` | Structured version of your CV data |
| `02-behavioral-profile.md` | Your behavioral assessment or self-assessment |
| `04-job-evaluation.md` | Skill match areas, career goals, motivation filters |
| `05-cv-templates.md` | Profile statement templates for different role types |
| `07-interview-prep.md` | Your STAR examples from actual experience |
| `search-queries.md` | Job search queries, stage mapping, and locations |

### Updating your search configuration

As your priorities evolve, reconfigure just the job search without re-running the full profile setup:

```
/setup --section search
```

This re-runs the search interview: roles to target, skills to search, locations, and portals. The shipped `search-queries.md` already carries a working India + remote default with a stage-to-portal mapping, so `/scrape` is useful before you personalize anything.

### Custom templates

Two stock templates ship, both [moderncv](https://ctan.org/pkg/moderncv) banking with Latin Modern Sans (a professional, ATS-safe pairing): `templates/cv-stock/main_example.tex` is the 2-page **CV** (core competencies, publications, awards), and `templates/cv-stock/resume_example.tex` is the 1-page **resume** (skills line, projects above education, no publications/awards). To use your own templates instead — LaTeX, [Typst](https://typst.app/), or any CLI toolchain — run `/add-template`. It interviews you for the template's instructions (source extension, compile command, fonts, style rules, page limit), stores everything under `templates/`, runs a mandatory test compile, and activates it for `/apply`. Templates are stored with `[PLACEHOLDER]` tokens instead of personal data, so they're safe to commit and share.

- `/add-template --list` shows registered templates
- `/add-template --use <name>` switches between them
- `/add-template --use default` reverts to the stock templates

### Salary benchmarking

If you have salary data (salary surveys, Glassdoor India, AmbitionBox, personal research), create `salary_data.json` in the repo root — `tools/convert_salary_excel.py` converts Excel exports, and `salary_lookup.py` does fuzzy company lookup with Indian legal-suffix handling. Without the file, the salary step is skipped.

### Extending the framework

The framework has three extension points, none requiring core changes:

1. **Portal skills** — every `*-search` skill is self-contained under `.agents/skills/` with the same contract; `/scrape` auto-discovers any skill that follows it. `/add-portal` generates new ones.
2. **Document templates** — `/add-template` registers any CV toolchain that compiles to PDF from the command line.
3. **Evaluation criteria** — deal-breakers and preferences in your profile are free-form; the rubric scores against whatever you put there. Each is one profile line, no code, and it carries real weight in `/rank` and `/apply` fit evaluations.

Before adopting a portal skill from anywhere outside this repo, read its code in full — these CLIs run pre-approved against your career data — and run its tests offline (`bun test` in the skill's `cli/`). The copy step is manual on purpose: an installer that fetched skills from third-party repos would skip the one check that matters, you reading the code first.

## Roadmap

Active work on this branch is tracked in
[docs/STANDALONE_REFACTOR.md](docs/STANDALONE_REFACTOR.md) — a single file
holding the whole-repo audit record (Part A), the clean-room plan (Part B),
and the live status with SLO scoreboard (Part C, updated in place). The
stage-aware search engine is shipped (portal sets auto-selected per career
stage inside `/scrape`, including `cutshort-search`; Cuvette, Instahyre and
Hirist were investigated and declined with evidence). CI enforces the
settings↔skills pairing, and the `standalone-checks` job covers the
`standalone/` monorepo on Ubuntu and Windows. The earlier
[docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md) pass is a closed record — kept
as evidence, not resumed. The design and verified endpoints for the
company-portal scraper are in
[docs/COMPANY_PORTAL_SCRAPER.md](docs/COMPANY_PORTAL_SCRAPER.md).

## Tips for better results

**Profile depth matters.** The single biggest factor in output quality is how much detail you put into your profile. Don't just list job titles — describe specific projects, tools, responsibilities, and measurable achievements. "Built ML pipelines for customer churn prediction in Python using scikit-learn" gives the system far more to work with than "Python, machine learning."

**Career path discovery.** Beyond explicit targeting, the framework can surface paths you haven't considered: transferable skills that map to unexpected industries, or emerging roles that combine your domain expertise with new technology. Invest time during `/setup` describing not just your experience, but what energized you, what drained you, and what you'd want more of.

## Contributing

Thinking about a PR? Read [CONTRIBUTING.md](CONTRIBUTING.md) first — it explains what belongs in the core, what belongs in a personal fork, and why.

## Acknowledgements

- [Mads Lorentzen](https://github.com/MadsLorentzen) — creator of the original [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) framework this edition is built on (the core application pipeline, the drafter-reviewer design, and the verification loops are upstream work, used under MIT)
- [Mikkel Krogholm](https://github.com/mikkelkrogsholm) ([skills repo](https://github.com/mikkelkrogsholm/skills)) for the job search CLI skills lineage
- Built with [Claude Code](https://claude.com/claude-code) by [Anthropic](https://anthropic.com)

## License

MIT — see [LICENSE](LICENSE), Copyright (c) 2026 ApplyOS contributors. Free for anyone
to use, adapt, and build on. This edition is built on the original ai-job-search framework by
Mads Lorentzen; the derivation and lineage are recorded in [NOTICE](NOTICE) and the
acknowledgements below.
