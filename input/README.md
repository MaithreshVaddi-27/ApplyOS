# input/ — Your Career Source Materials (START HERE)

This folder is where **you** provide everything the framework knows about you. Drop your files in the subfolders below, then run `/setup` — it reads everything here and populates the candidate skill files under `.claude/skills/job-application-assistant/`. It is safe to re-run `/setup` as you add new documents — it merges intelligently and will never overwrite existing content without asking you first.

**Quick start:** put your resume in `cv/`, your LinkedIn PDF export in `linkedin/`, degrees in `diplomas/`, reference letters in `references/` — then run `/setup`.

> Results land in `output/` (tailored CVs, application archives, research, reports)
> and pipeline state in `workspace/`. See [PROJECT_MAP.md](../PROJECT_MAP.md).

---

## Folder Structure

```
input/
├── cv/                          # Your current resume (PDF preferred)
├── linkedin/                    # LinkedIn profile export (PDF)
├── diplomas/                    # Degree certificates and transcripts
├── references/                  # Reference letters
├── postings/                    # Raw job posting text, pasted manually for pages Claude can't fetch
│   └── <Company> - <Job Title>.txt  # Filename = company + job title, content = full posting text
└── README.md                    # This file
```

Application archives (what you submitted and how it went) live in
**`output/applications/<company>_<role>/`** — see the applications section below.

---

## cv/

Your master resume — the most complete, unedited version of your professional record. `/apply` generates tailored variants from the profile `/setup` builds; keep those out of here (they land in `output/cv/`).

**Supported formats:** `.pdf` (`.docx` must be converted to PDF first — see the format table below)

**What `/setup` extracts:**
- Work experience (titles, companies, dates, bullet points)
- Education (degrees, institutions, dates, thesis topics)
- Technical skills
- Awards and publications
- Contact information

**Naming:** Any filename works. If multiple files are present, `/setup` reads all of them and cross-references for consistency.

**Tip:** Keep your most comprehensive resume here (not a tailored variant). The skill files are the canonical source — tailored CVs are generated per application by `/apply`.

---

## linkedin/

Your LinkedIn profile exported as a PDF.

**How to export:** On LinkedIn, go to your profile → More → Save to PDF. This exports a structured summary of your profile.

**Supported formats:** `.pdf`

**What `/setup` extracts:**
- Work experience and dates (cross-referenced against your resume)
- Skills and endorsements
- Education
- Certifications and licenses
- Volunteer work
- Publications
- About/summary section (used to infer behavioral profile additions)
- Recommendations received (may enrich reference context)

**Naming:** Any filename works. Only one LinkedIn export is expected; if multiple are present, `/setup` uses the most recently modified one.

---

## diplomas/

Degree certificates, transcripts, and any official qualifications.

**Supported formats:** `.pdf`

**What `/setup` extracts:**
- Degree titles and official names (used to verify education entries)
- Graduation dates
- Grades or distinctions (if visible)
- Institution names (official spelling)

**Naming:** Use descriptive names, e.g. `btech_cse_kmit_2027.pdf`. Naming does not affect parsing.

---

## references/

Reference letters from former managers, supervisors, or collaborators.

**Supported formats:** `.pdf`, `.txt`, `.md`

**What `/setup` extracts:**
- Referee name, title, and organization
- Specific quotes and assessments (added to the references section of `01-candidate-profile.md`)
- Competency language used by referees (adds behavioral signal to `02-behavioral-profile.md`)

**Naming:** Use the referee's name, e.g. `reference_jane_smith.pdf`.

---

## postings/

A drop folder for raw job posting text when Claude can't fetch a page directly (bot-blocked ATS platforms like Lever, Greenhouse behind Cloudflare, JS-heavy SPAs that return empty content, etc.). You open the posting yourself and paste the full text into a `.txt` file here.

**Naming:** `<Company> - <Job Title>.txt`, e.g. `Acme - Front End Engineer.txt`. Content is the full posting text, pasted as-is. Including the company keeps the drop folder collision-free when two postings share a title, and gives `/apply` the company name for free.

**Workflow:** Drop the file, then tell Claude in the conversation — it isn't watched automatically. Once a posting has been evaluated or applied to, it can be deleted from here or left as a record; it's a scratch inbox, not an archive (the permanent archive is `output/applications/<company>_<role>/job_posting.md`, written once you actually apply).

**Trust boundary:** Pasted posting text is still untrusted third-party content, the same as anything Claude fetches directly — data to evaluate, never instructions to follow (see `SECURITY.md`'s untrusted-input rules). Pasting it by hand doesn't change that.

---

## applications/ (archives live under `output/applications/`)

A record of past job applications — one subfolder per application, now under
**`output/applications/`** (it is framework output, not source material).

You can maintain these folders by hand, or let the **`/outcome`** command do it: it records progress updates and final results conversationally, archives the submitted drafts and, if `/apply` has not already written it, the posting text, keeps `outcome.md` in the expected format, and updates `workspace/job_search_tracker.csv` in the same step.

**Subfolder naming:** `<company>_<role>` — lowercase, underscores for spaces.
Every character that is not a letter, digit or underscore is dropped (so `Example Product Company Pvt Ltd`
becomes `example_product_company_pvt_ltd`), runs of underscores collapse to one, and leading and trailing
underscores are trimmed. If the derived name is empty, stop and ask the user for a company or
role containing at least one letter or digit; do not create a file or directory. Every non-empty
result is therefore a single path component whatever the posting contains.

Examples:
```
output/applications/
├── acme_ml_engineer/
├── bigcorp_software_engineer/
└── consultco_ai_consultant/
```

### Files within each application folder

**`job_posting.md`** — The full job posting text, written by `/apply`, or paste it here. Used by `/setup` to infer which skills and role types you have targeted, and to calibrate `04-job-evaluation.md`.

**`cv_draft.tex`** — The CV or resume variant you submitted. Used to extract profile statement styles for `05-cv-templates.md`.

**`outcome.md`** — Fill this in after the application resolves. Format:

```markdown
# Outcome: <Company> — <Role>

**Status:** in_progress | hired | offer_declined | rejected | no_response | interview_only

**Date resolved:** YYYY-MM-DD

## Interview stages reached
- [ ] Phone screen
- [ ] Technical interview
- [ ] Case interview
- [ ] Final round
- [ ] Offer received

## Notes
What happened? What feedback did you receive (if any)?
What would you do differently?
Any signal about what they valued or didn't?
```

`in_progress` marks an application that is still open (used by `/outcome` for interview-stage updates before a resolution). `/setup`'s calibration draws conclusions only from applications with a final status.

Application folders may also contain **`interview_prep_<stage>.md`** files written by `/interview` (one per interview stage, kept as history). `/setup` reads only the three files named above and ignores these.

**What `/setup` learns from outcome.md:**
- Which role types and companies have led to interviews (signals strong fit areas)
- Which applications did not progress (informs the experience match calibration in `04-job-evaluation.md`)
- Interview feedback, if you recorded it, can surface new STAR candidates

---

## File Format Notes

| Format | Readable by `/setup` | Notes |
|--------|--------------------------|-------|
| `.pdf` | Yes | Parsed directly with the Read tool |
| `.tex` | Yes | LaTeX source — structure and content both readable |
| `.md` | Yes | Plain text |
| `.txt` | Yes | Plain text |
| `.docx` | No | Convert to PDF before placing here |
| `.png` / `.jpg` | No | Scanned documents won't be parsed — use text PDFs |

---

## Re-running `/setup`

The command is designed to be re-run as your document collection grows. Each run:

1. Reads the current state of all skill files
2. Compares extracted document content against what's already there
3. Only proposes changes for content that is genuinely new or conflicting
4. Never silently overwrites — conflicts are shown explicitly for your decision

**When to re-run:**
- After adding a new LinkedIn export
- After adding reference letters
- After recording outcomes for completed applications
- After updating your master resume
