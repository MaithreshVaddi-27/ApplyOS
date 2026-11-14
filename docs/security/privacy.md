# Privacy

> **Status:** `PROPOSED` — Phase 11 produces the reviewed version.
> **The principle** (ADR-0003): personal data never leaves the machine.

---

## 1. The rule

> Personal data never leaves the candidate's machine.

**What this means in practice.** ApplyOS has no backend, no account, no telemetry, no analytics,
and no server. Everything it reads and writes is a file on the candidate's disk. The only
exceptions are explicit, opt-in, and documented below.

---

## 2. The data-flow inventory

Every path that can carry personal data, and where it goes.

### 2.1 Local only — never leaves the machine

| Path | Contains | Enforcement |
|---|---|---|
| `input/cv/` | The candidate's resume | gitignore + guard |
| `input/linkedin/` | LinkedIn profile export | gitignore + guard |
| `input/diplomas/` | Certificates, transcripts | gitignore + guard |
| `input/references/` | Recommendation letters, referee contacts | gitignore + guard |
| `input/postings/` | Saved postings | gitignore + guard |
| `output/cv/` | Tailored `.tex` and `.pdf` documents | gitignore + guard |
| `output/applications/` | Per-application archives | gitignore + guard |
| `output/reports/` | The HTML dashboard | gitignore + guard |
| `workspace/seen_jobs.json` | Every posting ever seen, with scores | gitignore + guard |
| `workspace/job_search_tracker.csv` | The application history | gitignore + guard |
| `workspace/gmail_sync/state.json` | Processed message IDs | gitignore + guard |
| `workspace/notion_sync.json` | The Notion database reference | gitignore + guard |
| `salary_data.json` | Salary benchmarks | gitignore + guard |

### 2.2 Tracked — the candidate must keep them clean

| Path | Contains | Note |
|---|---|---|
| `.claude/skills/job-application-assistant/01–09*.md` | **The candidate's profile** | **Tracked by design.** This is why a private repository is required |
| `CLAUDE.md` | The Candidate Profile block | Same |
| `templates/cv-stock/*.tex` | Placeholders | CI asserts the placeholders survive |
| `output/research/*.md` | Shareable search-result notes | The only `output/` path that is tracked. **Must not contain personal data** |

### 2.3 External — opt-in, explicit, minimal

| Destination | What crosses | Control |
|---|---|---|
| **Notion** (`/notion-sync`) | Posting metadata: company, role, URL, status, fit, deadline. **CVs sync as filenames only.** | One-way; never deletes; the candidate must run the command |
| **Gmail** (`/gmail-sync`) | **Read-only.** A search query and thread reads. Nothing is labelled, archived, or deleted | Nothing written without explicit approval of the batch |

### 2.4 External — unavoidable

| Destination | What crosses | Note |
|---|---|---|
| **The model provider** | Whatever the agent puts in its context — which includes the profile, the posting, and the draft | **Outside ApplyOS's control.** The candidate chooses the provider and its policy |
| **Job boards** | The search query, the User-Agent, the request | Unavoidable. The query is generic by design; the User-Agent identifies ApplyOS honestly (`applyos/0.1 (personal use)`) |

---

## 3. The two facts a candidate must know

### 3.1 The profile is in tracked files

`/setup` writes the candidate's personal data into files git tracks. That is intentional — it
makes the profile editable, diffable, and reviewable in a pull request — and it is why the
README says:

> **Run your own search from a private repository.** `/setup` writes your personal data (name,
> contact details, employment history, salary expectations) into **tracked** files.

**The check.** `/setup` Step 0 runs `git remote get-url origin` and, if a GitHub remote is found,
`gh repo view <owner>/repo --json visibility,isFork`, **before anything is written**. A public
remote produces a loud warning.

**Why it is a warning, not a block.** A block would break the legitimate private-repository
workflow — which is the recommended one. The candidate is capable of following a warning; they
are not capable of un-publishing a repository afterwards.

### 3.2 The model provider sees the context

Every workflow sends the agent's context to whatever model provider the candidate configured.
The context includes the profile, the posting, and the draft.

**This is not an ApplyOS defect.** It is the nature of an agentic workflow, and it is why the
project is "local-first" rather than "private by construction" — local-first is about ApplyOS's
own infrastructure.

**The mitigation is the candidate's.** A local model removes the transfer entirely. The
comparison project documents a "running on a budget" path for local and free-tier models; ApplyOS
can point at the same choice without adopting its implementation.

---

## 4. What ApplyOS does not do

| Never | Why |
|---|---|
| Uploads the CV, the profile, or the archive | ADR-0003 |
| Sends an email or a message | *"It never emails, messages, or submits anything, and it must not be wired to tools that do."* |
| Submits an application | The candidate presses Submit |
| Collects telemetry or usage analytics | There is nothing to send it to |
| Requires an account | There is no service |
| Phones home from the engine | Zero runtime dependencies; no background process |

---

## 5. Enforcement

| Layer | Mechanism |
|---|---|
| **Git** | `.gitignore` covers `input/**`, `output/**`, `workspace/**`, `salary_data.json` |
| **CI** | `tools/security_guards.py` verifies the gitignore rules exist, checks nested `.gitignore` files against a reviewed-negation list, and fails on a nested file that re-includes personal data |
| **CI** | The `placeholder-integrity` job asserts the tracked template files still carry their placeholder tokens |
| **CI** | The `security-guards` job checks the permission allowlists and the package manifests |
| **Runtime** | `/setup` checks the git remote's visibility before writing |
| **Runtime** | The dashboard is self-contained — no external requests |
| **Runtime** | `/notion-sync` sends filenames, not content |

---

## 6. Data retention

| Data | Lives for | Removed by |
|---|---|---|
| `input/**` | As long as the candidate keeps it | The candidate, or `/reset input` |
| `output/**` | As long as the candidate keeps it | The candidate; `/reset` clears `output/applications/*/` |
| `workspace/seen_jobs.json` | The life of the search | `rank_state.py sweep` retires expired entries; the candidate may delete the file |
| `workspace/job_search_tracker.csv` | The life of the search | The candidate; `/reset` does not touch it |
| Notion pages | Until the candidate deletes them | The candidate — ApplyOS never deletes, even for expired postings |
| Gmail state | The life of the search | The candidate |

**`/reset` is scoped.** `profile` restores the placeholder files; `input` clears `input/`; `all`
does both. **It never touches the tracker or `output/cv/`.** Those hold the candidate's work, and
the only way to lose them is deliberately.

---

## 7. A candidate's checklist

Before the first search:

- [ ] The repository is **private**, or has no remote at all.
- [ ] `input/` contains only what you intend to keep locally.
- [ ] `salary_data.json` exists and is gitignored.
- [ ] You have read your model provider's retention policy.
- [ ] `git status` shows no personal data staged.

Before pushing anywhere public:

- [ ] `git status --ignored` — confirm nothing under `input/`, `output/`, or `workspace/` is
      tracked.
- [ ] `git ls-files | grep -E '^(input|output|workspace)/'` — must return nothing.
- [ ] The tracked profile files contain no real personal data.

---

## 8. Open privacy questions

| Question | Reference |
|---|---|
| Should the JSON profile (Phase 6) be gitignored, keeping only the markdown tracked? | Phase 6; it trades editability for isolation |
| Should `/notion-sync` be able to sync more than filenames? | No — the current answer is deliberate |
| Should the framework warn about the model provider's data transfer at `/setup` time? | Phase 11 — a candidate-facing addition to the privacy note |
| Is a local-model-only mode worth a flag? | Phase 11; the framework is runtime-agnostic, so this is a runtime concern rather than an ApplyOS one |
