#!/usr/bin/env python3
"""Supply-chain guards for the template's riskiest surfaces.

Run from anywhere: python tools/security_guards.py

This repo ships pre-approved Claude Code permissions and CLI code that every
fork user executes. These guards make the dangerous changes LOUD, not
impossible: a PR that intentionally needs one of them must update the
allowlists in this file in the same diff, so the change is explicit and
reviewable rather than buried.

Checks:
1. .claude/settings.json — every permissions.allow entry must be in the exact
   allowlist below. Catches permission widening (e.g. Bash(*), Bash(curl:*)),
   which would auto-approve commands on every fork. The same file's `hooks`
   key is held to an allowlist too: a hook runs automatically when its event
   fires, with no prompt, so it is strictly more dangerous than a pre-approved
   permission.
2. .gitignore — the personal-data ignore rules must all still be present,
   and no un-allowlisted negation (!pattern) may re-include them. Catches
   weakening that would make future users silently commit their tracker,
   profile exports, or application archives.
3. .agents/**/package.json — no npm/bun lifecycle scripts (preinstall,
   install, postinstall, prepare, prepack) and no trustedDependencies.
   Catches code execution smuggled into `bun install`.

Stdlib only. Exit 0 on success, 1 with a failure list otherwise.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors: list[str] = []

# The exact permission entries the template ships. A PR that adds or changes
# an entry must add it here too - that is the point: the diff shows both.
ALLOWED_PERMISSIONS = {
    "Skill(job-application-assistant)",
    # Narrowed from the upstream template's blanket Bash(bun run:*), which
    # pre-approved `bun run <any file>`. One entry per shipped portal CLI,
    # matching what each SKILL.md already declares in its allowed-tools.
    # A portal added by /add-portal needs its own entry here and in
    # .claude/settings.json - that review step is the point.
    # This fork ships the India + global-remote portal set; the upstream
    # Danish portals (jobbank/jobdanmark/jobindex/jobnet) do not exist here,
    # so their entries are intentionally absent.
    "Bash(bun run .agents/skills/linkedin-search/cli/src/cli.ts:*)",
    "Bash(bun run .agents/skills/freehire-search/cli/src/cli.ts:*)",
    "Bash(bun run .agents/skills/naukri-search/cli/src/cli.ts:*)",
    "Bash(bun run .agents/skills/internshala-search/cli/src/cli.ts:*)",
    "Bash(bun run .agents/skills/unstop-search/cli/src/cli.ts:*)",
    "Bash(bun run .agents/skills/wellfound-search/cli/src/cli.ts:*)",
    "Bash(bun run .agents/skills/wayup-search/cli/src/cli.ts:*)",
    "Bash(bun run .agents/skills/remoteok-search/cli/src/cli.ts:*)",
    "Bash(bun run .agents/skills/remotive-search/cli/src/cli.ts:*)",
    "Bash(bun run .agents/skills/weworkremotely-search/cli/src/cli.ts:*)",
    # careers-search: company career portals (amazon.jobs, Greenhouse, Lever,
    # SmartRecruiters, Workday CXS). See docs/COMPANY_PORTAL_SCRAPER.md.
    "Bash(bun run .agents/skills/careers-search/cli/src/cli.ts:*)",
    # cutshort-search: Cutshort public server-rendered listing pages
    # (India fresher-to-3yr startup band). See the skill's url-reference.md.
    "Bash(bun run .agents/skills/cutshort-search/cli/src/cli.ts:*)",
    "Bash(python salary_lookup.py:*)",
    "Bash(python3 salary_lookup.py:*)",
    "Bash(python tools/rank_state.py:*)",
    "Bash(python3 tools/rank_state.py:*)",
    "Bash(python tools/verify_pdf.py:*)",
    "Bash(python3 tools/verify_pdf.py:*)",
    "Bash(pdftotext:*)",
    "Bash(pdfinfo:*)",
    # robots_check: the 09-web-research skill orders `python3 tools/robots_check.py`
    # before any browser-header curl retry (T9). Same pre-approval pattern as the
    # other workflow tools above.
    "Bash(python tools/robots_check.py:*)",
    "Bash(python3 tools/robots_check.py:*)",
}

# Personal-data ignore rules that must never disappear from .gitignore.
REQUIRED_IGNORE_RULES = [
    "salary_data.json",
    # Candidate profiles for `applyos apply --profile <file>`: name, contact
    # details, employment history. Depth-independent twin included for the
    # skill-directory-as-cwd case, like the workspace rules below.
    "profile.json",
    "**/profile.json",
    # Depth-independent belt-and-braces for the workspace state files: the
    # specs pin them at the repo root (workspace/), but an agent that ran with
    # a skill directory as cwd would create workspace/ there, where a
    # repo-rooted rule silently fails to match.
    "**/workspace/seen_jobs.json",
    "**/workspace/notion_sync.json",
    "**/workspace/*.md",
    "*_BehavioralReport.pdf",
    "linkedin_Profile.pdf",
    # Generated CV/resume artifacts (/apply step 5) land in output/cv/; the
    # stock templates they compile from live in templates/cv-stock/ (tracked).
    # Extension-agnostic: a custom template registered via /add-template (e.g.
    # Typst) writes main_<company>_<role>.typ, ignored just as reliably.
    "output/cv/main_*.*",
    "output/cv/resume_*.*",
    # ATS text extractions (/apply step 5d) carry the CV's full text.
    "output/cv/*.txt",
    "input/cv/**",
    "input/linkedin/**",
    "input/diplomas/**",
    "input/references/**",
    "input/postings/**",
    # Per-application archives: what was submitted, outcomes, /interview prep
    # packs (output/applications/<company>_<role>/).
    "output/applications/**",
    # Belt-and-braces, not the primary guard: nothing writes here.
    "input/interview/**",
    "workspace/job_search_tracker.csv",
    "**/workspace/job_search_tracker.csv",
    "gmail_sync/",
    "/reports/",
    "upskill/*.md",
    # Depth-independent twin of the rule above. The upskill *skill* resolves
    # `upskill/` relative to its own directory, so reports can land at
    # .claude/skills/upskill/upskill/*.md where the rooted rule cannot see
    # them. `**/upskill/*.md` would also ignore the skill's own SKILL.md
    # (the directory shares the name), so the report-file prefix is pinned.
    "**/upskill/report-*.md",
    # Not personal data but the same failure mode: /add-portal can generate a
    # skill for a portal that only returns usable content through a paid
    # fetching service, and that skill reads an API token from the environment.
    ".env",
    ".env.*",
    # Company research cache (/apply Step 3, /interview Step 2). Referenced
    # from commands, not a skill, so a plain rooted rule is correct here.
    # Manual search-result .md notes in output/research stay tracked.
    "output/research/*.json",
    # Framework output root (html-report bundles, upskill reports): everything
    # generated is personal; the .gitkeep placeholders are re-included.
    "output/reports/**",
]

# Negation (re-include) rules the template legitimately ships. .gitignore is
# order-sensitive: a later `!pattern` re-includes a path an earlier rule
# excluded, so a rule can be physically present in REQUIRED_IGNORE_RULES yet
# no longer ignored (e.g. adding `!salary_data.json`). Set membership on the
# required rules cannot see that. Any negation outside this allowlist is a
# failure - add an intentional one here in the same PR, exactly as with
# ALLOWED_PERMISSIONS, so the widening is explicit and reviewable.
ALLOWED_IGNORE_NEGATIONS = {
    "!input/**/.gitkeep",
    "!output/**/.gitkeep",
    "!standalone/bun.lock",
}

# Hook commands the template legitimately ships, as "<Event>:<command>" strings.
# Empty by design - the template ships no hooks at all.
#
# A hook is strictly more dangerous than a permissions.allow entry. A permission
# pre-approves something Claude may choose to do; a hook runs unconditionally when
# its event fires, with no prompt and no model decision in between. Cloning a repo
# and opening it is enough. This is the vector the Shai-Hulud worm used in its
# August 2026 wave, planting a SessionStart hook in .claude/settings.json that
# executed on session start:
# https://research.jfrog.com/post/shai-hulud-is-back-august/
ALLOWED_HOOKS: set[str] = set()

FORBIDDEN_SCRIPTS = {"preinstall", "install", "postinstall", "prepare", "prepack"}


def _hook_commands(event: str, entries: object):
    """Yield "<Event>:<command>" for every command a hook event would run.

    Fails closed: any shape this does not recognise yields a marker that cannot
    be in the allowlist, so an unfamiliar hook layout is rejected rather than
    silently skipped.
    """
    unrecognised = f"{event}:<unrecognised hook shape>"
    if not isinstance(entries, list):
        yield unrecognised
        return
    for entry in entries:
        if not isinstance(entry, dict):
            yield unrecognised
            continue
        inner = entry.get("hooks")
        if not isinstance(inner, list):
            yield unrecognised
            continue
        for hook in inner:
            command = hook.get("command") if isinstance(hook, dict) else None
            yield f"{event}:{command}" if isinstance(command, str) else unrecognised


def check_permissions() -> None:
    path = ROOT / ".claude" / "settings.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f".claude/settings.json: unreadable or invalid JSON: {exc}")
        return
    if not isinstance(data, dict):
        errors.append(".claude/settings.json: top-level JSON value must be an object")
        return

    # Checked before the permissions shape guards below, so a file that pairs a
    # malformed permissions block with a hook cannot return early and skip this.
    hooks = data.get("hooks", {})
    if hooks:
        if not isinstance(hooks, dict):
            errors.append(".claude/settings.json: hooks must be an object")
        else:
            for event, entries in hooks.items():
                for command in _hook_commands(str(event), entries):
                    if command not in ALLOWED_HOOKS:
                        errors.append(
                            f".claude/settings.json: hook not in the reviewed allowlist: "
                            f"{command!r}. A hook runs automatically when its event fires - it "
                            "is never gated by the permissions prompt, so it executes on every "
                            "fork without the user agreeing to anything. If this hook is "
                            "intentional, add it to ALLOWED_HOOKS in tools/security_guards.py "
                            "in the same PR so the addition is explicit and reviewable."
                        )

    permissions = data.get("permissions", {})
    if not isinstance(permissions, dict):
        errors.append(".claude/settings.json: permissions must be an object")
        return
    allow = permissions.get("allow", [])
    if not isinstance(allow, list) or not all(isinstance(entry, str) for entry in allow):
        errors.append(".claude/settings.json: permissions.allow must be a list of strings")
        return
    for entry in allow:
        if entry not in ALLOWED_PERMISSIONS:
            errors.append(
                f".claude/settings.json: permission not in the reviewed allowlist: {entry!r}. "
                "Pre-approved permissions run without prompting on every fork. If this entry is "
                "intentional, add it to ALLOWED_PERMISSIONS in tools/security_guards.py in the "
                "same PR so the widening is explicit and reviewable."
            )
    for entry in ALLOWED_PERMISSIONS - set(allow):
        # Not an error: settings may legitimately drop an entry. But an
        # allowlist entry that no longer exists should be pruned.
        print(f"note: allowlisted permission not present in settings.json: {entry!r}")


def check_gitignore() -> None:
    path = ROOT / ".gitignore"
    try:
        lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]
    except OSError as exc:
        errors.append(f".gitignore: unreadable: {exc}")
        return
    rules = set(lines)
    for rule in REQUIRED_IGNORE_RULES:
        if rule not in rules:
            errors.append(
                f".gitignore: required personal-data rule missing: {rule!r}. "
                "These rules keep fork users from committing personal data. If the rule moved "
                "or was renamed intentionally, update REQUIRED_IGNORE_RULES in "
                "tools/security_guards.py in the same PR."
            )
    for line in lines:
        if line.startswith("!") and line not in ALLOWED_IGNORE_NEGATIONS:
            errors.append(
                f".gitignore: negation rule not in the reviewed allowlist: {line!r}. "
                "A negation re-includes a path an earlier rule excluded and can silently "
                "re-expose personal data (a required ignore rule stays present but stops "
                "taking effect). If this negation is intentional, add it to "
                "ALLOWED_IGNORE_NEGATIONS in tools/security_guards.py in the same PR."
            )


def check_package_manifests() -> None:
    manifests = [
        p for p in ROOT.glob(".agents/**/package.json") if "node_modules" not in p.parts
    ]
    if not manifests:
        errors.append(".agents: no package.json files found - glob roots are wrong or the tree moved")
    for manifest in manifests:
        relpath = manifest.relative_to(ROOT)
        try:
            data = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{relpath}: unreadable or invalid JSON: {exc}")
            continue
        if not isinstance(data, dict):
            errors.append(f"{relpath}: top-level JSON value must be an object")
            continue
        scripts = data.get("scripts", {})
        if not isinstance(scripts, dict):
            errors.append(f"{relpath}: scripts must be an object")
            continue
        bad = FORBIDDEN_SCRIPTS & set(scripts)
        if bad:
            errors.append(
                f"{relpath}: lifecycle script(s) {sorted(bad)} are forbidden - they execute "
                "arbitrary code during `bun install` on every fork user's machine."
            )
        if "trustedDependencies" in data:
            errors.append(
                f"{relpath}: trustedDependencies is forbidden - it re-enables dependency "
                "lifecycle scripts that bun blocks by default."
            )


def _opencode_blanket_allow(rules: list) -> bool:
    """True when any rule blanket-allows shell (resource "*" + effect "allow")."""
    return any(
        isinstance(rule, dict)
        and rule.get("action") == "shell"
        and rule.get("resource") == "*"
        and rule.get("effect") == "allow"
        for rule in rules
    )


def _settings_entry_covered(entry: str, allow_resources: list[str]) -> bool:
    # "Bash(<inner>:*)" -> inner; match by tool token or portal glob.
    inner = entry[5:-3] if entry.startswith("Bash(") and entry.endswith(":*)") else entry
    for res in allow_resources:
        if "bun run .agents/skills/*" in res and "bun run .agents/skills/" in inner:
            return True
        # Tool token: compare the program path before any args.
        token = inner.split()[0] if inner.split() else inner
        if token and token in res:
            return True
    return False


def check_opencode() -> None:
    """Pin opencode.json (reference runtime) against .claude/settings.json drift.

    T1: security_guards never read opencode.json, so a glob-vs-per-portal edit
    in one file silently diverged from the other. This fails closed when:
    - opencode.json blanket-allows shell (resource "*" + effect "allow"), or
    - a Bash(...) entry in .claude/settings.json has no covering opencode rule.
    Coverage is substring-based: an opencode resource covers a settings entry
    when the entry's tool path (e.g. "tools/verify_pdf.py", "pdftotext") appears
    in the resource, or the resource is the portal glob
    "bun run .agents/skills/*".
    """
    oc_path = ROOT / "opencode.json"
    st_path = ROOT / ".claude" / "settings.json"
    try:
        oc_data = json.loads(oc_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"opencode.json: unreadable or invalid JSON: {exc}")
        return
    try:
        st_data = json.loads(st_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f".claude/settings.json: unreadable or invalid JSON: {exc}")
        return
    if not isinstance(oc_data, dict):
        errors.append("opencode.json: top-level JSON value must be an object")
        return
    rules = oc_data.get("permissions", [])
    if not isinstance(rules, list):
        errors.append("opencode.json: permissions must be a list")
        return
    if _opencode_blanket_allow(rules):
        errors.append(
            "opencode.json: blanket shell allow (resource \"*\") is forbidden. "
            "Pre-approved shell must stay scoped to portal CLIs + workflow tools."
        )
    allow_resources = [
        str(r.get("resource", "")) for r in rules
        if isinstance(r, dict) and r.get("effect") == "allow"
    ]
    allow = ((st_data.get("permissions", {}) or {}).get("allow", [])) \
        if isinstance(st_data, dict) else []
    # Non-dict settings shapes are already reported by check_permissions();
    # parity has nothing to compare here, so skip quietly (no traceback).
    if isinstance(allow, list):
        for entry in allow:
            if isinstance(entry, str) and entry.startswith("Bash(") \
                    and not _settings_entry_covered(entry, allow_resources):
                errors.append(
                    f"opencode.json: no allow rule covers .claude/settings.json entry {entry!r}. "
                    "Keep the reference runtime's allowlist in sync with Claude Code's."
                )


def main() -> int:
    check_permissions()
    check_opencode()
    check_gitignore()
    check_package_manifests()
    if errors:
        print(f"security_guards: {len(errors)} failure(s)")
        for err in errors:
            print(f"  - {err}")
        return 1
    print(
        "security_guards: OK (permissions allowlist, opencode parity, hooks allowlist, "
        "gitignore rules, package manifests)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
