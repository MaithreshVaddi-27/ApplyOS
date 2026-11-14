#!/usr/bin/env python3
"""Check that the repository's documentation and specs point at things that exist.

Three classes of drift, all of which have happened in this repository:

  1. A Markdown link that does not resolve.
  2. A path named in a command spec that does not exist (the `cd cv` bug:
     the spec still pointed at a directory that a refactor removed).
  3. A tool command a spec invokes that does not exist, or that is not on
     the permission allowlist.

Plus a Mermaid sanity pass, so a diagram with a typo fails in CI instead of
rendering as an error box on a wiki page.

Stdlib only, like every other script in tools/. Exit 0 when clean, 1 when
anything is broken.

Usage:
  python tools/check_links.py [--quiet] [--only links,paths,commands,mermaid]
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Directories whose contents are the repository's own documentation.
DOC_GLOBS = ("docs/**/*.md", "*.md", ".claude/**/*.md", ".agents/**/*.md", ".opencode/**/*.md")

# Spec files: the ones an agent executes. A wrong path here is a wrong
# instruction, which is worse than a wrong link in a wiki page.
SPEC_GLOBS = (".claude/commands/*.md", ".claude/skills/**/*.md")

# Repo roots a path token may start with. Restricting to these keeps prose
# words ("and/or", "read/write") from being read as paths.
PATH_ROOTS = (
    "input", "output", "workspace", "templates", "tools", "applyos",
    ".claude", ".agents", ".opencode", ".codex", ".github", "docs", "tests",
)

# A path-looking token: starts at a word boundary, contains a slash, and is
# made of path characters only. Placeholders (`<company>`) are captured so
# they can be recognised and skipped rather than truncated mid-token.
PATH_TOKEN = re.compile(r"(?<![\w.-])((?:[\w.-]+/)+[\w.*{}<>-]*)")

# A tool invocation a spec makes.
BUN_CLI = re.compile(r"bun\s+run\s+(\.agents/skills/[^\s`'\"]*?/cli/src/cli\.ts)")
PY_TOOL = re.compile(r"\bpython3?\s+(tools/[\w.-]+\.py)")
CURL = re.compile(r"\b(?:curl|wget)\b")

# A `cd` in a spec. The `cd cv` bug (audit finding D-B1) was a bare directory
# name with no slash, so it is invisible to a path-token scan — it needs its
# own check.
CD_PATH = re.compile(r"(?<![\w.-])cd\s+([^\s;&|]+)")

# Files the workflow creates at RUNNING time. They are gitignored, so a fresh
# clone legitimately does not have them, and a spec naming one is correct.
RUNTIME_FILES = frozenset({
    "workspace/job_search_tracker.csv",
    "workspace/seen_jobs.json",
    "workspace/gmail_sync/state.json",
    "workspace/notion_sync.json",
    "salary_data.json",
})

# Directories the workflow writes into at running time. The directory itself
# must exist; the files inside it are created per run.
RUNTIME_DIRS = ("output/cv/", "output/applications/", "output/research/", "output/reports/")

MERMAID_TYPES = (
    "flowchart", "graph", "sequenceDiagram", "classDiagram", "stateDiagram",
    "erDiagram", "journey", "gantt", "mindmap", "timeline", "quadrantChart",
    "pie", "gitGraph", "C4Context", "C4Container", "block-beta",
    "requirementDiagram", "architecture-beta",
)

# GitHub UI paths that look like repository paths but are not files.
GITHUB_UI = ("security/advisories/", "issues/new", "pulls/new")

# Paths that are expected to exist but only after a candidate runs /setup.
# They are gitignored, so a fresh clone has them as .gitkeep placeholders.
RUNTIME_DIRS = ("input", "output", "workspace")


class Finding:
    __slots__ = ("kind", "where", "detail")

    def __init__(self, kind: str, where: str, detail: str):
        self.kind = kind
        self.where = where
        self.detail = detail

    def __str__(self) -> str:
        return f"{self.kind}: {self.where}: {self.detail}"


def repo_files(globs, root=None) -> list:
    root = root or ROOT
    out = []
    for g in globs:
        out.extend(sorted(root.glob(g)))
    # De-duplicate while preserving order.
    seen = set()
    unique = []
    for p in out:
        if p.is_file() and p not in seen:
            seen.add(p)
            unique.append(p)
    return unique


def strip_code(text: str, keep_fences: bool = False) -> str:
    """Remove inline code and fenced code blocks.

    Fenced blocks are kept by default for the path check (a wrong path inside
    a command example is still a wrong path), but inline code is always
    removed so a placeholder like `input/cv/<name>.pdf` is not read as a path.
    """
    if not keep_fences:
        text = re.sub(r"```.*?```", "", text, flags=re.S)
    text = re.sub(r"`[^`\n]*`", "", text)
    return text


def is_ignorable(token: str) -> bool:
    if not token or token.startswith(("http://", "https://", "mailto:")):
        return True
    if any(token.startswith(p) or ("/" + p) in token for p in GITHUB_UI):
        return True
    if token.endswith("/"):
        return False  # a directory reference — checked as a directory
    return False


def check_markdown_links(files, root=None) -> list:
    root = root or ROOT
    findings = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        body = strip_code(text)
        for m in re.finditer(r"\[[^\]]*\]\(([^)\s]+)\)", body):
            target = m.group(1).split("#")[0].strip()
            if not target or target.startswith(("http://", "https://", "mailto:")):
                continue
            if is_ignorable(target):
                continue
            if target.startswith("#"):
                continue
            resolved = (path.parent / target).resolve()
            if not resolved.exists():
                findings.append(Finding("broken-link", str(path.relative_to(root)), target))
    return findings


def check_spec_paths(files, root=None) -> list:
    root = root or ROOT
    findings = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        # Keep fenced blocks: a path inside a command example is still a path.
        body = strip_code(text, keep_fences=True)
        for m in PATH_TOKEN.finditer(body):
            token = m.group(1).rstrip(".,;:!?")
            if not token:
                continue
            # A placeholder, not a literal path: output/cv/main_<company>.tex
            if "<" in token or ">" in token:
                continue
            root_segment = token.split("/", 1)[0]
            if root_segment not in PATH_ROOTS:
                continue
            if token in RUNTIME_FILES:
                continue
            if any(token.startswith(p) for p in RUNTIME_DIRS):
                continue
            last = token.rstrip("/").split("/")[-1]
            has_extension = "." in last
            is_dir_ref = token.endswith("/")
            if not has_extension and not is_dir_ref:
                # Ambiguous prose ("Nice-to-have tools/skills you can learn").
                # Only a token with a file extension, or one that names a
                # directory explicitly, is treated as a path.
                continue
            resolved = (root / token).resolve()
            if resolved.exists():
                continue
            if "*" in token:
                # A glob — check its static prefix instead.
                prefix = token.split("*", 1)[0].rstrip("/")
                if prefix and (root / prefix).exists():
                    continue
            findings.append(Finding("missing-path", str(path.relative_to(root)), token))
    return findings


def check_cd_paths(files, root=None) -> list:
    """Every `cd <path>` in a spec must name a directory that exists.

    This is the check that catches audit finding D-B1: a spec that still
    said `cd cv` after the CV templates moved to `templates/cv-stock/`.
    The candidate would have followed it and hit a "no such directory".
    """
    root = root or ROOT
    findings = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        body = strip_code(text, keep_fences=True)
        for m in CD_PATH.finditer(body):
            target = m.group(1).strip("\"'")
            if not target or target in (".", "..", "-", "~"):
                continue
            if ".." in target.split("/"):
                continue  # a relative parent, not a repository path
            if "$" in target or "%" in target or "<" in target:
                continue  # a variable or a placeholder, not a literal path
            if target.startswith("/") or (len(target) > 1 and target[1] == ":"):
                continue  # an absolute path, outside this repository
            if (root / target).is_dir():
                continue
            findings.append(Finding("missing-cd-path", str(path.relative_to(root)), target))
    return findings


def check_commands(files, root=None) -> list:
    root = root or ROOT
    findings = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        body = strip_code(text, keep_fences=True)
        for m in BUN_CLI.finditer(body):
            cli = m.group(1)
            parts = cli.split("/")
            skill = parts[2] if len(parts) > 2 else ""
            if not skill or skill == "*":
                continue  # a glob, not a specific skill
            if not (root / ".agents" / "skills" / skill).is_dir():
                findings.append(Finding("missing-skill", str(path.relative_to(root)), skill))
        for m in PY_TOOL.finditer(body):
            tool = m.group(1)
            if not (root / tool).is_file():
                findings.append(Finding("missing-tool", str(path.relative_to(root)), tool))
    return findings


def check_mermaid(files, root=None) -> list:
    root = root or ROOT
    findings = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="replace")
        for i, block in enumerate(re.findall(r"```mermaid\n(.*?)```", text, flags=re.S), start=1):
            lines = [ln for ln in block.strip().splitlines() if ln.strip()]
            if not lines:
                findings.append(Finding("mermaid", f"{path.relative_to(root)}#{i}", "empty diagram"))
                continue
            first = lines[0].strip()
            if not first.startswith(MERMAID_TYPES):
                findings.append(Finding("mermaid", f"{path.relative_to(root)}#{i}", f"unknown diagram type: {first[:60]}"))
            for open_c, close_c in (("[", "]"), ("(", ")"), ("{", "}")):
                if block.count(open_c) != block.count(close_c):
                    findings.append(
                        Finding("mermaid", f"{path.relative_to(root)}#{i}",
                                f"unbalanced {open_c}{close_c} in a diagram starting {first[:40]!r}")
                    )
            if block.count('"') % 2:
                findings.append(
                    Finding("mermaid", f"{path.relative_to(root)}#{i}",
                            f"odd number of double quotes in a diagram starting {first[:40]!r}")
                )
    return findings


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="only print the summary")
    parser.add_argument("--only", default="", help="comma-separated subset: links,paths,commands,mermaid")
    args = parser.parse_args(argv)

    only = {s.strip() for s in args.only.split(",") if s.strip()}
    want = lambda name: (not only) or name in only  # noqa: E731

    findings = []
    if want("links"):
        findings += check_markdown_links(repo_files(DOC_GLOBS), ROOT)
    if want("paths"):
        findings += check_spec_paths(repo_files(SPEC_GLOBS), ROOT)
        findings += check_cd_paths(repo_files(SPEC_GLOBS), ROOT)
    if want("commands"):
        findings += check_commands(repo_files(SPEC_GLOBS), ROOT)
    if want("mermaid"):
        findings += check_mermaid(repo_files(DOC_GLOBS), ROOT)

    if not args.quiet:
        for f in findings:
            print(f"::error file={f.where}::{f.kind}: {f.detail}")
    if findings:
        print(f"check_links: FAILED — {len(findings)} problem(s)")
        return 1
    print("check_links: OK (links, spec paths, cd targets, referenced commands, mermaid)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
