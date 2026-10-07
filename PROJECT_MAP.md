# ApplyOS Project Map

One page that says what every folder is for, what you put where, and where
results come out. The README's [File structure](README.md#file-structure)
section carries the short version; this file is the authoritative one.

## The 30-second version

1. **You provide**: your resume, diplomas, LinkedIn export, references, and any
   saved job postings → drop them in [`input/`](input/README.md).
2. **Run** `/setup` (builds your profile), then `/scrape` → `/rank` → `/apply`.
3. **You get back**: tailored CVs and compiled PDFs in `output/cv/`, per-application
   archives in `output/applications/`, research in `output/research/`, and reports
   in `output/reports/`. The pipeline's state lives in `workspace/`.

```
input/  ──▶  /setup  ──▶  /scrape ─▶ /rank ─▶ /apply ──▶  output/
(profile)   (profile      (jobs)   (scores)  (CV/PDF,    (tailored CV,
 files)      files)                          archive)     archives, reports)
                                     all pipeline state: workspace/
```

## Folders

### `input/` — what YOU provide (personal, gitignored)

| Subfolder | Put here | Read by |
|---|---|---|
| `cv/` | Your current resume (`.pdf` preferred; convert `.docx`) | `/setup` Path A, `/expand` |
| `linkedin/` | LinkedIn profile export (PDF/HTML) | `/setup` Path A |
| `diplomas/` | Degree certificates, transcripts | `/setup` Path A |
| `references/` | Recommendation letters, referee contacts | `/setup` Path A |
| `postings/` | Job posting text you saved yourself | `/apply`, `/rank` |

See [`input/README.md`](input/README.md) for formats and the step-by-step.

### `output/` — what the framework generates (personal, gitignored)

| Subfolder | Written by | Contains |
|---|---|---|
| `cv/` | `/apply` | Tailored `main_<company>_<role>.tex`/`.pdf` and `resume_*` |
| `applications/` | `/apply`, `/outcome`, `/interview` | One `<company>_<role>/` archive per application: posting, drafts, outcomes, prep packs |
| `research/` | `/apply` Step 3, `/interview` Step 2, manual searches | `company_research` cache JSON + shareable search-result notes |
| `reports/` | `/html-report`, `/upskill` | HTML dashboards, skill-gap reports |

### `workspace/` — pipeline state (personal, gitignored)

| File | Owner | Holds |
|---|---|---|
| `seen_jobs.json` | `/scrape`, `/rank` | Every posting seen, scores, verdicts, deadlines |
| `job_search_tracker.csv` | `/outcome`, `/apply`, `/gmail-sync` | The application tracker (one row per application) |
| `gmail_sync/` | `/gmail-sync` | Sync state (processed message IDs) |

### Agent & runtime folders (fixed names — never rename)

| Folder | Runtime | Role |
|---|---|---|
| `.claude/` | Claude Code | `commands/` (the 12 slash commands), `skills/` (methodology: job-scraper, job-application-assistant, upskill), `settings.json` permissions |
| `.agents/skills/` | Codex, Antigravity, any runtime | Portal-search CLIs (one per job board) + byte-identical mirrors of the three methodology skills (enforced by CI) |
| `.opencode/` | OpenCode (reference runtime) | Command adapters + subagent, thin pointers to `.claude` specs |
| `.codex/` | Codex CLI | Agent mirror (thin pointer) |
| `.zcode/` | ZCode | Plans + native skill discovery |
| `.github/` | CI | Lint + security guards + 441 tests + LaTeX smoke + CLI typechecks |

The workflow logic lives in the markdown specs (`.claude/commands/` and
`.claude/skills/`) — they are the implementation. `.agents/skills/<portal>-search/cli/`
holds the runnable Bun CLIs that touch the job boards.

### Framework internals (tracked, shared)

| Path | Role |
|---|---|
| `templates/cv-stock/` | The stock LaTeX CV and resume the framework compiles and tailors from |
| `templates/` | Custom CV/resume templates registered via `/add-template` |
| `tools/` | Python tooling: `rank_state.py` (state engine), `security_guards.py`, `verify_pdf.py`, `lint_skills.py`, `robots_check.py` |
| `tests/` | 441-test suite pinning the contracts above |
| `docs/` | Design docs, audits, and `examples/` (shareable sample outputs) |
| `salary_lookup.py` + `salary_data.json` (you create) | Salary benchmarking; `salary_data.example.json` is the starter |

## Who writes where (quick reference)

| Command | Reads | Writes |
|---|---|---|
| `/setup` | `input/**` | `.claude/skills/job-application-assistant/01-*`…`09-*`, `CLAUDE.md`, `search-queries.md` |
| `/scrape` | portal CLIs, `search-queries.md` | `workspace/seen_jobs.json`, `output/applications/` (skipped-application docs) |
| `/rank` | `workspace/seen_jobs.json` + tracker | `workspace/seen_jobs.json` (scores/verdicts) |
| `/apply` | posting, profile files, `output/research/` | `output/cv/`, `output/applications/<company>_<role>/`, `workspace/job_search_tracker.csv` |
| `/outcome` | tracker, `output/applications/` | tracker, archive `outcome.md`, `output/reports/` |
| `/interview` | archive, `output/research/` | `output/applications/<company>_<role>/interview_prep_<stage>.md` |
| `/html-report` | tracker, `output/applications/` | `output/reports/application-dashboard.html` |
| `/upskill` | tracker, `workspace/seen_jobs.json` | `output/reports/upskill/report-*.md` |

## Personal data: what never leaves the machine

`input/**` (except README/gitkeeps), `output/**` (except gitkeeps and the
tracked `output/research/*.md` search notes), `workspace/**`, `salary_data.json`.
These rules are pinned in `tools/security_guards.py` and enforced by CI — see
[SECURITY.md](SECURITY.md).
