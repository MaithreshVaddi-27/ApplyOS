# Getting Started

> **Verified against `78813db` on 2026-11-13.**
> `scripts/bootstrap.*` lands in Phase 1. Until then, use the manual steps below.

---

## 1. Prerequisites

| Tool | Version | Needed for | If missing |
|---|---|---|---|
| **Python** | 3.10+ (3.12 in CI) | `tools/`, `tests/`, `salary_lookup.py` | The whole framework |
| **Bun** | 1.4.3 (`applyos/.bun-version`) | The engine and the 12 provider CLIs | `/scrape` fails loudly at its tool check |
| **LaTeX** with `lualatex` | TeX Live / MacTeX / TinyTeX / MiKTeX | `/apply` Step 5 | `/apply` fails loudly in `/setup`'s toolchain pre-flight |
| **Poppler** (`pdftotext`, `pdfinfo`) | any recent | The PDF text layer | Use `pip install pypdf` instead — `verify_pdf.py` tries it first |
| **git** | any | Branching, the privacy check | The privacy check is skipped (and the warning is lost) |

**Minimal TeX Live.** `moderncv` loads `fontawesome5` (in `texlive-fonts-extra`), and `hyperref`
probes the `pzdr` metrics (in `texlive-fonts-recommended`). Missing either is a **fatal**
error, not a warning. On Debian/Ubuntu:

```bash
sudo apt install -y --no-install-recommends \
  texlive-luatex texlive-latex-extra \
  texlive-fonts-extra texlive-fonts-recommended \
  poppler-utils
```

On macOS: `brew install --cask mactex` (large) or `brew install poppler` for the PDF tools.

**Optional: `pypdf`.**

```bash
pip install pypdf     # avoids needing Poppler
```

---

## 2. Clone — carefully

```bash
git clone https://github.com/<you>/<your-private-repo>.git
cd <your-private-repo>
```

> ⚠️ **Use a private repository.** `/setup` writes your name, contact details, employment
> history, and salary expectations into **tracked** files. A fork of the public template cannot
> be made private.

If you are contributing upstream, clone the canonical repo and add the upstream remote:

```bash
git clone https://github.com/MaithreshVaddi-27/ApplyOS.git
cd ApplyOS
git remote add upstream https://github.com/MaithreshVaddi-27/ApplyOS.git
```

---

## 3. Install

### The manual way (today)

```bash
# The engine — this step is easy to miss; the README's loop does not cover it
cd applyos && bun install --frozen-lockfile && cd ..

# The twelve provider CLIs
for d in .agents/skills/*-search/cli; do (cd "$d" && bun install); done
```

PowerShell:

```powershell
Push-Location applyos; bun install --frozen-lockfile; Pop-Location
Get-ChildItem ".agents/skills/*-search/cli" | ForEach-Object {
  Push-Location $_.FullName; bun install; Pop-Location
}
```

**Why the engine needs its own install.** The engine is a Bun workspace; `@applyos/core` and
friends resolve through workspace links that only exist after `bun install` in `applyos/`.
Skipping it makes `bun test` fail with `Cannot find module '@applyos/core'` — which looks like a
broken repository but is a missing install step. Phase 1 fixes this with a bootstrap script.

**What `bun install` actually fetches.** The provider CLIs have **zero runtime dependencies** —
`bun install` pulls TypeScript types for typechecking and nothing else.

### The way it should be (Phase 1)

```bash
./scripts/bootstrap.sh          # or scripts/bootstrap.ps1
applyos doctor                  # what is installed, what is missing
```

---

## 4. Verify

```bash
# Python tooling and specs
python -m unittest discover -s tests -t .

# The engine
cd applyos && bun run test && bun run --filter "*" typecheck && cd ..

# The provider CLIs
for d in .agents/skills/*/cli; do (cd "$d" && bun run test); done

# The repository's own guards
python tools/lint_skills.py
python tools/security_guards.py
python tools/check_framework_version.py
```

**Expected:** 492 Python tests pass (1 skipped), 168 engine tests pass, all 12 provider CLI suites
pass, and the three guards report OK.

---

## 5. Set up your profile

**Inside your agent** — Claude Code, OpenCode, Codex, or anything that reads `AGENTS.md`:

```
/setup
```

Three paths, chosen by the command:

| Path | Input | Effort |
|---|---|---|
| **A** | `input/` populated with your CV, LinkedIn export, diplomas, references | Lowest |
| **B** | One resume pasted into the chat | Low |
| **C** | A 9-section interview | Highest |

Path A is **idempotent** — re-run it as you add material.

**What it writes:**

| File | Contents |
|---|---|
| `CLAUDE.md` | The Candidate Profile block |
| `01-candidate-profile.md` | Identity, education, experience, skills, the `Document type:` line |
| `02-behavioral-profile.md` | Behavioural evidence and STAR material |
| `04-job-evaluation.md` | The fit framework — dimensions, weights, gates |
| `05-cv-templates.md` | Document rules and the LaTeX contact block |
| `07-interview-prep.md` | STAR answers |
| `templates/cv-stock/main_example.tex`, `resume_example.tex` | Your details in the stock templates |
| `.claude/skills/job-scraper/search-queries.md` | The Stage Profile — stage, market, floors, cities |
| `salary_data.json` | Copied from `salary_data.example.json` |

**The privacy check.** `/setup` Step 0 checks your git remote's visibility **before** writing
anything. If it is public, it warns. Read that warning.

---

## 6. Your first search

```
/scrape
```

The first run asks one question — your **stage** — and records it in the Stage Profile so it
never asks again:

> *"What stage are you searching from: student (seeking internships), fresher (graduated, 0-1
> yr), experienced (1+ yr), or remote-global (remote roles abroad/India-remote)?"*

The stage selects the portal set, the ranking weights, and the stage-conditional gates. The
market (`india`, `global`, `us`, `uk`, `eu`, `other`) selects the portal set too.

**Then:**

```
/rank          # batch-score and get a shortlist with reasons
/apply <url>   # draft, review, compile, verify, archive
```

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find module '@applyos/core'` | `bun install` was not run in `applyos/` | `cd applyos && bun install --frozen-lockfile` |
| `bun: command not found` | Bun is not installed | Install Bun 1.4.3 |
| `lualatex: command not found` | TeX Live is missing | See §1; `/apply` cannot compile without it |
| The PDF has no text | Poppler and `pypdf` are both missing | `pip install pypdf` or install Poppler |
| `/scrape` finds nothing for one board | That board may be down, rate-limited, or bot-gated | `/scrape health <portal>` — but a 429 is **not** evidence of breakage |
| Naukri returns nothing | Naukri is bot-gated | `search-queries.md` prescribes a `site:naukri.com` WebSearch fallback |
| The LaTeX compile fails on the phone placeholder | `[YOUR_PHONE]` contains a bare `_`, a LaTeX subscript | Use `+91 XXXXX XXXXX` |
| `/setup` warns about a public remote | Your profile would be published | Make the repository private, or remove the remote |
| `/gmail-sync` stops immediately | The Gmail MCP tools are not configured | The command requires a Gmail-capable binding |
| The CI matrix shows a Windows-only failure | A POSIX-only command in a spec | Audit finding T-M4; tracked for Phase 11 |

---

## 8. Where to go next

| You want to… | Go to |
|---|---|
| Add a job board | [adding-a-portal.md](./adding-a-portal.md) |
| Add a workflow | [writing-a-command.md](./writing-a-command.md) |
| Contribute code | [contributing.md](./contributing.md) |
| Understand a term | [glossary.md](./glossary.md) |
| Understand the architecture | [../architecture/current-state.md](../architecture/current-state.md) |
