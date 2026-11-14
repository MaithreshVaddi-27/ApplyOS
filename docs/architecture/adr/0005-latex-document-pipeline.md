# ADR-0005: LaTeX + `lualatex` is the document pipeline

**Date**: 2026-07
**Status**: accepted
**Deciders**: ApplyOS maintainers

## Context

ApplyOS produces two document types: a **CV** (2 pages; 1 page for the `student` and `fresher`
stages) and a **resume** (exactly 1 page, at every stage). Both must survive an Applicant
Tracking System — which extracts text from a PDF and matches it against the job description.

The competing approach, used by the comparison project career-ops, is HTML + Playwright →
PDF, with a custom type stack (Space Grotesk + DM Sans).

## Decision

We use **LaTeX with `lualatex`**, the `moderncv` class, and the stock templates in
`templates/cv-stock/`. A generated document is verified by `tools/verify_pdf.py` for page count
and text-layer extractability, plus an ATS keyword check.

## Alternatives Considered

### Alternative 1: HTML + headless browser → PDF
- **Pros**: Easier to style with modern CSS; faster iteration; WYSIWYG.
- **Cons**: Requires a browser binary (Chromium via Playwright) — a far heavier prerequisite than
  a TeX distribution. Text extraction quality depends on the rendering pipeline. Font embedding
  and ATS parsing behaviour are less predictable.
- **Why not**: The prerequisite cost is real and the ATS outcome is the thing that actually
  matters. career-ops can afford the browser because it also needs one for form autofill; ApplyOS
  does not.

### Alternative 2: DOCX / Word
- **Pros**: The format recruiters actually open; editable by the candidate.
- **Cons**: ATS parsing of DOCX is unreliable across systems. Page count is not controlled.
- **Why not**: The hard 1-page and 2-page budgets — which CI asserts exactly — cannot be
  enforced on DOCX.

### Alternative 3: Typst
- **Pros**: Modern, fast, simpler than LaTeX.
- **Cons**: `moderncv` and its ecosystem are LaTeX. A Typst path means a second template family
  and a second set of page-count assertions.
- **Why not**: `/add-template` already supports a user-supplied compile command including Typst,
  so a Typst template is *possible*; it just is not the stock path.

## Consequences

### Positive
- Deterministic page counts. The resume is exactly 1 page and the CV exactly 2 at every stage —
  asserted in CI on two TeX Live ranges.
- A verifiable text layer. `verify_pdf.py` proves the PDF is machine-readable, which is the
  property ATS cares about.
- No browser dependency. `lualatex` is the only requirement.
- Version pinning is possible: `texlive-latest` (moderncv 2.5+) and `debian-bookworm`
  (TeX Live 2022 / moderncv 2.3.1) both compile the stock templates.

### Negative
- LaTeX is unpleasant to author and requires a learning curve for a custom template.
- The install is large. `SETUP.md` documents a minimal TeX Live set; the extra packages
  (`fontawesome5`, `pzdr` metrics) are easy to miss and produce a fatal error.
- The LaTeX leg is the slowest CI job. The Debian/TeX-2022 leg was moved to a weekly schedule
  for exactly this reason.

### Risks
- **A template compiles on the author's machine and not in CI.** `/add-template` Step 4
  requires a successful test compile *before* activation, and CI compiles both stock templates
  on two TeX ranges. The remaining exposure is a template that compiles only with a
  distribution-specific package — which is why the CI matrix deliberately spans two.
- **The phone placeholder trap.** `+91 XXXXX XXXXX` is used instead of `[YOUR_PHONE]` because a
  bare `_` is a LaTeX subscript and aborts the compile. This is recorded in `/setup` and
  `/reset`; it is a known sharp edge, not an oversight.
