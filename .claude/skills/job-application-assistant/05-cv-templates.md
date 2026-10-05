---
framework_version: 1.6.3
---

# CV Templates and Tailoring Guide

<!-- SETUP: Profile statements and section ordering are personalized by running /setup -->

## Template: LaTeX moderncv (Banking Style)

Both documents use the moderncv LaTeX package with the "banking" style and "blue" color scheme, and the same professional sans-serif.

**Output file:** `cv/main_<company>_<role>.tex` for a CV, `cv/resume_<company>_<role>.tex` for a resume — see the resume-vs-CV table below for how to choose. `/apply` resolves the type and names it `<DOC_TYPE>`/`<DOC_STEM>`; every path in this file is really `<DOC_STEM>`.
**Compile with:** **lualatex** on MiKTeX/TeX Live, for both templates. pdflatex often fails on modern MiKTeX installs with `fontawesome5` font-expansion errors; lualatex handles the same sources cleanly.
**Master references:** `cv/main_example.tex` (comprehensive CV, 2 pages - all competencies, experience, publications, awards) and `cv/resume_example.tex` (resume, 1 page). Use the one matching the run's document type; a resume and a CV are not interchangeable.

### Compile command

```bash
cd cv && lualatex -interaction=nonstopmode <DOC_STEM>.tex
```

Expected output: `Output written on <DOC_STEM>.pdf (1 page, ...)` for a resume, or `(2 pages, ...)` for a CV. Any other page count is a failure that must be fixed before presenting to the user. Run the compile twice so hyperref settles the page references.

## Document Structure

```latex
\documentclass[11pt,a4paper,sans]{moderncv}
\moderncvstyle{banking}
\moderncvcolor{blue}

% Force the name and section headings to render in moderncv blue (color1).
% Default banking leaves them black: moderncvstylebanking.sty's \colorlet
% copies (not aliases) the pre-scheme accent colour, so the name colours are
% frozen before \moderncvcolor runs. Re-let them after. \namefont is the hook
% every name-style macro routes through, so this also works on moderncv 2.3.1
% (Debian/Ubuntu apt), which has no \firstnamestyle/\lastnamestyle at all.
\renewcommand*{\namefont}{\fontsize{34}{36}\bfseries\upshape}
\colorlet{firstnamecolor}{color1}
\colorlet{lastnamecolor}{color1}
\colorlet{namecolor}{color1}
\renewcommand*{\sectionstyle}[1]{{\sectionfont\color{color1}#1}}

\usepackage[utf8]{inputenc}
% moderncv loads hyperref itself in an \AtEndPreamble hook, so \hypersetup
% must go in an \AtEndPreamble of our own: on moderncv < 2.4 a top-level
% \usepackage{hyperref} clashes with the class's own
% \RequirePackage[unicode]{hyperref}. From 2.4.0 the class passes its options
% through \PassOptionsToPackage instead, which is what removes that clash.
\AtEndPreamble{\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    filecolor=magenta,
    urlcolor=blue,
    pdftitle={[YOUR_NAME] - CV},
    % Keep pdfpagemode=UseNone: this block runs after moderncv's own
    % \AtEndPreamble (moderncv.cls sets pdfpagemode there), so a FullScreen
    % value here would win and open every CV in fullscreen presentation mode.
    pdfpagemode=UseNone,
}}
\usepackage[scale=0.77]{geometry}
\usepackage{import}

% Personal data
\name{[FIRST_NAME]}{[LAST_NAME]}
% If you have no address to list, DELETE this whole line. \address{}{}{} fails
% with "There's no line here to end" on every moderncv version.
% India convention (U12): city + state, no street address — recruiters screen
% on location and relocation willingness, not on your house number.
\address{[City, State]}{}{}
% India convention (U12): +91 with spaced groups, printed as literal text.
% Format the value per the Indian-format conventions block below.
% Keep this placeholder underscore-free — a bare `_` is a LaTeX subscript and
% aborts the compile at `\makecvtitle` with "Missing $ inserted" (F31).
% The same trap applies to the `[FIRST_NAME]`/`[LAST_NAME]`/`[YOUR_EMAIL]`
% tokens below: they compile only after `/setup` substitutes them, so
% substitute this whole block before building, or the build dies with an error
% that looks like a broken TeX installation.
\phone[mobile]{+91 XXXXX XXXXX}
\email{[YOUR_EMAIL]}
\extrainfo{\href{[YOUR_LINKEDIN_URL]}{LinkedIn}, \href{[YOUR_GITHUB_URL]}{GitHub}}

\begin{document}
\makecvtitle

% 1. Profile statement (1-3 sentences, tailored per role)
% 2. Skills section
% 3. Education section
% 4. Professional Experience section
% 5. Selected Publications (if applicable)
% 6. Honors and Awards (if applicable)
% 7. References

\end{document}
```

### Color overrides

The `\renewcommand*` on `\namefont` and the three `\colorlet` lines in the preamble are required on lualatex+MiKTeX. Without them the name and section headings render in black even though `\moderncvcolor{blue}` is set, which looks inconsistent with the rest of the blue accent scheme (links, bullet markers, contact icons). The cause: `moderncvstylebanking.sty` defines the name colours with `\colorlet`, which *copies* the accent colour as it is before the scheme is applied, so the name colours are frozen to the pre-scheme value; re-assigning them with `\colorlet` after `\moderncvcolor{blue}` (as the preamble does) re-pins them to `color1`. `\namefont` is the shared hook every name-style macro routes through, so the block is version-agnostic - including moderncv 2.3.1 from Debian/Ubuntu apt, which has no `\firstnamestyle`/`\lastnamestyle` at all. Both names render bold; if you prefer regular weight, change `\bfseries` to `\mdseries` in the `\namefont` line (the weight now lives there, so it applies to the whole name). Don't drop the overrides - on most modern installs the defaults render visibly wrong.

### Spacing inside itemize lists (important)

**Do not place `\vspace{...}` between `\item` entries in an `itemize` list.** Even though the source looks symmetric, this pattern occasionally produces a noticeably oversized gap before a single item: the inter-item `\vspace` creates a paragraph break that interacts unpredictably with the list's internal `\itemsep`, so LaTeX renders one of the gaps wider than the rest. Remove the inter-item `\vspace` and let `itemize` use its native uniform spacing.

```latex
% WRONG - intermittently produces an oversized gap before one bullet
\begin{itemize}
\item \textbf{Foo}: ...
\vspace{1pt}
\item \textbf{Bar}: ...
\vspace{1pt}
\item \textbf{Baz}: ...
\end{itemize}

% RIGHT - uniform spacing using the list's native itemsep
\begin{itemize}
\item \textbf{Foo}: ...
\item \textbf{Bar}: ...
\item \textbf{Baz}: ...
\end{itemize}
```

Two related patterns are fine and should be kept:
- `\vspace{1pt}` immediately after `\section{...}` (between section heading and first item) - this is between the heading and the list, not between list items.
- `\vspace{3pt}` between top-level `\cventry` blocks in Professional Experience or Education - this gives breathing room between roles and renders consistently.

### Document language and fonts are fixed

**Language: English, always.** Do not localize the document to the posting's language and do not produce a bilingual variant. A posting in another language is still answered in English (`/apply` Step 5d item 3 handles the resulting synonym-only keyword matches). Bilingual rendering was considered and declined: TeX Live ships no Devanagari or other Indic fonts, so a working template would need font binaries committed to the repo, and a mixed-script text layer degrades the ATS extraction that `tools/verify_pdf.py --check-ats` exists to protect.

**Fonts: professional sans-serif only.** The stock template is `moderncv` with the `sans` option, which resolves to Latin Modern Sans — a neutral, ATS-safe professional face that pairs with the blue `banking` scheme. Keep it. Do not swap in decorative, script, or display faces, and do not add a second family for emphasis: use bold and small caps, which the template already carries. A custom template registered via `/add-template` must keep an embedded, extractable text layer — `/apply` Step 5d fails the build otherwise.

## Section-by-Section Tailoring

### Profile Statement / Elevator Pitch (Best Practice)
This is the most important section to customize. It appears right after `\makecvtitle`.

Write 5-7 lines that function as an "elevator pitch": a concise, compelling introduction explaining why you're qualified for *this specific role*. Focus on what the employer gains from hiring you.

When the role sits outside your home domain, **lead with the domain-transfer argument** - the one or two sentences connecting your background to their problem (e.g. wave physics to radar signal processing) belong in the profile statement's opening. It is the strongest card a domain-changer holds; play it first.

**Create 2-3 profile statement templates for your main role types:**

<!-- SETUP: These are populated based on your background -->
**For [YOUR_PRIMARY_ROLE_TYPE] roles:**
> [YOUR_PROFILE_STATEMENT_TEMPLATE_1]

**For [YOUR_SECONDARY_ROLE_TYPE] roles:**
> [YOUR_PROFILE_STATEMENT_TEMPLATE_2]

Statements labeled *[Used for: <company>_<role>]* were extracted from archived application drafts by `/setup` Path A. They are **phrasing references, never fact sources**: when drafting from one, every factual claim still comes from `01-candidate-profile.md` - a past tailored draft does not vouch for its own accuracy.

### Core Competencies / Skills Section (Best Practice)
Reorder and emphasize based on the role. Use bold category labels.

List **5-7 key competencies** in bullet format, tailored to the specific job. For each competency, briefly explain how it adds value to the position.

Use the posting's own core term in the matching bullet's bold label when it truthfully applies - ATS and skim-reading hiring managers match literally, and "MLOps" in a heading outperforms a paraphrase like "ML Deployment".

### Education
- Always include your highest degrees
- For senior roles, keep education brief (dates and titles only)
- Include thesis topics when relevant to the target role

#### In-progress qualifications must say so explicitly

**A bare year range is not enough.** An entry reading `2025–2026`, seen partway through 2026, looks like a *finished* degree, because a reader skimming a CV treats a closed range as closed. A profile statement that says "currently completing…" does not fix it: the education entry is where a reader checks the credential, so it has to stand on its own.

State completion inside the entry itself:

```latex
\item{\cventry{2025--2026}{[Degree], [Field]}{[Institution]}{[Location]}{}{\vspace{1pt}
In progress, expected [Month Year]. [Relevant topics]
}}
```

Any consistent form works: `In progress, expected <Month Year>.` / `Expected completion <Month Year>.` / a date field of `2025–present`.

Claiming a credential not yet held is a factual misstatement, and it is the kind discovered at transcript or reference check rather than at interview. It costs nothing to prevent. The same applies to in-progress certifications and courses.

**Check for agreement:** for a current student, the profile statement, the education entry, and any availability or work-permit note must all give the same completion date. Contradiction between them is worse than any single version.

### Professional Experience
- Rewrite bullet points to emphasize aspects most relevant to the target role
- Use 4-6 bullets for most recent role, 3-4 for previous, 2-3 for older
- **Emphasize measurable results** where possible: "Reduced processing time by X%", "Model adopted by the team"

#### Check tenure against visible output

Before finalizing, look at each role the way a stranger will: **date span versus how much work is shown.** A two-year role represented by a single project reads as low output, whether or not that is fair. The reader cannot know what filled the time, so they guess, and the guess is unflattering.

This bites hardest on **career changers** (part of the tenure went into learning the new field), on **long-cycle work** (industrial deployment, clinical or regulatory projects, research — one delivery genuinely takes quarters), and on anyone whose employer kept them on a single account or product.

Three honest fixes, in order of preference:

1. **Surface more real work.** Ask what else the period contained. There are often real secondary projects, internal tooling, or support work that never reached the CV because it felt minor. Best fix when the material exists.
2. **Make the phases within the role explicit.** If the span genuinely had stages, say so — an initial period learning the domain or supporting the team, then ownership of the named work through to delivery. A phased arc reads as a growth curve; an undifferentiated multi-year block reads as stagnation.
3. **Name what made the cycle long.** Data collection from a live environment, validation with domain experts, deployment and iteration against real output. Reviewers who know the domain accept this immediately.

**Never** pad with invented projects, and **never** quietly shorten the employment dates so the ratio looks better. Both are discoverable, and both are worse than the perception problem being solved.

**Prepare the interview answer too.** If a long span against little visible output survives these fixes, the question is coming. The candidate needs a ready two-part answer — what actually filled the time, and what the outcome was — recorded in their interview prep rather than improvised in the room.

### Handling Employment Gaps (Best Practice)
If there is a gap in your employment history:
- The gap should be explained matter-of-factly if needed
- Describe how professional development continued during the gap
- Frame as deliberate skill-building and career repositioning

### Students and freshers: projects are the experience section (India)

A fresher CV with a thin or empty "Professional Experience" section reads as a red flag
*if the rest of the page is empty too* — but filled with real projects it reads exactly
like what Indian product companies and GCCs expect at entry level. The rules:

- **Score-carrying projects get real estate on page 1.** For the `student` and `fresher`
  stages, a **Projects** section belongs immediately after Core Competencies (see the
  ordering table at the end of this guide). Give each project 2–3 bullets: what it does,
  the stack (the posting's exact terms, truthfully), and one measurable outcome
  (users, dataset size, accuracy, latency, placement on a leaderboard).
- **Every project carries an evidence link** (`\href` to the repo, deployed demo, or
  hackathon page) — this is the same Evidence Links rule as defined under "Evidence Links" below, applied to the section
  where freshers actually have verifiable proof of work. A linked project outranks an
  unlinked one everywhere; for campus hiring it is often the only differentiator.
- **Hackathons, open-source, and coursework count as experience — say so explicitly.**
  A winner/finisher line for a named hackathon (Smart India Hackathon, a Unstop hiring
  challenge) is a legitimate `\cventry` under Experience-adjacent headings, with the
  placement and the artifact linked. Never file it under "Interests".
- **CGPA: include it when it helps.** Indian recruiters screen freshers on CGPA
  (a common cutoff is 7.0–8.0). Include it on the education entry when it is at or above
  the target company's band; when it is below, list the degree without the number and let
  projects and skills carry the page — omission of a weak number is honest framing, not
  fabrication, but do not round it up or "convert" it optimistically.
- **Never convert coursework into employment.** An internship is experience; a course
  project is a project. Label each truthfully — inventing a job title for project work is
  the fabrication the Factual Grounding Audit exists to catch.
- **Fresher profile statement shape:** 2–3 sentences, education first (degree, institution,
  graduation year), then the one strongest project or achievement with its metric, then
  the target role. Do not imitate senior-sounding 5-line pitches — Indian fresher reviewers
  read hundreds of these daily and overclaiming reads instantly.

### Publications
- Include Google Scholar link if applicable
- Select 3-4 most relevant publications (not always all of them)
- For non-academic roles, keep brief

### Evidence Links
Wherever the CV names a verifiable artifact - a public project, a hackathon entry, a publication - carry its link (`\href`) so a reader can verify the claim in one click. A CV whose strongest claims are checkable reads as more credible everywhere else too.

### Honors and Awards
- Keep format brief, one line each

### References
- List 2-4 references with name, title, company, and contact
- End with: "More references are available upon request."
- **Do not attach reference letters** - employers typically contact references directly

### LaTeX Special Characters (important)

Postings and profile data arrive as plain text; the CV is LaTeX. Escape these wherever they land in body text - company names, achievement bullets, skill lists:

| Character | Write | Typical trigger |
|---|---|---|
| `&` | `\&` | company names: L\&T, AT\&T, Johnson \& Johnson |
| `%` | `\%` | quantified achievements: "cut latency by 40\%" |
| `$` | `\$` | salary and cost figures |
| `#` | `\#` | "ranked \#1", C\# |
| `_` | `\_` | file names, code identifiers |
| `~` | `\textasciitilde{}` | URLs, "approx. 5 years" tildes |
| `^` | `\textasciicircum{}` | version strings, math |

Two failure modes deserve special care:

- **`%` fails silently.** An unescaped `%` starts a LaTeX comment: the compile succeeds with zero errors, and everything after the `%` on that line vanishes from the PDF. `Cut inference latency by 40% and saved DKK 2M annually` renders as "Cut inference latency by 40" - the bullet keeps its impressive-looking fragment and loses the actual result. Quantified achievement bullets are exactly where the guidance steers you ("use numbers where possible"), so check every `%` in every bullet before compiling.
- **`&` fails loudly** inside `\cventry` (alignment-tab errors, `Missing } inserted`). The compile loop catches it, but escape employer names up front rather than debugging the compile.

Related trap: a bullet whose text begins with a literal `[` must be braced - `\item {[text]}` - or LaTeX parses the bracketed text as `\item`'s optional label and renders it clipped off the left page edge with a clean compile. The example CV's placeholder bullets are braced for exactly this reason.

## Compile-and-Inspect Loop (MANDATORY)

After writing the CV and before presenting to the user, always compile and visually inspect the PDF. Iterate until the layout is clean. Workflow:

1. Run `lualatex -interaction=nonstopmode main_<company>_<role>.tex`
2. Check the output page count: must be exactly 2
3. Read the PDF via the Read tool and visually inspect both pages
4. Check for **orphaned entries**: a `\cventry` title line must never sit alone at the bottom of page 1 with its bullets on page 2

### Fixing common page-break problems

**Problem: entry title on page 1, bullets orphaned to page 2**
Add `\needspace{5\baselineskip}` immediately before the problematic `\cventry`:
```latex
\needspace{5\baselineskip}
\item{\cventry{YEAR--YEAR}{Role Title}{Organization}{Location}{}{...}}
```
Include `\usepackage{needspace}` in the preamble.

**Caveat - use `\needspace` before entries, never before `\section` headings.** A section-level `\needspace` pushes the entire section (heading plus content) to the next page whenever the request does not fit, stranding empty space above and typically *adding* a page instead of saving one. Apply it only to the individual `\cventry` that actually orphans, and only after a compile shows the orphan.

**Problem: one trailing section spills to page 3 (e.g., References alone on page 3)**
Add `\enlargethispage{2-3\baselineskip}` before a late section (e.g., before `\section{Honors and Awards}`) to stretch page 2 by a few lines. This is the standard LaTeX rescue for near-miss overflows.

**Problem: 3 pages with significant content on page 3**
Cut content — do not compress geometry or `\vspace`. See "Relevance-weighted cutting" below for the rule.

**Problem: content finishes early on page 2 (feels thin)**
Restore the highest-relevance item that was previously cut — a CV that ends mid-page 2 looks incomplete.

## ATS Parseability

Most employers run CVs through an ATS before a human sees them, and the ATS reads the PDF's embedded **text layer**, not the rendered page. A CV can pass visual inspection and still extract as garbage. After the layout passes the compile-and-inspect loop, verify the text layer:

```bash
python tools/verify_pdf.py cv/main_<company>_<role>.pdf --check-ats --dump-text cv/main_<company>_<role>.txt
```

Passing `--check-ats` runs automated validation of clean font mappings, presence of contact details (email and standard phone including `+91`), lack of LaTeX macro leaks or bracket traps, and standard ATS headings.

Extraction tries **pypdf** first (`pip install pypdf`, BSD license), then Poppler `pdftotext`. If a fallback still uses `pdftotext -layout`, it must also pass `-enc UTF-8`: Xpdf-based builds default to Latin-1, which makes every non-ASCII character in a perfectly good CV read back as a replacement character. If neither extractor is available, skip the mechanical check with a warning and rely on the visual PDF read for keyword coverage.

What to check in the extraction:

- **Contact details as literal text.** The stock template's fontawesome contact icons extract as glyph names (`MOBILE-ALT`, `Envelope`) - harmless noise, because the actual address and number are printed beside them. The failure mode is a contact detail carried *only* by an icon or a hyperlink (like the `LinkedIn` link text, whose URL is not in the text layer): invisible to an ATS. The email address must always appear as printed text.
- **No garbled output.** `(cid:NNN)` markers or `�` characters mean a font is embedded without a Unicode mapping - an ATS sees the same garbage. This shows up with unusual fonts in custom templates, not with the stock moderncv setup under lualatex.
- **Reading order.** The stock banking style is single-column, so extraction order matches visual order. Custom templates (via `/add-template`) with sidebars or multi-column layouts can interleave unrelated lines; if extraction order is scrambled, the user is trading ATS compatibility for looks and should be told.
- **Keyword coverage.** Match the posting's required/preferred terms against the extracted text. The CV is always English (`03-writing-style.md`); a posting term in another language is matched synonym-only, per `/apply` Step 5d item 3. Prefer the posting's exact term over a synonym when it is truthfully applicable - ATS matching is often literal. Never add a keyword the profile does not support.

### Date fields must be ASCII ranges (confirmed ATS import failure)

This one is worth knowing about because it fails **silently**. A CV that passes every other check in this section - clean extraction, no `(cid:)` markers, contact details intact, correct reading order - can still have its dates dropped on import. In a real Workday resume import, a CV built from this template lost the end date of a short contract role and failed to import **any** education entry at all, forcing manual re-entry. Nothing about the PDF or its text layer looked wrong.

Two independent causes, both easy to avoid:

1. **`--` in a `\cventry` date renders as an en-dash (U+2013), not a hyphen.** LaTeX ligatures `--` (two ASCII hyphens, U+002D) into a single en-dash glyph, so `2016--2024` reaches the PDF text layer as `2016<U+2013>2024`. Many parsers split date ranges only on an ASCII hyphen and see no range at all. Write the date argument with a **single hyphen**:

   ```latex
   \item{\cventry{2016-2024}{Role Title}{Organization}{Location}{}{...}}   % parses
   \item{\cventry{2016--2024}{Role Title}{Organization}{Location}{}{...}}  % en-dash, may not
   ```

   This applies to the **date argument only**. Keep `--` everywhere it is typographically correct in prose, for example a numeric range like `EUR 600k--1M`.

2. **A bare single year gives the parser no end date.** A short contract, mandate or internship written as `\cventry{2016}` imports as a start date with nothing to close it. Use an explicit range, with months where the role ran under a year:

   ```latex
   \item{\cventry{Mar 2016 - Jul 2016}{Contract Role}{Client}{Location}{}{...}}
   ```

   Where a genuine range exists, use it even when a single year would be factually accurate - a degree written `1995` is true but imports worse than `1992-1995`. Do not invent a start date you do not have; a lone graduation year is fine, just expect it to be typed in by hand.

**Add this to the step 5d checks**: after extracting the text layer, confirm every experience entry shows a start *and* an end separated by an ASCII hyphen. Because the failure is silent and invisible in the PDF, the candidate otherwise discovers it only while filling in the application form.

## Two document types: resume and CV

`/apply` produces **one** document per run, and the user chooses which (Step 2 resolves
`--resume` / `--cv`, then the profile's `Document type:` line, defaulting to `cv`). They
are different documents, not one document resized — different section sets, different
page budgets, different stock templates.

| | **Resume** — `cv/resume_example.tex` | **CV** — `cv/main_example.tex` |
|---|---|---|
| Page budget | **exactly 1**, at every stage | **exactly 2**; 1 for the `student` / `fresher` stages |
| Profile statement | 1-2 lines, one claim | 3-5 lines |
| Skills | one dense labelled line | `Core Competencies`, 4-5 bulleted categories |
| Projects | its own section, above Education | folded into the stage ordering above |
| Publications / Honors / References | **omitted** — they cost a third of a page and read as padding | included when the profile has real content |
| Certifications | one line each, no dates or issuer boilerplate; whole section deleted if none | folded into Awards |
| Experience depth | 3 slots — 2 roles + 1 internship, 2-3 bullets each | as many roles as fit, 3-4 bullets each |
| Education | 1-2 entries, no thesis detail | full history, thesis allowed |
| Type size | `10pt` | `11pt` |
| Geometry `scale` | `0.80` — same as the CV, because `scale` sets the text-block **width**, not the type size; lowering it narrows the column, which is the wrong way to save space on a one-pager | `0.80` |

**Fill target for the resume template: ~80% of the page, not 100%.** The stock
`cv/resume_example.tex` is deliberately not a full page. A placeholder is one line
where a real achievement is one to two, so a template filled to the brim overflows to
2 pages the moment the user types their own text — which silently breaks the hard
1-page budget. `cv/resume_example.tex` compiles to 1 page at ~77% fill (197pt of
headroom), sized so real content lands on 1 page. To fit more, **delete a slot you do
not need**; never shrink the type size or the geometry scale.

Which to send: the **resume** when the posting asks for one, when you are early-career,
or when you want the tightest possible read. The **CV** when the role is research-heavy,
when the posting says "CV" explicitly, when a recruiter or alumni referral asks for one,
or when you have publications, awards, or a long history that a 1-pager would flatten.
When a posting does not say, the resume is the safer default in India; send the CV when
you have academic or long-experience content that would be wasted otherwise.

Both are English-only and use the same professional sans-serif (moderncv `sans` →
Latin Modern Sans). Both must pass `tools/verify_pdf.py --check-ats` and the page-count
check in `/apply` Step 5b. Registering a custom template for either type is
`/add-template`; the two are activated independently.

## Page Budget - Hard Limit

The **CV** must fit on exactly 2 pages when compiled — **except for the `student` and
`fresher` stages, where the target is exactly 1 page** (see the stage ordering above):
Indian fresher reviewers expect a one-pager, and a thin CV stretched to 2 pages reads
worse than a tight single page. Move to 2 pages only when real content (internships plus
a full Projects section) genuinely fills page 1. The compile-and-inspect loop's page-count
check follows whichever target the active stage sets; `/apply` Step 5b states the rule.

Use these content limits as a guide:

| Section | Max budget |
|---------|-----------|
| Profile statement | 3-4 lines |
| Skills | 5 items, each 1-2 lines |
| Most recent role | 4-5 bullets |
| Previous role | 2-3 bullets |
| Older roles | 2 bullets (1 line each) |
| Education | 2-3 entries |
| Publications | 2-3 entries |
| Awards | 3 entries, single line each |
| References | "Available upon request." (single line) |

**If in doubt, cut rather than squeeze.** Reducing `\vspace` or geometry scale to force-fit content makes the CV look cramped.

## Relevance-weighted cutting (the right way to shrink a CV)

**Cut by signal, not by section.** Static priority lists ("remove oldest education first, then shorten the earliest role...") are wrong when a relevant "lower-priority" item is competing with an irrelevant "higher-priority" item. An older-role bullet that speaks directly to the posting is worth more than a recent-role bullet that does not.

For every candidate line, score three things:

1. **Relevance to THIS posting** — does the line hit a named tool, keyword, or stated responsibility in the job ad?
2. **Uniqueness** — is it the only place this claim appears, or is it duplicated elsewhere in the CV?
3. **Narrative load** — does another section depend on it? If cutting the line would force you to rewrite the profile statement or a section intro, it is load-bearing.

Cut the lowest-total-score line first, regardless of which section it sits in.

### Practical order of cuts (easiest → last resort)

1. **Redundancy.** If an achievement appears in both Core Competencies AND a role bullet, the Core Competencies version is usually the cleaner cut (the experience bullet is more concrete evidence).
2. **Profile-statement fluff.** A sentence that just restates what Publications or Skills will show. ("Peer-reviewed publications on X..." is already a Publications entry — profile can claim it once and stop.)
3. **Low-relevance experience bullets.** A bullet about work that does not touch posting keywords, wherever it sits. This cuts across sections before touching the structural list.
4. **Low-relevance supporting content.** An older-role bullet that does not speak to the target role. A certification that does not touch the posting's stack. 5. **Low-relevance publications.** Keep 1-2 publications that best match the posting. Cut the rest before touching experience bullets.
6. **Last-resort structural cuts.** Oldest education entry, tightening an older role to 2 bullets, collapsing Certifications into a single line. These only happen if the relevance-weighted cuts above have already been exhausted.

### Pitfalls to avoid

- Do not mechanically cut from the bottom of a static section list without checking relevance. "Cut the oldest role first" is wrong if that role is literally about the skill the posting asks for.
- Do not cut the one concrete example the profile statement leans on. Relevance is measured against the posting you are answering, not just the keyword list — the interviewer reads the finished CV end to end.
- Do not cut to fit if the fit is borderline (2.02 pages). Prefer `\enlargethispage{2-3\baselineskip}` on a late section for near-misses; reserve content cuts for genuine overflow (content on page 3 that is more than a single trailing section).

## Recommended Section Order

The section order varies by role type:

**For technical / data science / ML roles:**
1. Profile statement / elevator pitch
2. Core competencies / Skills
3. Professional Experience (reverse chronological)
4. Education (reverse chronological)
6. Publications & Awards
7. References

**For domain-specific / specialist roles:**
1. Profile statement / elevator pitch
2. Core competencies / Skills
3. Education (reverse chronological) - credentials are a key qualifier
4. Professional Experience (reverse chronological)
5. Publications & Awards
6. References

**For student / fresher stages (India - see the projects section above):**
1. Profile statement (education-first shape, 2-3 sentences)
2. Core competencies / Skills
3. Projects (2-3 score-carrying projects, every one with an evidence link)
4. Professional Experience / Internships (however thin - label truthfully; hackathons and hiring-challenge placements go here-adjacent, never under Interests)
5. Education (degree, institution, graduation year, CGPA when it helps)
6. Achievements & Certifications (relevant ones only)
7. References or "Available upon request."

The ordering principle: when work history is thin, the strongest verifiable evidence
moves up the page. Projects before Education is deliberate - the education entry is
the one section every fresher CV has, so it differentiates least.

## Indian-format conventions (U12)

These apply when the target market is India (the Stage Profile's stage model and the
`/scrape` portal set decide that; they are not a nationality assumption):

- **Phone: `+91 XXXXX XXXXX`** - country code always present, 5+5 spaced groups,
  printed as literal text (the ATS checker in `tools/verify_pdf.py --check-ats`
  already expects `+91`). This is the single most-missed item: templates adapted from
  US/EU sources print bare 10-digit numbers that Indian ATS screens flag.
- **Address: `City, State`** - no street address, no PIN code on the CV header.
  Recruiters screen on location and relocation willingness; add "Willing to relocate
  to <city>" in the profile statement or availability line when true and relevant.
- **Dates: DD/MM/YYYY** anywhere the CV states a full date outside `\cventry` date
  arguments - availability lines ("Available from 01/07/2026"), certificate issue
  dates, application-form fields. Keep `\cventry` date arguments in the ATS-safe form
  from the section above (`Mon YYYY - Mon YYYY` or `YYYY - YYYY`, ASCII hyphen) -
  those are parsed by machines, the DD/MM/YYYY rule governs dates a human reads.
- **Salary/CTC figures never appear on the CV itself** - the CTC Gate handles
  evaluation; a number on the CV only anchors negotiations downwards.
