# A screenshot-free walkthrough

The TUI and the HTML dashboard are both local and read-only. This page transcribes their output
instead of embedding images: images rot, and the repository has no image dependency.

## The terminal view

The TUI reads the Phase 10 snapshot through the shared core reader. It has no framework and no
write path.

```bash
bun run applyos/apps/tui/src/index.ts pipeline
```

```
PIPELINE
========

  applied            3
  drafted            1
  interview          2

6 row(s) · tracker v1
```

The shortlist carries scores, bands and the **gaps** — the honest part of the fit decision.

```bash
bun run applyos/apps/tui/src/index.ts shortlist --band "Strong Fit"
```

```
SHORTLIST
=========

  SCORE  BAND           TITLE / COMPANY                       GAPS
  -------------------------------------------------------------------
  82     Strong Fit     Backend Engineer — Acme               kubernetes
  78     Strong Fit     Data Engineer — Beta                  sql

2 of 6 shown
```

Posting detail shows the Phase 5 explanation, the gates and the quoted evidence:

```
Backend Engineer
Acme
82 · Strong Fit

DIMENSIONS
   technical    raw 0.90  contrib 0.27
      "python"
   behavioral   raw 0.80  contrib 0.12
      "works well in a small team"

GATES (9)
  PASS  eligibility
  FLAG  compensation — CTC ~8.0 LPA < floor 12 LPA

model 1.0.0

GAPS
  - kubernetes
```

A dimension that was never evaluated is shown with a `-` marker, not scored as zero. With no
tracker the TUI prints a setup hint instead of crashing:

```
No tracker found.

Run /setup to create your profile, then /scrape and /rank to build a shortlist.
This view is read-only: writes go through `applyos tracker set` or the specs.
```

## The dashboard

`/html-report` reads through `applyos tracker list` (or `applyos snapshot`) rather than parsing the
CSV again. It writes one self-contained HTML file under `output/reports/`: inline CSS, inline JS,
inline SVG charts, no CDN, no server, no telemetry. Re-running overwrites the same path.

What it answers, from the same tracker the TUI reads:

- how many applications are sent, active, interviewing, offered, hired, closed;
- which portal actually yields interviews (the **portal yield** table);
- the funnel — computed from current status **plus** the merged `outcome.md` stage checkboxes, so
  a candidate who interviewed and was later rejected still counts in the Interview bar;
- `drafted` rows excluded from every statistic, reported on their own.

The dashboard is data-only: it never writes to the tracker or the archive.

## Why the interface is deliberately small

Phase 9 measured ranking stability (Spearman ρ 1, score σ 0 under input reordering). The interface
therefore does not pretend the shortlist is more precise than it is: it shows bands, gaps and
quoted evidence rather than a single number with false confidence. A web UI is an explicit
non-goal; see the target architecture's non-goals.
