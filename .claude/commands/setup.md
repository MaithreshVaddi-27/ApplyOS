# /setup - Profile Onboarding

You are running the onboarding setup for ApplyOS. Your goal is to collect the user's professional information and populate all profile files so the `/apply` workflow works out of the box.

There are three paths into setup. Step 0 picks the right one; all three converge on Step 3 (file generation) and Step 4 (confirmation).

---

## Step 0: Welcome & Choose Path

If `$ARGUMENTS` contains `--section <name>`, skip directly to that section in Path C for an update-only flow. Do not run the path-selection prompt below.

Otherwise, first check where this working copy would publish to — **before anything is
written, not after** (the Step 4 privacy note fires only once every file is already on
disk, which is too late to inform the decision). Run `git remote get-url origin`; if the
command fails (no remote, or not a git checkout), skip this check silently. If there is
a GitHub `origin`, check it with `gh repo view <owner/repo> --json visibility,isFork`
when `gh` is available. If the origin is a **public fork** of the template — or its
visibility cannot be determined — warn now and wait:

> **Heads-up before we start:** your `origin` points at `<owner/repo>`, which is a
> public GitHub fork. This setup writes your personal data (name, contact details,
> employment history, salary expectations) into **tracked** files, and anything you
> commit *and push* to that fork is visible to anyone. Two safe options: keep your
> profile commits local and never push them, or push to a **private** repository
> instead — create an empty private repo on GitHub and repoint this checkout: `git remote set-url origin <private-url> && git push`. Two commands, ~2 minutes. Want to
> continue with the setup?

Wait for the user's confirmation before showing the path prompt. A private origin, no
origin, or a non-fork remote needs no warning — continue silently.

Then, before greeting the user, scan the `input/` folder and past-application archives. Use Glob with `input/**/*` and count files per subfolder (`cv/`, `linkedin/`, `diplomas/`, `references/`, `postings/`), plus Glob with `output/applications/*/` for past-application archives.

Then welcome the user with a single message that lists three paths. The wording changes based on what was found.

**If `input/` has files** in one or more subfolders, lead with Path A:

> **Welcome to the ApplyOS setup!**
>
> I'll help you build your professional profile so Claude can evaluate job postings, tailor CVs, and prepare you for interviews.
>
> I see files in your `input/` folder: [list per subfolder, e.g. "2 in cv/, 1 in linkedin/, 3 in references/"]. Three ways to start:
>
> **Path A: Read my input/ folder** (recommended for what you have) - I'll read everything in `input/`, cross-reference for consistency, and build your profile from real source materials. Idempotent and safe to re-run as you add more documents.
>
> **Path B: Single CV import** - Paste or @-mention a single CV/resume here. I'll extract it and ask follow-up questions for what's missing.
>
> **Path C: Interview mode** - I'll walk you through structured questions section by section.
>
> Which would you like?

**If `input/` is empty or missing**, surface Path A as a "do this if you have materials" option:

> **Welcome to the ApplyOS setup!**
>
> I'll help you build your professional profile so Claude can evaluate job postings, tailor CVs, and prepare you for interviews.
>
> Three ways to start:
>
> **Path A: Documents folder** (best signal if you have several materials) - Drop your CV / LinkedIn export / diplomas / reference letters in the `input/` folder, then say "go". I'll read everything and build your profile from it. See `input/README.md` for the folder layout.
>
> **Path B: Single CV import** - Paste or @-mention a single CV/resume here. I'll extract it and ask follow-up questions for what's missing.
>
> **Path C: Interview mode** - I'll walk you through structured questions section by section. Good if you're starting from scratch.
>
> Which would you like?

Wait for the user's choice. If they pick A but the folder is still empty, tell them what to add (point at `input/README.md`) and stop.

---

## Path A: The input/ Folder

Reads structured input/ in `input/`, cross-references them for consistency, and merges extracted data into the six profile skill files. Read-before-write and idempotent: changes already present will not be proposed again.

Follow these steps **exactly in order**.

### Step A1: Inventory

Use Glob with `input/**/*` to scan the input tree, plus Glob with `output/applications/*/` for past-application archives. Print:

```
## Documents Found

**cv/**: [list files, or "(empty)"]
**linkedin/**: [list files, or "(empty)"]
**diplomas/**: [list files, or "(empty)"]
**references/**: [list files, or "(empty)"]
**postings/**: [list files, or "(empty)"]
**output/applications/**: [list subfolders with their files, or "(empty)"]

I will read these and cross-reference before proposing any changes.
```

If every subfolder is empty, stop and tell the user to populate the folder. Point at `input/README.md` for the layout.

### Step A2: Read Existing Skill Files

Read these in parallel before extracting anything. You must know what is already there to make the merge intelligent.

- `.claude/skills/job-application-assistant/01-candidate-profile.md`
- `.claude/skills/job-application-assistant/02-behavioral-profile.md`
- `.claude/skills/job-application-assistant/03-writing-style.md`
- `.claude/skills/job-application-assistant/04-job-evaluation.md`
- `.claude/skills/job-application-assistant/05-cv-templates.md`
- `.claude/skills/job-application-assistant/07-interview-prep.md`

Hold this content in context throughout Path A. Do not re-read.

### Step A3: Parse Documents

Read each document found in Step A1. Process `input/` subfolders in this order: `cv/`, `linkedin/`, `diplomas/`, `references/`, `postings/`. Then read past-application archives from `output/applications/<company>_<role>/` (gitignored personal data - read, never commit).

**`cv/` input/:** name, contact (email, phone, LinkedIn, GitHub), education (degree, institution, dates, thesis), work experience (title, company, dates, location, bullets), skills, publications, awards, profile/summary.

**`linkedin/` input/:** About/summary section (full text, used for behavioral inference), work experience, education, skills and endorsements, certifications, volunteer work, publications, recommendations received (full text). If multiple LinkedIn exports are present, use the most recently modified file. (The LinkedIn Languages section is skipped — the framework operates in English only and runs no language-comparison gate.)

**`diplomas/` input/:** official degree title and level, institution name (official spelling), graduation date, grade or distinction or GPA if visible.

**`references/` input/:** referee name, title, organization; full text of the letter (extract specific quotes); competency language used.

**`output/applications/<company>_<role>/` archives:**
- `job_posting.md`: role title, company, required skills, experience level, sector, role type
- `cover_letter.tex`: legacy (pre-removal archives only) - skip unless present
- `cv_draft.tex`: profile statement, section ordering, framing for this role type
- `outcome.md`: status (in_progress/hired/offer_declined/rejected/no_response/interview_only), interview stages, notes. Skip `in_progress` applications for calibration — they have no final signal yet.

After reading, proceed to Step A4 without intermediate output. The user sees a complete picture in Step A6.

### Step A4: Cross-Reference Check

Before mapping anything to skill files, check for inconsistencies:

- Date mismatches between CV / LinkedIn / diploma
- Title mismatches across input/ for the same role
- Education mismatches (degree name, graduation date)
- Employer name variations

If inconsistencies are found, present them as a numbered list and wait for the user to resolve each one before continuing:

```
## Cross-Reference Issues Found

These need to be resolved before I continue. For each one, tell me which version is correct.

1. **Role title mismatch - [COMPANY]:**
   CV says: "[TITLE_A]"
   LinkedIn says: "[TITLE_B]"
   Which is correct?

2. ...
```

If no inconsistencies, state "No cross-reference issues found." and continue.

### Step A5: Build Change Sets

For each skill file, compare extracted document content against the current file content from Step A2. Build two buckets.

**Additive changes:** entirely new content not in the skill file in any form. Examples: a certification not in `01-candidate-profile.md`, a new endorsement skill, a referee not yet listed, a new behavioral quote from a reference letter, a new award.

**Conflicting changes:** content that touches something already in a skill file but disagrees. Examples: a different date range for an existing job, a different job title for the same role, a different graduation date than what is recorded.

**Inference rules** (apply when populating from inferred sources):

- **`02-behavioral-profile.md`:** Source is LinkedIn About + recommendation letters. Extract recurring themes, adjectives, phrases about how the candidate works. Add only to "Strongest Behaviors", "How You Work Best", or "Management Style Preferences" sections. Do not overwrite existing scored assessments. Always label inferred additions: *[Inferred from LinkedIn About / Reference letter - review before relying on this]*
- **`03-writing-style.md`:** Source is `cv_draft.tex` files. Extract recurring patterns. Add as observations under "## Patterns Observed in Past Applications". Do not modify existing rules. Only add if 2+ drafts show a genuine pattern.
- **`04-job-evaluation.md`:** Source is `job_posting.md` + `outcome.md` pairs. If an application reached interview or offer: note role type and sector as a confirmed strong-fit signal. If 2+ applications repeat a no-response or rejection pattern: note it. Add findings under "## Calibration from Past Applications". Do not modify the existing scoring framework.
- **`05-cv-templates.md`:** Source is `cv_draft.tex` files. Extract any profile statement that does not already appear in templates. Label with: *[Used for: <company>_<role>]*. **Ground before extracting:** archived drafts are tailored outputs, not source input/ - verify every factual claim in an extracted statement (titles, employers, metrics, technologies) against `01-candidate-profile.md` and drop or correct any claim the profile does not support, keeping only the framing. A tailored draft that drifted must never become a template future applications start from.
- **`07-interview-prep.md`:** Source is CV bullets, LinkedIn descriptions, reference letter quotes. Identify achievements not yet covered by an existing STAR example. Do NOT draft full STAR examples. Add stubs under "## STAR Candidates (Complete Manually)":

```markdown
### [Achievement title]
**Source:** [CV / LinkedIn / Reference letter - role/company]
**What happened:** [one sentence]
**Why it matters:** [interview question types this could answer]
**S/T/A/R stub:**
- Situation:
- Task:
- Action:
- Result:
```

### Step A6: Present and Confirm Changes

Present the full change set before writing anything.

**Additive changes** (single grouped list, organized by target file):

```
## Proposed Additive Changes

### 01-candidate-profile.md
- [ ] New certification: [title], [issuer], [date] - extracted from LinkedIn
- [ ] New reference: [name, title, company]
  Quote: "[relevant quote]"

### 02-behavioral-profile.md
- [ ] New behavioral observation [labeled as inference]: "[phrase]"

[and so on per file]
```

Then ask:

> **Apply all additive changes?** These add new content without touching anything already in the files.
> Reply **yes** to apply all, or list the numbers you want to skip.

Wait for the response. Apply only the confirmed items.

**Conflicting changes** (one at a time):

```
## Conflict 1 of [N]: Job title - [COMPANY]

**Current in 01-candidate-profile.md:**
[TITLE_A] - [COMPANY] ([START]-[END])

**Proposed (from LinkedIn export):**
[TITLE_B] - [COMPANY] ([START]-[END])

Options:
  [keep] Keep the existing text
  [replace] Replace with the version from the document
  [manual] I'll edit this myself - skip for now
```

Wait for the user's choice on each conflict. If no conflicts, state "No conflicting changes found." and skip this section.

### Step A7: Write Confirmed Changes and Fill Gaps

Apply the confirmed changes with the Edit tool. Make targeted edits only. Do not rewrite entire files. State which changes were applied per file. If a file has no confirmed changes, state "No changes made to [filename]."

Documents cover skills, experience, education, references, and behavioral signal. They do not cover everything `/apply` and `/scrape` need. After the writes, ask follow-up questions for gaps:

- Career goals and target role types
- What excites the user in their next role
- Deal-breakers and must-haves
- Salary expectations / baseline (optional)
- Commute or location constraints (if not visible from CV)
- Job search configuration (use the questions from Path C Section 9 below)

Then proceed to Step 3 to populate the non-skill files (`CLAUDE.md`, `templates/cv-stock/main_example.tex`, `templates/cv-stock/resume_example.tex`, `.claude/skills/job-scraper/search-queries.md`). Step 3 will detect that the seven skill files are already populated and skip those substeps.

---

## Path B: Single CV Import

If the user provides a single CV/resume:

1. Read the document thoroughly.
2. Extract all structured information: name, contact, education, experience, skills, publications, awards.
3. Present a summary of what was extracted.
4. Ask follow-up questions for gaps (behavioral profile, career goals, deal-breakers, salary expectations, references).
5. Proceed to Step 3 (file generation).

---

## Path C: Interview Mode

Walk through each section conversationally. Ask questions naturally, not as a form. Let the user answer in their own words and you'll structure the data.

### Section 1: Identity & Contact
Ask about:
- Full name
- Location (city, country)
- Phone, email, LinkedIn, GitHub
- Current employment status
- Family/commute constraints (if any)
- Willingness for hybrid/remote work arrangements (common in India's tech sector)

(No languages question: the framework operates in English only — searches, scoring, and every produced document. `01-candidate-profile.md` records English as the fixed working language, and `04-job-evaluation.md`'s Language Gate fails any posting whose job-condition working language is not English.)

### Section 2: Education
For each degree:
- Level (PhD, MSc, BSc, etc.), field, institution, years
- Thesis topic (if applicable)
- Key coursework or topics
- When `market: india`, additionally ask: did they study at premier institutions (IITs, IIMs, NITs, BITS, etc.), or did coursework include India-relevant topics?

Also ask about certifications (online courses, professional certs).

### Section 3: Professional Experience
For each role (most recent first):
- Job title, company, dates, location
- Key responsibilities (3-5 bullets)
- Key achievements or projects
- Technologies/tools used
- When `market: india`, additionally ask: have they worked with distributed teams, navigated the Indian business environment, or dealt with local regulations?

Also ask about independent projects, freelance work, or side projects.

### Section 4: Technical Skills
- Programming languages + proficiency level
- ML/AI frameworks and tools
- Domain expertise (when `market: india`, note India-specific sectors: fintech, healthtech, edtech, agritech, etc.)
- Software tools and platforms
- Any other technical skills
- When `market: india`, specifically ask about experience with India-relevant technologies: UPI payments, Aadhaar integration, GST systems, IRCTC, etc. if applicable

### Section 5: Publications & Awards (optional)
- Peer-reviewed papers, conference presentations
- Hackathons, competitions, awards
- When `market: india`, additionally ask about contributions to Indian open source projects, participation in Indian hackathons (Smart India Hackathon, etc.), or publications in Indian journals
- Skip if not applicable

### Section 6: Behavioral Profile (optional)
If they have a formal assessment (PI, DISC, Myers-Briggs, StrengthsFinder):
- Ask them to describe or share the results

If not, ask behavioral questions:
- "What work environments do you thrive in?"
- "What drains your energy at work?"
- "How do you prefer to work in teams?"
- "How do you make decisions, quickly or deliberately?"
- "What's your communication style?"
- Synthesize answers into a behavioral profile

### Section 7: Career Goals & Preferences
- Target roles and industries
- What excites you in work
- Deal-breakers and must-haves
- Salary expectations/baseline (optional)
- What environments to avoid
- Commute/location constraints

### Section 8: References (optional)
For each reference:
- Name, title, company, email, phone
- Relationship to the user

### Section 9: Job Search Configuration
This section generates the search queries that power `/scrape`. Use the information from Sections 1, 4, and 7 to build targeted queries.

Ask about:
- **Target market (ask this first):** "Which job market are you targeting: india, us, uk, eu, or other?" Record it as the `market:` line of the **Stage Profile** in `search-queries.md`. `market: india` keeps this edition's India defaults (portal sets, conventions, gates); every other value uses the global portal set and that market's conventions — input/ and queries stay English in every market.
- **Candidate stage (the Stage question):** "What stage are you searching from?" with the four options: `student` (enrolled, seeking internships incl. WFH), `fresher` (graduated 0–1 yr, entry-level roles), `experienced` (1+ yr), `remote-global` (any stage, targeting remote roles in any market). Follow up per stage: student → stipend floor (INR/month when `market: india`; local currency otherwise) and graduation year; fresher → graduation year and expected compensation floor (LPA for india, local annual salary otherwise); experienced → compensation floor and notice period (immediate / 15 / 30 / 60 / 90 days / buyout available); any stage → preferred cities (the market's tech hubs) and remote preference (pan-india-remote / global-remote / hybrid / onsite). Record all of it into the **Stage Profile** block at the top of `search-queries.md` — the `stage:` and `market:` lines plus the fields that apply to the chosen stage. `/scrape` Step 0.5 reads this block, and `/rank` selects its scoring weights and the gates in `04-job-evaluation.md` from it. `/setup --section search` re-asks this question.
- **Role titles to search for:** Job titles for the same underlying work vary a lot across companies and markets - a "Data Scientist" role at one employer may be called "Insights Analyst" or "Data Consultant" at another. Ask about the function first: "What kind of work do you actually want to be doing day-to-day?" Then translate that into concrete search terms: "Given that, what job titles should I search for? For example: Data Scientist, ML Engineer, Geophysicist." Collect 3-8 specific titles, but keep the underlying function in mind - it feeds the category naming in `search-queries.md` and the Experience Match dimension in `04-job-evaluation.md`.
- **Key skills as search terms:** "Which of your skills are most likely to appear in job postings?" Pick 3-5 that are distinctive and searchable.
- **Target companies (optional):** "Are there specific companies you'd like to monitor for openings?"
- **Geographic scope:** "Which cities or regions should I search in? How far are you willing to commute?" Use this to define the location filter tiers (ideal, acceptable, borderline, too far).
- **Job portals:** "The framework ships country-agnostic search CLIs (`linkedin-search`, `freehire-search`, enabled by default). `/scrape` auto-discovers whatever portal skills are installed under `.agents/skills/` and skips any with `enabled: false`. Which portals fit your market?" If the user needs a local board (e.g. Naukri, Internshala for India), guide them to `/add-portal` (market-specific skills live in their fork). WebSearch/`site:` queries remain the fallback for portals without a CLI skill.
- **Document type:** "Which should `/apply` produce by default — a **CV** (2 pages, comprehensive: competencies, publications, awards) or a **resume** (1 page, role-targeted: skills line, projects, trimmed experience)?" Record the answer as a `Document type: cv` or `Document type: resume` line in CLAUDE.md's Identity section. Both document types are always available either way — `/apply --resume` and `/apply --cv` override this default for a single run — so this only sets what happens when the user does not say. Default to `cv` if they are unsure.
- **Document language:** fixed at **English** for every CV this framework produces — there is nothing to ask and no `CV language:` line to record. Bilingual input/ were considered and declined (bundled Indic fonts would be required, and a mixed-script text layer degrades ATS extraction). Candidates targeting a non-English market are still answered in English; that market is recorded as the Stage Profile's `market:` line, which affects portal choice and conventions, not the document.

**Important:** Also suggest role types the user may not have considered, based on their skill profile. For example:
- If they have strong Python + domain expertise: "Have you considered roles like 'Technical Consultant' or 'Solutions Engineer' in your domain?"
- If they have ML + a specific industry: "Companies in adjacent industries also hire for these skills. Should I include searches for [adjacent sector]?"
- If they have project management experience alongside technical skills: "Would you also want to search for 'Technical Project Manager' or 'Team Lead' roles?"

This proactive suggestion step helps users discover career paths they might not have considered.

---

## Step 3: Generate Profile Files

Once data collection is complete, generate or finish populating the following files. **For Path A**, the six skill files are already populated by Step A7; check each before writing and skip if its content is no longer placeholder text.

### 1. Update `CLAUDE.md`
Replace all `[PLACEHOLDER]` tokens with the user's actual information. Keep the structure, workflow, and verification checklist intact.

### 2. Populate `01-candidate-profile.md` *(Path B and C; skip if Path A populated it)*
Write the full candidate profile with structured sections: Identity (including the fixed Working Language: English), Education, Professional Experience, Independent Projects, Technical Skills, Publications, Awards, References. Run a missing-information loop first: list every date, ownership, metric, and scale fact the sources don't confirm and ask the user — gaps stay explicit, never filled by inference.

### 3. Populate `02-behavioral-profile.md` *(Path B and C; skip if Path A populated it)*
Write the behavioral profile based on assessment results or synthesized answers.

### 4. Update `04-job-evaluation.md` *(Path B and C; skip if Path A populated it)*
Replace skill match areas with the user's actual skills:
- Strong match areas: [their primary skills]
- Moderate match areas: [their secondary skills]
- Weak match areas: [skills they lack]

Update career goals and motivation filters with their actual preferences.

### 5. Update `05-cv-templates.md` *(Path B and C; skip if Path A populated it)*
Add role-specific profile statement templates based on their background, and personalise the contact block inside the file's LaTeX template: replace `[FIRST_NAME]`, `[LAST_NAME]`, `[City, State]`, `+91 XXXXX XXXXX`, `[YOUR_EMAIL]`, `[YOUR_LINKEDIN_URL]` and `[YOUR_GITHUB_URL]` (and `[YOUR_NAME]` in the PDF title) with their actual details. When the Stage Profile records `market: india`, format the substituted values per the Indian-format conventions block in `05-cv-templates.md`: phone as `+91 5-digit 5-digit` (e.g. `+91 98765 43210`), address as `City, State`. For any other market, use the market's standard international phone format with the profile's phone verbatim (e.g. `+44 7911 123456`, `+1 (555) 123-4567`) and the market's conventional address form. The phone placeholder is `+91 XXXXX XXXXX` rather than `[YOUR_PHONE]` on purpose: a bare `_` is a LaTeX subscript and aborts the compile before any PDF is written. Check this block whichever path ran - Path A extracts profile statements from input/, not the contact block. `/apply` builds every tailored CV from this template, so a placeholder left here reaches a compiled document.

### 7. Update `07-interview-prep.md` *(Path B and C; skip if Path A populated it)*
Create STAR examples from their actual experience (at least 3-4 examples). Path A leaves STAR stubs under "## STAR Candidates (Complete Manually)" rather than full examples; if any stubs are present, mention them in Step 4 so the user knows to flesh them out.

### 8. Update `templates/cv-stock/main_example.tex` and `templates/cv-stock/resume_example.tex`
Replace placeholder personal data with their actual name, contact info, and add their education and most recent experience entries. **Both** files: the framework produces either document, and a resume still full of `[First]`/`[Last]`/placeholder contact details is the failure mode this step exists to prevent. They share one contact block, so set the name, address, phone, email and links identically in both - only the body sections differ. Keep the phone underscore-free in both (`+91 98765 43210` when `market: india`; the market's own international format otherwise — the rule is no bare `_`, which aborts the LaTeX compile).

### 9. Generate `.claude/skills/job-scraper/search-queries.md`
The file ships with a working India + remote default, so personalize rather than rewrite it. From Section 9's answers (or the equivalent follow-up questions in Path A's Step A7):
- Write the **Stage Profile** block: the `stage:` line (one of `student`, `fresher`, `experienced`, `remote-global` — from the Stage question) plus the fields that apply to the chosen stage (`graduation_year`, `preferred_cities`, `remote_preference`, `stipend_floor`, `expected_ctc_floor`, `notice_period`). Replace `stage: ask` with the user's stage so `/scrape` Step 0.5 never has to ask; leave fields that don't apply to the stage as-is.
- Refine the **Stage → portal sets** table only if the user's stage makes a shipped portal clearly irrelevant (e.g. remove global-remote boards for an onsite-only student) — the default mapping already matches the stage model.
- Refine the priority **query categories** with the user's actual function, role titles, and key skills so each category searches their real terms, keeping the category structure (organize by function, not title)
- Fill in the location filter tiers (`[YOUR_CITY]`, `[ACCEPTABLE_AREA_*]`) from their city and commute constraints

### 10. Salary data + environment pre-flight
`/apply`'s salary step silently skips when `salary_data.json` is missing, and the first `/scrape` fails loudly when `bun` or `lualatex` is absent — catch both here, once:
- **Salary data:** if `salary_data.json` does not exist in the repo root, copy `salary_data.example.json` to `salary_data.json` (gitignored — never commit the filled copy) and tell the user to replace every `0` placeholder with a researched figure (AmbitionBox for `market: india`, Glassdoor / Levels.fyi everywhere; figures in the market's currency — the example file's metadata names its scope). If it already exists, run `python salary_lookup.py --validate` and report the result; fix errors before finishing.
- **Toolchain:** verify `lualatex --version` succeeds (the CV/resume compile step needs it; see SETUP.md for the minimal-TeX package list) and `bun --version` succeeds followed by one `bun install` per portal CLI — Bash: `for d in .agents/skills/*-search/cli; do (cd "$d" && bun install); done`; Windows PowerShell: `Get-ChildItem ".agents/skills/*-search/cli" | ForEach-Object { Push-Location $_.FullName; bun install; Pop-Location }` (same loop as README Quick start §2). Report anything missing with the install command — do not proceed to "Try it out" with a broken toolchain.

---

## Step 4: Confirm & Next Steps

Present a summary:

> **Setup complete!** Here's what was generated:
>
> - `CLAUDE.md` - Your full candidate profile
> - `.claude/skills/job-application-assistant/01-candidate-profile.md` - Structured profile
> - `.claude/skills/job-application-assistant/02-behavioral-profile.md` - Behavioral assessment
> - `.claude/skills/job-application-assistant/04-job-evaluation.md` - Personalized evaluation framework
> - `.claude/skills/job-application-assistant/05-cv-templates.md` - CV templates with your profile statements and contact block
> - `.claude/skills/job-application-assistant/07-interview-prep.md` - STAR examples from your experience
> - `templates/cv-stock/main_example.tex` - Your LaTeX CV template (2 pages)
> - `templates/cv-stock/resume_example.tex` - Your LaTeX resume template (1 page)
> - `.claude/skills/job-scraper/search-queries.md` - Job search queries for `/scrape`
>
> **Privacy note:** the files above now contain your personal data and are *tracked by git*.
> A GitHub fork of the template is always public (forks of public repos cannot be made
> private), so do not push these commits to a fork. Keep them local, or push to a private
> repository instead - create an empty private repo and `git remote set-url origin <private-url>` (see SETUP.md section 2).
>
> **Try it out (pre-flight passed):**
> - `salary_data.json` present and `python salary_lookup.py --validate` clean (or freshly copied from the example template)
> - `lualatex` and `bun` verified; portal CLIs installed
> - Run `/scrape` to search for matching jobs right now
> - Run `/apply` with a job posting URL to see the full application workflow
> - Run `/setup --section search` later to update your search queries as your priorities evolve

If Path A left any STAR stubs in `07-interview-prep.md`, also note:

> Path A flagged [N] STAR candidate stubs in `07-interview-prep.md` that need your situation/task/action/result details before you use them in interviews.

---

## Design Principles

- Three onboarding paths converge on the same skill files. Step 0 picks the right path based on what's in `input/`. Steps 3 and 4 are shared.
- Path A is read-before-write and idempotent. Re-running it as input/ are added does not duplicate or overwrite existing content; conflicts are surfaced for explicit resolution.
- Path A labels inferred behavioral or style additions so the user can review them critically before relying on them.
- Each section in Path C is a natural conversation, not a form. The user can skip optional sections.
- Synthesize answers into structured formats (the user does not need to know markdown or LaTeX).
- Can be re-run with `--section <name>` to update specific sections (e.g., `/setup --section search` to reconfigure job search queries without re-doing the full profile).
- Section 9 (search) in Path C, and the equivalent follow-up questions in Path A, proactively suggest role types the user may not have considered.
- At the end, suggest running `/scrape` and `/apply` with a test job posting.
