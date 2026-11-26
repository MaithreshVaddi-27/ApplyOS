# Document Formats

> **Status:** `IMPLEMENTED` for everything marked as such; `PROPOSED` for the rest.
> This is the reference for every file ApplyOS reads or writes.

---

## 1. Directory zones

| Zone | Path | Git | Contents |
|---|---|---|---|
| **Input** | `input/` | ignored | The candidate's material |
| **State** | `workspace/` | ignored | Pipeline state |
| **Output** | `output/` | ignored (except `output/research/*.md`) | Generated artifacts |
| **Profile** | `.claude/skills/job-application-assistant/01–09*.md`, `CLAUDE.md` | **tracked** | The customised profile |
| **Templates** | `templates/` | tracked | Stock and custom document templates |
| **Docs** | `docs/` | tracked | Documentation |

**The profile is tracked.** That is why `README.md` and `/setup` insist on a private repository.
CI's `placeholder-integrity` job asserts the placeholders survive in the tracked template repo.

---

## 2. `input/` — what the candidate provides

| Path | Contents | Read by |
|---|---|---|
| `input/cv/` | Current resume, `.pdf` preferred | `/setup` Path A, `/expand` |
| `input/linkedin/` | LinkedIn profile export (PDF/HTML) | `/setup` Path A, `/expand` |
| `input/diplomas/` | Degree certificates, transcripts | `/setup` Path A, `/expand` |
| `input/references/` | Recommendation letters, referee contacts | `/setup` Path A, `/expand` |
| `input/postings/` | Postings the candidate saved themselves | `/apply`, `/rank` |
| `input/README.md` | Format guidance | The candidate |

`input/README.md` is **tracked** and must not be deleted by `/reset`.

---

## 3. The profile files

Nine files under `.claude/skills/job-application-assistant/`, plus `CLAUDE.md`. All are markdown.

| File | Written by | Holds |
|---|---|---|
| `01-candidate-profile.md` | `/setup`, `/expand`, `/apply` | Identity, education, experience, skills, the `Document type:` line, and the `STIPEND`/`CTC`/`BATCH`/`NOTICE` fields |
| `02-behavioral-profile.md` | `/setup`, `/expand` | Behavioural evidence, STAR material |
| `03-writing-style.md` | `/setup` | Voice and tone rules |
| `04-job-evaluation.md` | `/setup` | The fit framework: dimensions, weights, gates, verdict bands |
| `05-cv-templates.md` | `/setup`, `/add-template` | Document rules, the `ACTIVE-TEMPLATE` managed block, the LaTeX contact block |
| `07-interview-prep.md` | `/setup`, `/interview` | STAR answers |
| `08-application-forms.md` | `/setup` | Form-field guidance |
| `09-web-research.md` | `/setup` | Research method and sources |
| `SKILL.md` | tracked | Router for the skill |

> **There is no `06-*.md`.** The numbering skips 06 and no file references it. See
> [../OPEN_QUESTIONS.md](../OPEN_QUESTIONS.md#q3--why-is-there-no-06-md-in-job-application-assistant--non-blocking).

**`CLAUDE.md`** carries the Candidate Profile block used by `/apply`'s Grounding Audit.

### 3.1 Placeholder tokens

Tracked files must keep these (CI `placeholder-integrity`):

| Token | File |
|---|---|
| `[YOUR_NAME]` | `01-candidate-profile.md` |
| `[YOUR_EMAIL]` | `01-candidate-profile.md` |
| `[YOUR_PRIMARY_SKILLS]` | `04-job-evaluation.md` |
| `[First]` / `[Last]` | `templates/cv-stock/main_example.tex`, `resume_example.tex` |
| `[your.email@example.com]` | both `.tex` files |

**The phone placeholder is `+91 XXXXX XXXXX`, not `[YOUR_PHONE]`.** A bare `_` is a LaTeX
subscript and aborts the compile. This rule is recorded in `/setup` and `/reset`.

---

## 4. The Stage Profile

Inside `.claude/skills/job-scraper/search-queries.md`, a fenced block:

```
stage: ask              # ask | student | fresher | experienced | remote-global
market: ask             # ask | india | us | uk | eu | other
graduation_year: [YYYY]
preferred_cities: [Bangalore, Hyderabad, Pune, Delhi NCR, Mumbai, Chennai, ...]
remote_preference: [pan-india-remote | global-remote | hybrid | onsite]
stipend_floor: [INR/month for internships, student stage]
expected_ctc_floor: [LPA for fresher/experienced stages]
notice_period: [immediate | 15 | 30 | 60 | 90 days | buyout available]
```

`stage: ask` makes `/scrape` ask once and write the answer back.

The same file also holds the `Market × Stage → portal sets` table, the query categories
(priorities 1–5), the location filter, the language filter, and the date filter.

**Date filter rule:** *"Only include jobs posted within the last 14 days, or with an application
deadline that has not yet passed. If a posting date cannot be determined, include it but flag as
'date unknown'."*

---

## 5. `workspace/` — pipeline state

### 5.1 `workspace/seen_jobs.json`

The append-only store of every posting ever seen.

```json
{
  "seen": {
    "<key>": {
      "title": "…", "company": "…", "location": null, "url": "…",
      "portal": "naukri", "date": null, "status": "scored",
      "scores": { "technical": 22, "experience": 20, "behavioral": 12, "career": 24 },
      "location_verdict": "pass", "language_gate": "PASS",
      "strengths": ["…"], "gaps": ["…"],
      "deadline": null, "last_seen": "2026-10-13"
    }
  }
}
```

**Written by:** `/scrape` (Step 4) and `/rank` **via `tools/rank_state.py` only** (Step 4).

**Format version.** The store carries a `schemaVersion`. A store **without** the marker is
version 1 — the format that has always existed — so the marker is additive and never
invalidates an existing workspace. The format is declared in
`applyos/packages/core/src/state.ts`, and a fixture generated by the real writer pins it
(`tests/fixtures/seen_jobs.json`).

**Keeping it from growing.** `python tools/rank_state.py compact` drops entries that can never
come back — entries that were skipped or expired, have no live deadline, and were posted
before the cutoff (90 days by default). **An entry with no `posted_date` is never dropped.**
Dry-run is the default; nothing is removed without `--write`.

**Never written by:** `/apply` — the spec says *"Do not modify `workspace/seen_jobs.json.json`"*
(the spec text has a typo; the rule is clear).

**Rules the state engine enforces.**

- Absence is never a correction. A stored `FAIL` is not reset to `PASS` by an omitted field.
- Verbatim persistence: strengths and gaps are stored exactly as written.
- The `location` → `location_verdict` legacy migration runs on write.
- `sweep` retires expired entries; `--all` makes a retired entry revivable.

### 5.2 `workspace/job_search_tracker.csv`

One row per application. Header, exactly:

```
date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline
```

| Column | Meaning |
|---|---|
| `date` | Application date |
| `company` | Company name |
| `sector` | Industry |
| `role` | Role title |
| `role_type` | Internship / full-time / contract |
| `channel` | Portal, referral, email, etc. |
| `status` | Canonical vocabulary (below) |
| `contact_person` | Recruiter or hiring manager |
| `fit_rating` | The score or band from `/rank` |
| `notes` | Free text |
| `cv_file` | Path to the submitted document |
| `cover_letter_file` | **Legacy. Stays in the header. Always empty.** |
| `source` | Posting URL |
| `deadline` | Application deadline |

**Status vocabulary (canonical, underscore spellings):**

```
drafted | applied | interview | offer | hired | rejected | no_response | offer_declined | withdrawn
```

| Set | Members |
|---|---|
| **Final** | `hired`, `rejected`, `no_response`, `offer_declined`, `withdrawn` |
| **Not final** | `drafted`, `applied`, `interview`, `offer` |

**Legacy spellings** (`no response`, `offer declined`) are accepted on read and **never written**.
`interview_only` is archive-only and is **never** a tracker status.

**Schema version** — `PROPOSED`, Phase 7. The CSV stays CSV; a `schemaVersion` and a migration
function live beside it.

**Invariants.**

- Never restructure the CSV, reorder rows, or touch other rows.
- Idempotent updates.
- `drafted` rows are listed but never counted as quiet.

### 5.3 Sync state files

| Path | Owner | Contents |
|---|---|---|
| `workspace/gmail_sync/state.json` | `/gmail-sync` | `processed_message_ids`, `last_sync` |
| `workspace/notion_sync.json` | `/notion-sync` | `database_id`, `database_url`, `last_sync` |

All are personal data and gitignored.

---

## 6. `output/` — generated artifacts

### 6.1 `output/cv/`

| File | Written by |
|---|---|
| `main_<company>_<role>.tex` / `.pdf` | `/apply` — the CV |
| `resume_<company>_<role>.tex` / `.pdf` | `/apply` — the resume |
| `<DOC_STEM>.txt` | `/apply` Step 5d — the extracted text layer; **deleted in Step 5e** |

**Naming.** `main_` for a CV, `resume_` for a resume. `<company>` and `<role>` are slugified.
The `DOC_STEM` / `DOC_EXT` / `DOC_TYPE` / `DOC_COMPILE` placeholders are resolved from the
`Document type:` line in `01-candidate-profile.md` and the `ACTIVE-TEMPLATE` block in
`05-cv-templates.md`.

### 6.2 `output/applications/<company>_<role>/`

One archive per application.

| File | Written by | Notes |
|---|---|---|
| `job_posting.md` | `/apply` Step 6b | The posting, kept verbatim |
| `cv_draft.tex` | `/outcome` Step 3 | **Copied, never moved.** *"The archived version is the submitted version."* |
| `cover_letter.tex` | `/outcome` Step 3 | Legacy |
| `outcome.md` | `/outcome` | The outcome record, with status and notes |
| `interview_prep_<stage>.md` | `/interview` Step 3 | The prep pack |
| `followup_YYYY-MM-DD.md` | `/outcome` Step 2b | The follow-up draft |

**`output.md`** is never overwritten once it exists — a later archive file must not replace the
submitted one.

### 6.3 `output/research/`

| File | Written by | Contents |
|---|---|---|
| `<normalized-company>.json` | `/apply` Step 3, `/interview` Step 2 | Cached company research with a TTL |
| `*.md` | manual | Shareable search-result notes — **tracked**, unlike the rest of `output/` |

### 6.4 `output/reports/`

| File | Written by |
|---|---|
| `application-dashboard.html` | `/html-report` |
| `upskill/report-*.md` | `/upskill` |

The dashboard is self-contained: inline CSS, inline JS, inline SVG charts. No external requests.

---

## 7. The document format (LaTeX)

### 7.1 The two stock templates

| File | Document | Pages |
|---|---|---|
| `templates/cv-stock/main_example.tex` | CV | 2 (1 for student/fresher) |
| `templates/cv-stock/resume_example.tex` | Resume | 1, exactly, at every stage |

`moderncv` class, compiled with `lualatex` (twice, for the cross-reference pass).

### 7.2 Compilation

```
lualatex -interaction=nonstopmode main_example.tex
lualatex -interaction=nonstopmode main_example.tex
```

**Minimal TeX Live packages** (from the CI `latex-smoke-bookworm` leg): `texlive-luatex`,
`texlive-latex-extra`, `texlive-fonts-extra`, `texlive-fonts-recommended`, `poppler-utils`.
`moderncv` loads `fontawesome5` (in `texlive-fonts-extra`) and `hyperref` probes the `pzdr`
metrics (in `texlive-fonts-recommended`). Missing either is a **fatal** error, not a warning.

### 7.3 Verification

```
python tools/verify_pdf.py <file>.pdf --min-chars 100
python tools/verify_pdf.py <file>.pdf --pages 2 --contains '[your.email@example.com]' \
    --contains 'Professional Experience' --contains 'Achievement'
```

Text extraction tries `pypdf` first, then Poppler `pdftotext`, and fails if both yield zero
characters.

### 7.4 The Document Manifest — `IMPLEMENTED`, Phase 6

A JSON sidecar next to the PDF:

```json
{
  "documentVersion": 1,
  "documentType": "resume",
  "posting": { "url": "…", "title": "…", "company": "…" },
  "profile": "01-candidate-profile.md",
  "claims": [
    { "text": "Reduced p99 latency by 40%",
      "source": "01-candidate-profile.md#achievements",
      "grounded": true }
  ],
  "ungrounded": [],
  "gaps": ["kubernetes"],
  "pageBudget": { "document": "resume", "pages": 1, "required": 1 },
  "ats": { "extractable": true, "chars": 2841 }
}
```

This turns the Grounding Audit from a model instruction into a **checkable artefact**, and gives
the evaluation harness something to measure. `applyos/packages/docgen/src/manifest.ts` builds it
from the finished pack; `/apply` writes it beside the PDF after compilation. `verify_pdf.py
--manifest` compares it against the *extracted text of the compiled PDF*: every claim must be
present, `ungrounded` must be empty, the page budget must match, and a `[YOUR_PHONE]` placeholder
fails. A claim the document never delivered fails the check.

### 7.5 The machine-readable profile — `IMPLEMENTED`, Phase 6

The markdown profile stays the source of truth; `/setup` derives a JSON twin
(`~/.applyos/profile.json`) that the engine reads through
`applyos/packages/docgen/src/profile.ts`. `schemaVersion: 1`; fields: `name`, `email`, `phone`,
`location`, `stage`, `graduationYear`, `skills`, `experience[].bullets[{text, source}]`,
`education`, `documentType`, `salary` and `source: { profile, generated }`. Every bullet's `source`
points at the markdown section it came from, which is what makes grounding checkable. Validation
checks shape only and names the exact bad field (`profile invalid: skills[2] must be a string`);
a missing `source.profile` file fails, a bullet without a source warns. The JSON is derived and
never hand-edited.

---

## 8. The provider envelope

```json
{
  "meta": { "count": 12, "page": 1 },
  "results": [
    { "id": "…", "title": "…", "company": "…", "location": null, "date": null, "url": "…" }
  ]
}
```

| Field | Rule |
|---|---|
| `meta.count` | Equals `results.length` |
| `meta.page` | The page actually returned |
| `id` | Stable within the board |
| `title` | As stated by the source |
| `company` | As stated by the source |
| `location` | `null` when unstated — **never** `""` or `"Unknown"` |
| `date` | `null` when unstated — **never** a guess |
| `url` | The posting's canonical URL |

The engine's internal `JobPosting` adds `postedDate` and `source`; the CLI envelope keeps the
six-field contract. Phase 4 unifies them.

---

## 9. The provider registry

`applyos/packages/company-scraper/registry.yaml` — one entry per employer board:

```yaml
- company: JioStar
  board: workday
  slug: jiostar/JioStar/102
  region: india
  category: india-product
```

Seven seeds today: Amazon, Groww, CRED, Freshworks, Stripe, Figma, JioStar. Phase 4 replaces
this with a unified provider registry covering both the ATS boards and the job boards.

---

## 10. Salary data

`salary_data.json` — created by the candidate from `salary_data.example.json`. Gitignored.
Consumed by `salary_lookup.py`, which `/setup` Step 3.10 validates and `/apply` Step 1 queries.

---

## 11. Cross-format rules

| Rule | Applies to |
|---|---|
| `null` means "not stated" | Every row, every JSON output |
| Missing fields are never omitted | Provider results |
| ISO `YYYY-MM-DD` for stored dates | `seen_jobs.json`, the tracker |
| DD/MM/YYYY in *document text* only | The generated PDF — an Indian recruiter convention (`05-cv-templates.md`) |
| Legacy spellings read, never written | Tracker statuses |
| Legacy columns stay in the header | `cover_letter_file` |
| Archived files are never overwritten | `output/applications/*/` |
| Errors on stderr, exit 1 | Every CLI |
| Stable error codes | See [public-api.md](./public-api.md#6-error-codes) |
