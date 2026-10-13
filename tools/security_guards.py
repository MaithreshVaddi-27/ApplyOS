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
import re
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
    # Depth-independent twins (T-M2): an agent run with a skill directory as
    # cwd writes output/ there, where the rooted rules silently fail to match.
    "**/output/cv/main_*.*",
    "**/output/cv/resume_*.*",
    # ATS text extractions (/apply step 5d) carry the CV's full text.
    "output/cv/*.txt",
    "**/output/cv/*.txt",
    "input/cv/**",
    "input/linkedin/**",
    "input/diplomas/**",
    "input/references/**",
    "input/postings/**",
    # Depth-independent twins (T-M2): same cwd hazard as output/ above.
    "**/input/cv/**",
    "**/input/linkedin/**",
    "**/input/diplomas/**",
    "**/input/references/**",
    "**/input/postings/**",
    # Per-application archives: what was submitted, outcomes, /interview prep
    # packs (output/applications/<company>_<role>/).
    "output/applications/**",
    "**/output/applications/**",
    # Belt-and-braces, not the primary guard: nothing writes here.
    "input/interview/**",
    "**/input/interview/**",
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
    # Company research cache (/apply Step 3, /interview Step 2). Shareable
    # search-result .md notes in output/research stay tracked; only the cache
    # JSON is personal. Depth-independent twin (T-M2): same cwd hazard.
    "output/research/*.json",
    "**/output/research/*.json",
    # Framework output root (html-report bundles, upskill reports): everything
    # generated is personal; the .gitkeep placeholders are re-included.
    "output/reports/**",
    "**/output/reports/**",
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
    "!applyos/bun.lock",
    "!docs/ApplyOS-setup-guide.pdf",
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

# Permission modes that suppress the prompt entirely. The template ships none;
# any of them makes every allowlist entry above moot, because nothing is gated.
FORBIDDEN_PERMISSION_MODES = {
    "bypassPermissions",
    "bypasspermissions",
    "acceptEdits",
    "acceptedits",
    "dangerouslySkipPermissions",
}

# Every package.json the repo can install from. `.agents/**` was the original
# scope, but `applyos/` is a second install surface with its own tracked
# lockfile, so a lifecycle script there executes just the same.
MANIFEST_ROOTS = (".agents", "applyos")


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
    # Claude Code merges settings.local.json alongside settings.json, so a hook
    # or a pre-approved permission planted there is exactly as live as one in
    # the tracked file. The template ships neither; both are held to the same
    # allowlists.
    for relpath in (".claude/settings.json", ".claude/settings.local.json"):
        path = ROOT / relpath
        if not path.exists():
            continue
        _check_one_settings(path, relpath)


def _check_one_settings(path, relpath: str) -> None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"{relpath}: unreadable or invalid JSON: {exc}")
        return
    if not isinstance(data, dict):
        errors.append(f"{relpath}: top-level JSON value must be an object")
        return

    # Checked before the permissions shape guards below, so a file that pairs a
    # malformed permissions block with a hook cannot return early and skip this.
    hooks = data.get("hooks", {})
    if hooks:
        if not isinstance(hooks, dict):
            errors.append(f"{relpath}: hooks must be an object")
        else:
            for event, entries in hooks.items():
                for command in _hook_commands(str(event), entries):
                    if command not in ALLOWED_HOOKS:
                        errors.append(
                            f"{relpath}: hook not in the reviewed allowlist: "
                            f"{command!r}. A hook runs automatically when its event fires - it "
                            "is never gated by the permissions prompt, so it executes on every "
                            "fork without the user agreeing to anything. If this hook is "
                            "intentional, add it to ALLOWED_HOOKS in tools/security_guards.py "
                            "in the same PR so the addition is explicit and reviewable."
                        )

    permissions = data.get("permissions", {})
    if not isinstance(permissions, dict):
        errors.append(f"{relpath}: permissions must be an object")
        return
    # A defaultMode overrides the whole permission system, which makes every
    # allowlist entry moot: nothing prompts, so nothing is gated. Checking only
    # `allow` would miss it entirely.
    default_mode = permissions.get("defaultMode")
    if default_mode is not None:
        if not isinstance(default_mode, str):
            errors.append(
                f"{relpath}: permissions.defaultMode must be a string"
            )
        elif default_mode in FORBIDDEN_PERMISSION_MODES:
            errors.append(
                f"{relpath}: permissions.defaultMode {default_mode!r} is forbidden - it "
                "suppresses the permission prompt, so every pre-approved entry below (and every "
                "command not in it) runs unprompted on every fork. The template ships no "
                "defaultMode; remove it."
            )
    allow = permissions.get("allow", [])
    if not isinstance(allow, list) or not all(isinstance(entry, str) for entry in allow):
        errors.append(f"{relpath}: permissions.allow must be a list of strings")
        return
    for entry in allow:
        if entry not in ALLOWED_PERMISSIONS:
            errors.append(
                f"{relpath}: permission not in the reviewed allowlist: {entry!r}. "
                "Pre-approved permissions run without prompting on every fork. If this entry is "
                "intentional, add it to ALLOWED_PERMISSIONS in tools/security_guards.py in the "
                "same PR so the widening is explicit and reviewable."
            )
    if relpath == ".claude/settings.json":
        for entry in ALLOWED_PERMISSIONS - set(allow):
            # Not an error: settings may legitimately drop an entry. But an
            # allowlist entry that no longer exists should be pruned.
            print(f"note: allowlisted permission not present in settings.json: {entry!r}")


def _iter_gitignores() -> list[Path]:
    """Every .gitignore git would actually consult, root first.

    Reading only the root file was defeatable: git gives a nested .gitignore
    precedence for its directory, so two lines in output/.gitignore could
    re-include a compiled CV that the root rule still lists - the required rule
    stayed present while ceasing to protect anything, and the guard reported OK.
    """
    found = [ROOT / ".gitignore"]
    for path in ROOT.rglob(".gitignore"):
        parts = path.relative_to(ROOT).parts
        if ".git" in parts or "node_modules" in parts:
            continue
        found.append(path)
    return found


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
    # A nested ignore file can override the root rules for its own subtree, so
    # every one of them is held to the same reviewed-negation list.
    for nested in _iter_gitignores():
        if nested == path:
            continue
        rel = nested.relative_to(ROOT).as_posix()
        try:
            nested_lines = [
                line.strip() for line in nested.read_text(encoding="utf-8").splitlines()
            ]
        except OSError as exc:
            errors.append(f"{rel}: unreadable: {exc}")
            continue
        for line in nested_lines:
            if line.startswith("!") and line not in ALLOWED_IGNORE_NEGATIONS:
                errors.append(
                    f"{rel}: negation rule not in the reviewed allowlist: {line!r}. "
                    "Git gives a nested .gitignore precedence for its directory, so a negation "
                    "here re-includes personal data that the root rules exclude - while those "
                    "rules stay present and this guard still passes. If this negation is "
                    "intentional, add it to ALLOWED_IGNORE_NEGATIONS in "
                    "tools/security_guards.py in the same PR."
                )


def check_package_manifests() -> None:
    manifests: list[Path] = []
    for sub in MANIFEST_ROOTS:
        manifests += [
            p for p in (ROOT / sub).glob("**/package.json") if "node_modules" not in p.parts
        ]
    if not manifests:
        errors.append(
            f"{' / '.join(MANIFEST_ROOTS)}: no package.json files found - glob roots are "
            "wrong or the tree moved"
        )
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


# Programs that can execute arbitrary code given only a "*". A wildcard on one
# of these pre-approves every script on the machine; a wildcard on a leaf binary
# ("pdftotext *") cannot, so those stay legal.
CODE_EXECUTING_PROGRAMS = {
    "bash", "bun", "cmd", "deno", "eval", "node", "npx", "npm", "osascript",
    "perl", "php", "powershell", "python", "python3", "ruby", "sh", "ssh",
    "uv", "uvx", "wget", "curl", "zsh",
}


def _blanket_shell_resource(resource: str) -> bool:
    """True when a shell resource grants a whole code-executing program.

    `resource == "*"` is the crudest case. "<program> *" is just as dangerous
    when <program> is an interpreter: "bun *" or "python *" pre-approves running
    *any* script, which is exactly the widening the per-portal allowlist exists
    to prevent. "<program> <path> *" ("bun run .agents/.../cli.ts *") names the
    script and stays legal, as does a leaf binary like "pdftotext *".
    """
    stripped = resource.strip()
    if stripped == "*":
        return True
    match = re.fullmatch(r"([^\s]+) \*", stripped)
    return bool(match) and match.group(1).lower() in CODE_EXECUTING_PROGRAMS


def _opencode_blanket_allow(rules: list) -> bool:
    """True when any rule grants an action wholesale.

    `resource == "*"` is blanket for every action - an `edit: "*"` pre-approves
    writing any file on the machine, so the check must not be limited to shell.
    A wildcard on a code-executing program is blanket for shell for the same
    reason `bun *` is.
    """
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        resource = str(rule.get("resource", ""))
        if resource.strip() == "*":
            return True
        if rule.get("action") == "shell" and _blanket_shell_resource(resource):
            return True
    return False


def _settings_entry_covered(entry: str, allow_resources: list[str]) -> bool:
    # "Bash(<inner>:*)" -> inner. The whole <inner> must appear in the resource,
    # not just the leading program token: matching on "bun" alone would let a
    # single "bun *" rule cover every per-portal entry it is meant to replace.
    inner = entry[5:-3] if entry.startswith("Bash(") and entry.endswith(":*)") else entry
    inner = inner.strip()
    if not inner:
        return False
    for res in allow_resources:
        if inner in res:
            return True
    return False


def check_opencode() -> None:
    """Pin opencode.json (reference runtime) against .claude/settings.json drift.

    T1: security_guards never read opencode.json, so a glob-vs-per-portal edit
    in one file silently diverged from the other. This fails closed when:
    - opencode.json contains any wildcard shell resource ("*"), any effect, or
    - opencode.json uses the portal glob "bun run .agents/skills/*", or
    - a Bash(...) entry in .claude/settings.json has no covering opencode rule, or
    - an allow rule in opencode.json has no covering settings.json entry (T-M3).
    Coverage is token-based: an opencode resource covers a settings entry
    when the entry's tool path (e.g. "tools/verify_pdf.py", "pdftotext",
    "bun run .agents/skills/<portal>/cli/src/cli.ts") appears in the resource.
    Per-portal entries mirror .claude/settings.json exactly - no globs.
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
            "opencode.json: a blanket grant is forbidden (any effect). That means a resource "
            "of \"*\" for any action (an `edit: \"*\"` pre-approves writing any file), or a "
            "shell wildcard on a code-executing program (\"bun *\" / \"python *\" / \"node *\" "
            "...), which pre-approves running any script. Name the target instead: "
            "\"bun run <cli> *\" for a portal, \"pdftotext *\" for a leaf binary."
        )
    for res in (
        str(r.get("resource", "")) for r in rules if isinstance(r, dict)
    ):
        if ".agents/skills/*" in res:
            errors.append(
                "opencode.json: portal glob \"bun run .agents/skills/*\" is forbidden. "
                "List each portal CLI explicitly, mirroring .claude/settings.json."
            )
            break
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
        # T-M3, reverse direction: every allow rule in opencode.json must have
        # a covering entry in settings.json, so a widening on the reference
        # runtime (e.g. {"resource": "curl *", "effect": "allow"}) fails here
        # instead of passing silently.
        settings_entries = [e for e in allow if isinstance(e, str)]
        for rule in rules:
            if not isinstance(rule, dict) or rule.get("effect") != "allow":
                continue
            res = str(rule.get("resource", ""))
            key = res[:-2] if res.endswith(" *") else res
            if key and not any(key in entry for entry in settings_entries):
                errors.append(
                    f"opencode.json: allow rule {res!r} has no covering entry in "
                    ".claude/settings.json. Add the narrow entry there first, or "
                    "drop the rule here."
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
