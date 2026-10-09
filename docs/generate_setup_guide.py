#!/usr/bin/env python3
"""Generate docs/ApplyOS-setup-guide.pdf — the personalized setup guide.

Regenerate: python docs/generate_setup_guide.py
Requires: pip install reportlab pypdf  (local build tools only, not repo deps)

Every claim below is grounded in the repo at generation time:
commands from .claude/commands/, skills from .claude/skills/, portals from
.agents/skills/*-search, seeds from standalone registry.yaml. Re-check them
when the repo changes; the script fails loudly if a referenced file moves.
"""

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
    TableStyle, Preformatted, KeepTogether, PageBreak,
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import ParagraphStyle
import datetime
import subprocess

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "ApplyOS-setup-guide.pdf"


def repo_commit():
    try:
        out = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=str(ROOT),
                             capture_output=True, text=True, timeout=15)
        return out.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


GEN_DATE = datetime.date.today().isoformat()
GEN_COMMIT = repo_commit()

# --- palette: premium dark (deep navy, glowing sky accent) ---
BG = HexColor("#0B1220")
CARD = HexColor("#141D33")
CARD_EDGE = HexColor("#2B3D5C")
ACCENT = HexColor("#38BDF8")
INK = HexColor("#F1F5F9")
TEXT = HexColor("#CBD5E1")
MUTED = HexColor("#7D8DA6")
WARN_BG = HexColor("#451a03")
WARN_EDGE = HexColor("#F59E0B")
INFO_BG = HexColor("#082f49")
INFO_EDGE = HexColor("#38BDF8")
CODE_BG = HexColor("#050B18")
BADGE_BG = HexColor("#0C2A45")
BADGE_TEXT = HexColor("#7DD3FC")

W, H = A4


def bg_canvas(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BG)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)
    canvas.restoreState()


def footer_canvas(canvas, doc):
    bg_canvas(canvas, doc)
    canvas.saveState()
    canvas.setStrokeColor(CARD_EDGE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, 12 * mm, W - 20 * mm, 12 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7)
    canvas.drawString(20 * mm, 9 * mm, "ApplyOS Setup Guide  ·  Framework v1.3.1")
    canvas.drawRightString(W - 20 * mm, 9 * mm, f"page {canvas.getPageNumber()}")
    canvas.restoreState()


class GuideDoc(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name == "h1":
            self.notify("TOCEntry", (0, flowable.getPlainText(), self.page, None))


def s(name, **kw):
    base = dict(fontName="Helvetica", textColor=TEXT, leading=14)
    base.update(kw)
    return ParagraphStyle(name, **base)


ST_TITLE = s("title", fontSize=28, leading=32, textColor=INK, alignment=1, fontName="Helvetica-Bold")
ST_SUB = s("sub", fontSize=11, leading=15, textColor=MUTED, alignment=1)
ST_H1 = s("h1", fontSize=17, leading=21, fontName="Helvetica-Bold", textColor=INK)
ST_H1SUB = s("h1sub", fontSize=9, leading=12, textColor=MUTED)
ST_H2 = s("h2", fontSize=12, leading=15, fontName="Helvetica-Bold", textColor=ACCENT)
ST_P = s("p", fontSize=9, leading=13)
ST_SMALL = s("small", fontSize=8, leading=11, textColor=MUTED)
ST_BADGE = s("badge", fontSize=8, leading=11, fontName="Helvetica-Bold", textColor=BADGE_TEXT, alignment=1)
ST_CELL = s("cell", fontSize=8.5, leading=11.5)
ST_CELL_H = s("cellh", fontSize=8.5, leading=11.5, fontName="Helvetica-Bold", textColor=ACCENT)
CODE_STYLE = ParagraphStyle("code", fontName="Courier", fontSize=7.5, leading=10.5, textColor=INK)


def code_block(text):
    t = Table([[Preformatted(text, CODE_STYLE)]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
        ("BOX", (0, 0), (-1, -1), 0.5, CARD_EDGE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def card(title, body):
    """A titled card: heading row + body paragraph."""
    inner = [
        [Paragraph(f"<b>{title}</b>", ST_H2)],
        [Paragraph(body, ST_CELL)],
    ]
    t = Table(inner, colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARD),
        ("BOX", (0, 0), (-1, -1), 0.5, CARD_EDGE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def warn_box(body):
    t = Table([[Paragraph(f"<b>Privacy warning:</b> {body}", ST_CELL)]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WARN_BG),
        ("BOX", (0, 0), (-1, -1), 0.75, WARN_EDGE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def info_box(title, body):
    t = Table([[Paragraph(f"<b>{title}:</b> {body}", ST_CELL)]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INFO_BG),
        ("BOX", (0, 0), (-1, -1), 0.75, INFO_EDGE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def os_shell_note():
    return info_box(
        "Platform shells",
        "macOS and Linux run these snippets in <b>bash/zsh</b> as written. On <b>Windows</b>, use "
        "<b>PowerShell</b> forms where shown; plain <i>cd</i> + command lines work everywhere, but the "
        "<i>&amp;&amp;</i> chain operator does not exist in Windows PowerShell 5.1 (default on Windows 10/11).")


def grid(cards, cols=3):
    """Flow card titles/bodies into an N-column grid."""
    rows = [cards[i:i + cols] for i in range(0, len(cards), cols)]
    width = 170 * mm / cols
    built = []
    for r in rows:
        while len(r) < cols:
            r.append((None, None))
        built.append([
            Table([[Paragraph(f"<b>{t}</b>", ST_H2)], [Paragraph(b, ST_SMALL)]],
                  colWidths=[width - 4]) if t else ""
            for t, b in r
        ])
    t = Table(built, colWidths=[170 * mm / cols] * cols, spaceBefore=4, spaceAfter=4)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CARD),
        ("BOX", (0, 0), (-1, -1), 0.5, CARD_EDGE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, CARD_EDGE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def section(num, title, sub):
    return [
        Paragraph(f'<font color="#38BDF8"><b>{num}</b></font>&nbsp;&nbsp;{title}', ST_H1),
        Paragraph(sub, ST_H1SUB),
        Spacer(1, 4),
    ]


def bullets(items):
    return [Paragraph("•&nbsp;&nbsp;" + i, ST_P) for i in items]


def build():
    # Fail loudly if the repo moved under us.
    for p in [".claude/commands/apply.md", ".claude/skills/job-scraper/SKILL.md",
              "standalone/packages/company-scraper/registry.yaml", "AGENTS.md"]:
        assert (ROOT / p).is_file(), f"missing: {p}"

    story = []
    sec_cover(story)
    sec_prerequisites(story)
    sec_agent(story)
    sec_clone(story)
    sec_bun(story)
    sec_latex(story)
    sec_setup(story)
    sec_commands(story)
    sec_standalone(story)
    sec_skills(story)
    sec_portals(story)
    sec_workflow(story)
    sec_files(story)

    doc = GuideDoc(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                   topMargin=15 * mm, bottomMargin=18 * mm,
                   title="ApplyOS — Complete Setup Guide & Architecture Documentation",
                   author="ApplyOS contributors")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=footer_canvas)])
    doc.multiBuild(story)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")



def sec_cover(story):
        story += [Spacer(1, 30),
                  Paragraph("ApplyOS", ST_TITLE),
                  Paragraph("Complete Setup Guide &amp; Architecture Documentation", ST_SUB),
                  Spacer(1, 4),
                  Paragraph("India + Global Remote Edition — the job search that runs on your machine", ST_SUB),
                  Spacer(1, 8)]
        badges = Table([[
            Paragraph("Framework v1.3.1", ST_BADGE),
            Paragraph("OpenCode reference", ST_BADGE),
            Paragraph("LaTeX CV + resume", ST_BADGE),
            Paragraph("12 portal CLIs", ST_BADGE),
        ]], colWidths=[42.5 * mm] * 4)
        badges.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), BADGE_BG),
            ("BOX", (0, 0), (-1, -1), 0.5, ACCENT),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, ACCENT),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        toc = TableOfContents()
        toc.levelStyles = [
            ParagraphStyle("toc0", fontName="Helvetica", fontSize=10, leading=15,
                           textColor=TEXT, leftIndent=0, firstLineIndent=0, spaceBefore=2),
        ]
        story += [badges, Spacer(1, 6),
                  Paragraph(f"Generated {GEN_DATE} from commit {GEN_COMMIT} — regenerate with "
                            "<i>python docs/generate_setup_guide.py</i> after repo changes.", ST_SMALL),
                  Spacer(1, 6),
                  Paragraph("<b>Contents</b>", ST_H2),
                  toc]


def sec_prerequisites(story):
        story += section("1", "Prerequisites", "Everything you need before installing the framework")
        story.append(os_shell_note())
        story.append(Spacer(1, 4))
        story.append(grid([
            ("AI coding agent", "OpenCode (reference), Claude Code, Codex CLI, Antigravity, ZCode, or any AGENTS.md-compatible agent."),
            ("Python 3.10+", "Salary lookup, rank state, PDF/ATS verification, and repo guard scripts. Stdlib only."),
            ("Bun", "JavaScript runtime for the portal CLI tools. Pinned to 1.4.2 for standalone/."),
            ("LaTeX", "TeX Live, MacTeX, TinyTeX, or MiKTeX with lualatex. The CV/resume compile engine."),
            ("pdftotext (optional)", "Poppler tools — ATS text-layer fallback when pypdf is unavailable."),
            ("Git", "Clone, branch, and manage the repository on any OS."),
        ], cols=3))
        story.append(warn_box("This is a public fork. Run your own search from a <b>private repository</b> — "
                              "/setup writes personal data (name, contact details, employment history, salary "
                              "expectations) into tracked profile files."))
        story.append(PageBreak())


def sec_agent(story):
        story += section("2", "Install the agent", "The runtime that executes every workflow")
        story.append(card("Option A: OpenCode (reference runtime)",
                          "Native slash commands in .opencode/command/, permission gating in opencode.json, "
                          "subagents in .opencode/agent/. See opencode.ai for installation."))
        story.append(Spacer(1, 4))
        story.append(card("Option B: Claude Code / Codex CLI / others",
                          "Claude Code uses .claude/ natively; Codex CLI, Antigravity, ZCode, FreeBuff and any "
                          "AGENTS.md-compatible agent work through the routing table in AGENTS.md."))
        story.append(Spacer(1, 4))
        story.append(code_block("opencode --version   # or: claude --version"))


def sec_clone(story):
        story += section("3", "Clone the repository", "Fork first, then clone your copy")
        story.append(code_block(
            "# Fork github.com/MaithreshVaddi-27/ApplyOS on GitHub first.\n"
            "# For your own job search, fork into a PRIVATE repository.\n"
            "git clone https://github.com/<you>/<your-repo>.git\n"
            "cd <your-repo>\n"
            "git remote -v   # confirm where pushes go"))
        story.append(Spacer(1, 4))
        story.append(info_box(
            "Windows line endings",
            "If editors show every line as changed after cloning on Windows, run "
            "<i>git config core.autocrlf true</i> once — the repo normalizes line endings on commit."))
        story.append(PageBreak())


def sec_bun(story):
        story += section("4", "Install Bun & portal CLI tools", "One runtime plus twelve portal search CLIs")
        story.append(code_block("# macOS / Linux\ncurl -fsSL https://bun.sh/install | bash\n"
                                "# Windows (PowerShell)\n"
                                "powershell -c \"irm bun.sh/install.ps1|iex\"\nbun --version"))
        story.append(Spacer(1, 4))
        story.append(code_block(
            "# Bash / zsh — discovers every installed portal skill automatically\n"
            "for d in .agents/skills/*-search/cli; do (cd \"$d\" && bun install); done\n\n"
            "# Windows PowerShell (same loop, from README Quick start)\n"
            "Get-ChildItem \".agents/skills/*-search/cli\" | ForEach-Object {\n"
            "  Push-Location $_.FullName; bun install; Pop-Location\n}"))
        story.append(Spacer(1, 4))
        story.append(Paragraph("Portal CLIs ship zero runtime dependencies — <i>bun install</i> only pulls TypeScript "
                               "dev types for typechecking. Each CLI passes the same contract: <i>search</i>/<i>detail</i>, "
                               "<i>--format json|table|plain</i>, stderr <i>{error,code}</i> + exit 1 on failure.",
                               ST_SMALL))
        story.append(Spacer(1, 4))
        story.append(info_box(
            "Which shell on which OS",
            "<b>macOS / Linux:</b> the Bash loop above (Terminal, iTerm2, GNOME Terminal — zsh or bash). "
            "<b>Windows:</b> the PowerShell loop (Windows Terminal recommended; inbox PowerShell 5.1 works — "
            "avoid Git Bash path translation quirks for <i>bun install</i>). Verify with <i>bun --version</i> (1.4.2)."))


def sec_latex(story):
        story += section("5", "Install a LaTeX distribution", "Required to compile CV and resume PDFs (lualatex)")
        rows = [["Platform", "Recommended", "Install"],
                ["macOS", "MacTeX", "brew install --cask mactex"],
                ["Linux (Debian/Ubuntu)", "TeX Live", "sudo apt install texlive-full"],
                ["Windows", "MiKTeX", "Download from miktex.org"],
                ["Any (minimal)", "TinyTeX", "quarto install tinytex"]]
        t = Table([[Paragraph(f"<b>{c}</b>" if i == 0 else c, ST_CELL) for c in r] for i, r in enumerate(rows)],
                  colWidths=[55 * mm, 45 * mm, 70 * mm])
        t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CARD),
                               ("BOX", (0, 0), (-1, -1), 0.5, CARD_EDGE),
                               ("INNERGRID", (0, 0), (-1, -1), 0.4, CARD_EDGE),
                               ("LEFTPADDING", (0, 0), (-1, -1), 6),
                               ("TOPPADDING", (0, 0), (-1, -1), 4),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        story.append(t)
        story.append(Spacer(1, 4))
        story.append(code_block("lualatex --version\n# minimal installs also need:\n"
                                "tlmgr install moderncv fontawesome5 xcolor geometry hyperref needspace\n"
                                "# macOS: brew install poppler | Debian/Ubuntu: sudo apt install poppler-utils\n"
                                "# Windows: choco install poppler   (pdftotext fallback, optional)"))
        story.append(Spacer(1, 4))
        story.append(info_box(
            "TeX managers per OS",
            "<b>macOS (MacTeX) / Linux (TeX Live):</b> missing packages install via <i>tlmgr</i> (may need "
            "<i>sudo tlmgr</i> on Linux; update with <i>tlmgr update --self</i> first). <b>Windows (MiKTeX):</b> "
            "missing packages pop an auto-install prompt — accept it, or pre-install from MiKTeX Console. Compile "
            "commands (<i>lualatex</i>, <i>pdftotext</i>) are identical on all three OSs."))
        story.append(PageBreak())


def sec_setup(story):
        story += section("6", "Run /setup — build your profile", "Interactive onboarding; three paths")
        story.append(code_block("cd <your-repo>\nopencode     # or: claude / codex / your agent\n# inside the agent:\n/setup"))
        story.append(Spacer(1, 4))
        story.append(card("Path A: input/ folder mode (recommended)",
                          "Drop your resume, LinkedIn export, diplomas, and references into input/ — /setup reads "
                          "everything, cross-references for consistency, and builds the profile. Idempotent; re-run as "
                          "you add material."))
        story.append(Spacer(1, 4))
        story.append(card("Path B: single CV import",
                          "Paste or attach one CV/resume; the agent extracts it and asks follow-ups for what is missing."))
        story.append(Spacer(1, 4))
        story.append(card("Path C: interview mode",
                          "Structured questions section by section. Best when starting from scratch. Also re-runnable "
                          "per section via /setup --section search."))
        story.append(Spacer(1, 4))
        story.append(Paragraph("What /setup writes: <i>01-candidate-profile.md</i> (identity, education, experience), "
                               "<i>02-behavioral-profile.md</i>, <i>05-cv-templates.md</i> statements, <i>07-interview-prep.md</i> "
                               "STAR examples — plus the Stage Profile (student / fresher / experienced / remote-global) "
                               "that steers portals, scoring, and documents.", ST_P))
        story.append(Spacer(1, 4))
        story.append(info_box(
            "Running the agent per OS",
            "Agent CLIs install and run the same everywhere (<i>npm i -g</i> once). Launch from a shell in the repo "
            "root: <b>macOS/Linux:</b> Terminal/zsh; <b>Windows:</b> PowerShell in Windows Terminal. The agent runs "
            "toolchain checks itself (<i>lualatex --version</i>, <i>bun --version</i>, per-CLI <i>bun install</i>) "
            "before writing anything."))


def sec_commands(story):
        story += section("7", "All commands — full reference", "Fourteen slash commands; four form the core loop")
        story.append(card("Core loop: /setup → /scrape → /rank → /apply",
                          "/setup builds the profile. /scrape searches every stage-relevant portal CLI, dedupes, and "
                          "presents matches. /rank batch-scores them against the fit framework (stage-weighted Technical / "
                          "Experience / Behavioral / Career dimensions plus hard gates). /apply evaluates one posting, "
                          "drafts a tailored CV or resume in LaTeX, runs a reviewer pass, compiles with lualatex, "
                          "ATS-checks the text layer, and presents the PDF. No cover letters — removed by design."))
        story.append(Spacer(1, 4))
        groups = [
            ("Application support", "/expand (public-source enrichment) — /upskill (skill-gap heatmap + learning plan)"),
            ("Tracking &amp; sync", "/outcome (record results + archive) — /outcome followup (7-day India cadence + WhatsApp drafts) — /gmail-sync (proposes tracker updates, you approve) — /html-report (offline HTML dashboard) — /notion-sync (one-way pipeline view)"),
            ("Interview", "/interview (stage prep pack from the real archive: posting, submitted CV, STAR mapping, mock)"),
            ("Configuration", "/add-portal (scaffold a new board CLI) — /add-template (register a CV/resume toolchain) — /reset (wipe profile or input/, type RESET)"),
        ]
        for title, body in groups:
            story.append(card(title, body))
            story.append(Spacer(1, 4))
        story.append(PageBreak())


def sec_standalone(story):
        story += section("8", "Standalone clean-room build", "The greenfield applyos binary on this branch")
        story.append(Paragraph("Under <i>standalone/</i> — Bun monorepo (<i>applyos-standalone</i>, Bun 1.4.2 pinned), "
                               "zero external dependencies, CI on Ubuntu + Windows + macOS:", ST_P))
        story.append(Spacer(1, 2))
        for title, body in [
            ("apps/cli — applyos", "<i>scrape</i> (unified fan-in, per-source notes, --stage), <i>rank</i> (7 gates + weights), <i>apply</i> (traced pack) + <i>--batch</i> for multi-posting packs. Exit 0 iff ≥1 pack built."),
            ("packages/core", "JobPosting contracts (postedDate null, never invented), polite fetch (20 s + 1 retry, ≥300 ms pacing), robots gate, dedupe, fair-slice interleave, json|table|plain."),
            ("packages/company-scraper", "Employer ATS boards (amazon.jobs, Greenhouse, Lever, SmartRecruiters, Workday) + registry.yaml — 7 verified seeds including the first live-verified Workday tenant (JioStar, 226 postings)."),
            ("packages/portals", "Fresh per-board adapters (remoteok, remotive, weworkremotely, unstop; freehire fails loudly until its endpoint verifies)."),
            ("packages/matching + docgen", "Two-stage ranker and application factory: every bullet traced to experience[i].bullets[j]; gaps listed, never stuffed."),
        ]:
            story.append(card(title, body))
            story.append(Spacer(1, 3))
        story.append(code_block("cd standalone && bun install && bun test   # 78 tests\n"
                                "bun run --filter \"*\" typecheck             # 6 packages\n"
                                "bun run ./apps/cli/src/cli.ts scrape -q \"backend intern\" --stage student -n 5"))
        story.append(Spacer(1, 4))
        story.append(info_box(
            "One chain, three OSs",
            "The <i>cd standalone &amp;&amp; bun install &amp;&amp; bun test</i> chain is written for "
            "bash/zsh and PowerShell 7+. On inbox Windows PowerShell 5.1 run each line separately — same "
            "packages install (Bun 1.4.2, TypeScript dev types only) and the same 78 tests pass on all OSs; "
            "CI proves it on Ubuntu, Windows, and macOS runners."))


def sec_skills(story):
        story += section("9", "Skills — framework intelligence", "Three Markdown skills; the assistant loads them by keyword")
        story.append(card("job-application-assistant (core)",
                          "The full workflow brain: profile shape, 5-dimension evaluation, CV/resume tailoring, interview "
                          "prep, web-research rules. Reference files: 01 candidate, 02 behavioral, 03 writing style, "
                          "04 job evaluation, 05 CV templates, 07 interview prep, 08 application forms, 09 web research. "
                          "There is no 06 — cover-letter templates were removed from the framework."))
        story.append(Spacer(1, 4))
        story.append(card("job-scraper",
                          "Search orchestration: stage-to-portal mapping, India location taxonomy, referral-first output, "
                          "portal health checks, seen_jobs.json dedupe state. Used by /scrape and /rank."))
        story.append(Spacer(1, 4))
        story.append(card("upskill",
                          "Gap heatmap between profile and postings plus a learning plan mapped to Indian interview norms "
                          "(DSA, fundamentals; NPTEL, GeeksforGeeks, free options)."))
        story.append(PageBreak())


def sec_portals(story):
        story += section("10", "Portal CLI tools", "Twelve boards, one contract, stage-selected")
        portals = [
            ("naukri-search", "India, experienced + fresher 0–1 yr filter. LPA salary + experience flags."),
            ("internshala-search", "India internships &amp; fresher roles (core student stage)."),
            ("unstop-search", "India campus hiring challenges (leaderboard → interview aware)."),
            ("cutshort-search", "India AI-matched startups, fresher-to-3yr band."),
            ("careers-search", "Employers' own ATS boards: amazon.jobs, Greenhouse, Lever, SmartRecruiters, Workday."),
            ("linkedin-search", "Global + India cities (personal-use only per its ToS note)."),
            ("wellfound-search", "Global startups (AngelList)."),
            ("remoteok-search", "Global remote (public API)."),
            ("remotive-search", "Global remote (public API)."),
            ("weworkremotely-search", "Global remote (RSS)."),
            ("freehire-search", "Aggregator; endpoint unverified — fails loudly per source."),
            ("wayup-search", "US early-career only; ships <b>enabled: false</b>."),
        ]
        prows = [[Paragraph("<b>Skill</b>", ST_CELL_H), Paragraph("<b>Market &amp; notes</b>", ST_CELL_H)]]
        for name, note in portals:
            prows.append([Paragraph(name, ST_CELL), Paragraph(note, ST_CELL)])
        pt = Table(prows, colWidths=[45 * mm, 125 * mm])
        pt.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CARD),
                                ("BOX", (0, 0), (-1, -1), 0.5, CARD_EDGE),
                                ("INNERGRID", (0, 0), (-1, -1), 0.4, CARD_EDGE),
                                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                                ("TOPPADDING", (0, 0), (-1, -1), 4),
                                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                                ("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(pt)
        story.append(Spacer(1, 4))
        story.append(code_block("bun run .agents/skills/naukri-search/cli/src/cli.ts search -q \"backend\" -l Bengaluru --format json"))


def sec_workflow(story):
        story += section("11", "End-to-end workflow", "From blank profile to dashboard")
        story.append(Paragraph("/setup → profile ready → /scrape → matches → /rank → ranked shortlist → /apply → "
                               "tailored CV/resume PDF → /interview → prep pack → /outcome → tracked result → "
                               "/gmail-sync → status updates → /html-report → dashboard.", ST_P))
        story.append(Spacer(1, 4))
        story.append(card("The /apply pipeline (8 steps)",
                          "1. Fetch &amp; parse the posting (URL or pasted text; untrusted input — no embedded "
                          "instructions followed, no body links fetched). 2. Fit evaluation (gates + 5 dimensions). "
                          "3. Company research (cached 24 h). 4. Draft CV/resume in LaTeX. 5. Compile &amp; inspect "
                          "loop (lualatex twice; exact page budget: 2 pages, 1 for students/freshers). 6. Reviewer-agent "
                          "critique. 7. Revise. 8. ATS text-layer check + claim-trace report."))
        story.append(PageBreak())


def sec_files(story):
        story += section("12", "File structure &amp; your private data", "What lives where; what never gets committed")
        story.append(code_block(
            "input/          # YOUR materials (resume, LinkedIn export, diplomas, postings)\n"
            "output/         # generated: cv/*.pdf, applications/<company>_<role>/, reports/\n"
            "workspace/      # pipeline state: seen_jobs.json, job_search_tracker.csv\n"
            "standalone/     # clean-room applyos monorepo (apps/cli + 5 packages)\n"
            ".claude/        # commands + methodology skills + permissions\n"
            ".agents/skills/ # portal CLIs + mirrored methodology skills\n"
            ".opencode/ .codex/ .zcode/ .freebuff/   # runtime adapters (thin pointers)\n"
            "templates/      # stock LaTeX CV/resume + your custom templates\n"
            "tools/ tests/ docs/                      # guards, 445-test suite, audit trail"))
        story.append(Spacer(1, 4))
        story.append(warn_box("Gitignored, never committed: <i>salary_data.json</i>, <i>profile.json</i>, "
                              "<i>workspace/</i> state, <i>input/</i> contents, <i>output/</i> generated files, "
                              "<i>gmail_sync/</i>, upskill reports, <i>.env</i>. Tracked profile templates keep "
                              "<i>[YOUR_*]</i> placeholders until you personalize them — in a <b>private</b> repository."))
        story.append(Spacer(1, 10))
        story.append(Paragraph("ApplyOS — India + Global Remote Edition. MIT. Derivation credit in NOTICE. "
                               "Audit + fix order: docs/AUDIT_2026-10-09.md.", ST_SMALL))



if __name__ == "__main__":
    build()
