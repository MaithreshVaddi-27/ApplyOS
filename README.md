<p align="center">
  <img src="assets/mascot/applyos-mascot.svg" alt="ApplyOS" width="200">
</p>

# ApplyOS — India + Global Remote Edition

<p align="center">
  <a href="https://github.com/MaithreshVaddi-27/ApplyOS/actions/workflows/ci.yml"><img src="https://github.com/MaithreshVaddi-27/ApplyOS/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-1.4.3-black?logo=bun" alt="Bun"></a>
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.10%2B-blue?logo=python" alt="Python"></a>
</p>

**A local-first job application system.** Fill in your profile once, then let your AI coding agent search job portals, score each posting against a transparent rubric, draft and verify a tailored CV, and prepare you for interviews. The reference runtime is [OpenCode](https://opencode.ai); the framework is runtime-agnostic.

> This is an independent open-source project, not affiliated with Anthropic. It has no cryptocurrency, token, or paid sponsorship program — anything claiming otherwise is unauthorized.

> **Privacy notice:** `/setup` writes personal data into tracked files. For your own job search, clone into a **private** repository. Publish only to contribute back, and never after populating your profile. See [SECURITY.md](SECURITY.md).

**Jump to:** [Quick start](#quick-start) · [Applications](#applications) · [Command reference](#command-reference) · [Search coverage](#search-coverage) · [Project structure](#project-structure) · [Verification](#verification) · [Contributing](#contributing)

---

## Overview

ApplyOS combines two layers that share one scoring model:

- **The workflow layer** — Markdown specifications and portal-search CLIs that any AI agent can execute. This is where `/setup`, `/scrape`, `/rank`, and `/apply` live.
- **The engine** — a deterministic, zero-runtime-dependency Bun workspace that provides the canonical contracts, scoring, document generation, and two runnable applications.

The core pipeline is language- and market-agnostic. This edition ships an India + global-remote default, switchable to any market through one `market:` setting in [search-queries.md](.claude/skills/job-scraper/search-queries.md).

What ApplyOS deliberately does **not** do: hosted service, telemetry, multi-language documents, a web UI, auto-submission, or email sending. It is a private, local, LaTeX-based workflow — not a job marketplace. Distribution is "clone the repository."

## Applications

This is the executable surface of the repository. Every path below exists as tracked code.

### Engine applications (`applyos/apps/`)

| Application | Purpose |
|---|---|
| [`apps/cli`](applyos/apps/cli) | The `applyos` binary: `scrape`, `rank`, `apply` (with `--batch`), `tracker`, `snapshot`, `profile validate`, `eval`, `doctor`, `contract`, `--version`. Its surface is stable and additive-only; it never branches on which agent calls it. |
| [`apps/tui`](applyos/apps/tui) | `applyos-tui`, a read-only terminal view over the tracker snapshot: pipeline state, ranked shortlist with verdict bands and gaps, and posting detail with the score explanation and quoted evidence. No framework, no write path. |

### Engine packages (`applyos/packages/`)

| Package | Purpose |
|---|---|
| [`provider`](applyos/packages/provider) | The single provider implementation per board, backed by one `registry.yaml` with 14 entries — six aggregators and eight ATS providers. Both portal CLIs and engine commands are thin surfaces over it. |
| [`core`](applyos/packages/core) | Shared contracts and utilities: `JobPosting` types, polite fetch, robots gate, deduplication, fair-slice interleave, snapshot, byte-preserving tracker writer, and output formatters. |
| [`company-scraper`](applyos/packages/company-scraper) | Employer career-site adapters (Greenhouse, Lever, SmartRecruiters, Workday, Amazon) with seven seeded companies, including a live-verified Workday tenant. |
| [`portals`](applyos/packages/portals) | Six thin aggregator adapters (RemoteOK, Remotive, We Work Remotely, Unstop, freehire, Arbeitnow) over the provider SDK. |
| [`matching`](applyos/packages/matching) | The explainable ranker: nine gates, four weighted dimensions, five verdict bands. Gates that lack evidence report `not evaluated` instead of inventing a finding. |
| [`docgen`](applyos/packages/docgen) | The application factory and Document Manifest: keyword gaps are listed, never stuffed. |

### Other components

| Component | Purpose |
|---|---|
| `.agents/skills/*-search/` | Thirteen zero-dependency Bun CLIs that query job boards (twelve enabled by default). The workflow layer's source for `/scrape`. |
| `.claude/` | Canonical slash-command and methodology specifications — the single source of truth. |
| `.opencode/`, `.codex/`, `.agents/skills/source-command-*` | Thin adapter pointers to the canonical specs. Runtime folders have fixed names; do not rename them. |
| `applyos/evals/` | A redacted, provenance-tagged corpus and four offline deterministic runners with a committed baseline and a CI tolerance gate. |
| `tools/` | Python tooling for verification, scoring parity, PDF/ATS checks, link checks, and security guards. |
| `templates/cv-stock/` | The stock moderncv LaTeX templates that `/apply` tailors and compiles. |

Module origins are recorded in [applyos/PROVENANCE.md](applyos/PROVENANCE.md) and the engineering history in [docs/PROJECT_BLUEPRINT.md](docs/PROJECT_BLUEPRINT.md).

## Why ApplyOS

These are repository facts you can verify, not aspirations:

| Claim | Where to verify |
|---|---|
| LaTeX documents with a verified ATS text layer | `templates/cv-stock/`, `tools/verify_pdf.py --check-ats`, two TeX Live CI legs |
| India-specific job intelligence | The market × stage matrix in [search-queries.md](.claude/skills/job-scraper/search-queries.md) and the batch, stipend, CTC, and notice-period gates |
| Local-first, enforced by CI | `tools/security_guards.py`, `tools/check_specs.py`, and the data-flow inventory in [docs/security/privacy.md](docs/security/privacy.md) |
| A deterministic core with an explainable score | `applyos/packages/matching/`, the nine gates, the `not evaluated` discipline, and [docs/engineering/evaluation.md](docs/engineering/evaluation.md) |
| One implementation per board | `applyos/packages/provider/registry.yaml`, guarded in CI |
| Runtime-agnostic | The thin-pointer design and ADR-0001/ADR-0002 in [docs/architecture/adr](docs/architecture/adr) |

## Runtime support

The workflow specs live once under `.claude/`; every other runtime uses thin pointers, so there are no duplicated instructions to drift. [AGENTS.md](AGENTS.md) is the universal entry point and carries the full command-routing table.

| Runtime | Loads | Slash commands |
|---|---|---|
| OpenCode (reference) | `AGENTS.md` + `opencode.json` | `.opencode/command/*.md` |
| Claude Code | `CLAUDE.md` + `.claude/skills/` + `.claude/agents/` | native |
| ZCode / Google Antigravity | `AGENTS.md` + `.agents/skills/` | routing table |
| Codex CLI | `AGENTS.md` | ask for the workflow by name |
| FreeBuff and others | `AGENTS.md` (or equivalent) | routing table |

A CI spec guard pins the parity invariant: each canonical workflow has its adapters, each adapter references a real spec, and the routing table covers everything.

## Prerequisites

- **An AI coding agent** — [OpenCode](https://opencode.ai) is the reference runtime; the runtimes above work through adapters.
- **Python 3.10+** (CI uses 3.12).
- **[Bun](https://bun.sh)** for the portal and engine CLIs.
- **A LaTeX distribution with `lualatex`** — [TeX Live](https://tug.org/texlive/), [MacTeX](https://tug.org/mactex/), [TinyTeX](https://yihui.org/tinytex/), or [MiKTeX](https://miktex.org/). See [SETUP.md](SETUP.md) for minimal installs.
- **Optional:** `pypdf` for the ATS parseability check (Poppler `pdftotext` is a fallback).

## Quick start

> You provide materials in `input/`, the framework writes to `output/`, and pipeline state lives in `workspace/` — all personal and gitignored. The annotated map is [PROJECT_MAP.md](PROJECT_MAP.md).

### 1. Clone

> [!IMPORTANT]
> **Run your own search from a private repository.** `/setup` writes your personal data (name, contact details, employment history, salary expectations) into **tracked** files. If this copy is for your own job search rather than for publishing improvements, create a private repository and push this code there — every workflow works identically. Publish only to contribute back, and never after populating your profile.

```bash
git clone https://github.com/<you>/<your-repo>.git
cd <your-repo>
```

There is no package installer: cloning **is** the distribution. Contributors add the canonical remote with `git remote add upstream https://github.com/MaithreshVaddi-27/ApplyOS.git`; see [CONTRIBUTING.md](CONTRIBUTING.md).

### 2. Install and verify the toolchain

```bash
./scripts/bootstrap.sh          # PowerShell: .\scripts\bootstrap.ps1
```

One command checks the toolchain, installs every dependency surface, and runs the same checks as CI. It never touches `input/`, `output/`, or `workspace/`. To do it manually:

```bash
cd applyos && bun install --frozen-lockfile && cd ..
for d in .agents/skills/*-search/cli; do (cd "$d" && bun install); done
```

Verify with `bun run applyos/apps/cli/src/cli.ts doctor` — offline by default; `--check-remote` is the only flag that reaches the network.

### 3. Build your profile

```bash
claude          # or: opencode / codex / your AGENTS.md-compatible agent
# inside the agent:
/setup
```

`/setup` reads `input/`, imports a pasted resume, or walks you through an interview. Input-folder mode is idempotent; see [input/README.md](input/README.md).

### 4. Search and shortlist

```bash
/scrape
/rank
```

`/scrape` searches the configured portals, deduplicates, and presents matches by fit. `/rank` batch-scores a large result set into a shortlist.

### 5. Apply

```bash
/apply https://jobs.lever.co/cred/<posting-id>
```

If a portal blocks automated access, paste the full job description instead (`/apply <description>`). Postings are untrusted input: the workflow follows no instructions embedded in them and fetches no links from their body — see [SECURITY.md](SECURITY.md).

## Command reference

### Workflow commands

| Command | Purpose |
|---|---|
| `/setup` | Build your profile from `input/`, a pasted resume, or an interview. `--section search` reconfigures only the search. |
| `/scrape` | Search portals, deduplicate, present ranked matches. |
| `/rank` | Batch-score postings against the nine-gate fit framework. |
| `/apply` | Evaluate fit, draft and verify a tailored CV, review with a second agent, revise, present. |
| `/interview` | Build a stage-specific prep pack from the application archive, with a mock interview. |
| `/outcome` | Record an application result; `followup` surfaces quiet applications and drafts follow-ups (never sends). |
| `/gmail-sync` | Propose application status updates from Gmail for approval before anything is written. |
| `/expand` | Enrich the profile from public sources you have linked. |
| `/upskill` | Produce a skill-gap heatmap and a learning plan from your profile and postings. |
| `/html-report` | Generate a self-contained offline dashboard from the tracker and archives. |
| `/notion-sync` | Publish a one-way read-only pipeline view to Notion; repo files stay the system of record. |
| `/add-portal`, `/add-template` | Register a new job board or a custom CV toolchain. |
| `/reset` | Wipe profile data or `input/` behind an explicit `RESET` confirmation. |

### Engine commands

The `applyos` binary exposes `scrape`, `rank`, `apply` (including `--batch`), `tracker list|set|migrate`, `snapshot`, `profile validate`, `eval`, `doctor`, and `contract`. Run `applyos --help` for the full flag reference. `snapshot` is the stable, read-only consumer contract used by `apps/tui`.

## Search coverage

Thirteen portal CLIs ship in `.agents/skills/` (twelve enabled by default; `wayup-search` is off for US internships). All follow one contract: a `search`/`detail` Bun CLI, `--format json|table|plain`, zero runtime dependencies, offline tests.

| Skill | Market | Source |
|---|---|---|
| `linkedin-search` | Global + India cities | LinkedIn public guest search |
| `naukri-search` | India, experienced | Naukri public listings |
| `internshala-search` | India, internships & freshers | Internshala |
| `unstop-search` | India, students & campus | Unstop public API |
| `careers-search` | India + global | Employers' own career portals (Greenhouse, Lever, SmartRecruiters, Workday, Amazon) |
| `cutshort-search` | India, early career | Cutshort |
| `wellfound-search` | Global startups | Wellfound (AngelList) |
| `wayup-search` | US early career | WayUp (disabled by default) |
| `remoteok-search` | Global remote | RemoteOK API |
| `remotive-search` | Global remote | Remotive API |
| `weworkremotely-search` | Global remote | We Work Remotely RSS |
| `freehire-search` | Multi-market | freehire.me aggregator |
| `arbeitnow-search` | EU remote | Arbeitnow API |

Stage-based defaults in [search-queries.md](.claude/skills/job-scraper/search-queries.md) pick the right portals automatically for internships, experienced roles, and global remote. To use another market, change the `market:` line to `us`, `uk`, `eu`, or `other`; run `/add-portal` to add a local board. See [docs/COMPANY_PORTAL_SCRAPER.md](docs/COMPANY_PORTAL_SCRAPER.md) for the employer-portal design.

## Project structure

The authoritative annotated map is [PROJECT_MAP.md](PROJECT_MAP.md).

```text
ApplyOS/
├── input/                  # Your career materials (personal, gitignored)
├── output/                 # Generated CVs, archives, research, reports (personal)
├── workspace/              # Pipeline state and tracker (personal, gitignored)
├── applyos/                # Deterministic engine — Bun workspace
│   ├── apps/cli/           #   applyos binary
│   ├── apps/tui/           #   read-only terminal view
│   ├── packages/           #   core, provider, company-scraper, portals,
│   │                       #   matching, docgen
│   ├── evals/              #   redacted corpus + offline runners
│   └── PROVENANCE.md       #   clean-room origin log
├── .agents/skills/         # Portal-search CLIs + mirrored methodology skills
├── .claude/                # Canonical commands and specifications
├── .opencode/  .codex/     # Thin runtime adapters
├── templates/cv-stock/     # Stock LaTeX CV and resume
├── tools/  tests/          # Python tooling and the test suite
├── scripts/                # bootstrap + one-command verification
├── docs/  examples/        # Design docs, guides, worked examples
└── framework/scoring.json  # Canonical scoring tables (single source of truth)
```

Agent and runtime folders have fixed names — do not rename them. The scoring tables in `framework/scoring.json` are read by the specs, the tooling, and the engine; `tools/spec_parity.py` fails if they disagree.

## How `/apply` works

1. **Parse** the posting (URL or pasted text).
2. **Evaluate fit** against your profile across skills, experience, behaviour, and career alignment.
3. **Draft** a tailored CV or resume in LaTeX.
4. **Review** with a second agent that researches the company and critiques the draft.
5. **Revise** from that feedback.
6. **Compile and inspect** the PDF with `lualatex`, iterating until it meets the page limit with no orphaned titles.
7. **ATS-check** the embedded text layer the way a parser sees it, then score keyword coverage — genuine gaps stay visible and are never stuffed.
8. **Present** the final output with a verification checklist.

Every claim is checked against your actual profile; the system never fabricates skills or experience.

## Verification

All acceptance checks are offline and deterministic. Run the same command CI runs:

```bash
python tools/check_contribution.py    # or scripts/check.sh / scripts/check.ps1
```

It verifies the engine install, Python tool tests, skill linting, security guards, spec conformance, links, stage parity, evaluation suites, engine tests and typechecks, and the worked example. The Python suite alone is `python -m unittest discover -s tests -t .`. CI runs the full matrix on Ubuntu, Windows, and macOS.

## Customization and extension

- **Profile files** live under `.claude/skills/job-application-assistant/`; edit them directly or use `/setup`. `CLAUDE.md` holds the full profile.
- **Search configuration** is isolated in `search-queries.md`; `/setup --section search` re-runs just that interview.
- **Document templates** — `/add-template` registers any CV toolchain that compiles to PDF from the command line (LaTeX, Typst, or other).
- **Portal skills** — `/add-portal` scaffolds a new board with the standard contract. Read a portal CLI's code in full before adopting it; the copy step is deliberately manual.
- **Evaluation criteria** — deal-breakers and preferences are free-form profile lines that carry real weight in `/rank` and `/apply`.

Salary benchmarking is optional: copy `salary_data.example.json` to `salary_data.json` and see [tools/salary_tool.md](tools/salary_tool.md). Without the file the salary step is skipped.

## Status and roadmap

The twelve-phase engineering blueprint is complete; current state is in [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) and the plan in [docs/PROJECT_BLUEPRINT.md](docs/PROJECT_BLUEPRINT.md). Earlier audits under `docs/` are kept as historical records, not live backlogs — their numeric baselines are superseded by the grown suite.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR: it separates core changes from personal forks. To add a board, follow the worked example in [examples/example-search/](examples/example-search/) and the contribution funnel. Verify locally with `python tools/check_contribution.py`; PRs target `https://github.com/MaithreshVaddi-27/ApplyOS` (`main`).

## Acknowledgements

- [Mads Lorentzen](https://github.com/MadsLorentzen) — creator of the original [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) framework this edition builds on (core pipeline, drafter-reviewer design, verification loops; MIT).
- [Mikkel Krogholm](https://github.com/mikkelkrogsholm) — the job-search CLI skill lineage.
- Built with [OpenCode](https://opencode.ai), this edition's reference runtime. Claude Code by [Anthropic](https://anthropic.com) remains a fully supported runtime via the `.claude/` specifications.

## License

MIT — see [LICENSE](LICENSE), Copyright (c) 2026 ApplyOS contributors. The derivation from the original ai-job-search framework is recorded in [NOTICE](NOTICE).
