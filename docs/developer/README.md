# Developer Guide

| Document | Contents |
|---|---|
| [getting-started.md](./getting-started.md) | Clone → install → verify → first search |
| [contributing.md](./contributing.md) | The contribution bar, the workflow, the review criteria |
| [adding-a-portal.md](./adding-a-portal.md) | The portal-skill contract, end to end |
| [writing-a-command.md](./writing-a-command.md) | How to write a workflow spec an agent can execute |
| [glossary.md](./glossary.md) | The shared vocabulary |

## Five minutes

If you want to see the project working before reading anything else:

```bash
git clone https://github.com/MaithreshVaddi-27/ApplyOS.git
cd ApplyOS
./scripts/bootstrap.sh          # or scripts/bootstrap.ps1 on Windows
applyos doctor                  # what is installed, what is missing
python -m unittest discover -s tests -t .
```

`scripts/bootstrap.*` lands in Phase 1. Until then, the manual equivalent is:

```bash
cd applyos && bun install --frozen-lockfile && cd ..
for d in .agents/skills/*/cli; do (cd "$d" && bun install); done
```

## The five-minute orientation

| If you want to… | Read |
|---|---|
| Understand what the project does | [../architecture/current-state.md](../architecture/current-state.md) |
| Understand the design | [../architecture/target-architecture.md](../architecture/target-architecture.md) |
| Know why a thing is the way it is | [../DECISION_LOG.md](../DECISION_LOG.md) |
| Know what is real vs. planned | [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) |
| Know what to work on next | [../roadmap/master-roadmap.md](../roadmap/master-roadmap.md) |

## The three rules that matter most

1. **The markdown specs are the implementation.** `.claude/` holds them. Every other runtime
   points at them. A second copy is a defect.
2. **Never fabricate.** A field the source did not state is `null`. A gap is reported, not stuffed.
   A number without a measurement does not appear.
3. **Local-first.** Personal data never leaves the machine. CI enforces it.

---

## Runtime support

| Runtime | How it loads ApplyOS |
|---|---|
| **OpenCode** (reference) | `AGENTS.md` + `opencode.json` + `.opencode/command/*.md` |
| **Claude Code** | `CLAUDE.md` + `.claude/` native + `.claude/settings.json` |
| **Codex CLI** | `AGENTS.md` routing table + `.codex/agents/*.toml` |
| **Antigravity** | `AGENTS.md` + `.agents/skills/` auto-discovery |
| **ZCode** | `AGENTS.md` routing table |
| **FreeBuff / any** | `AGENTS.md` |

Every runtime reaches the same canonical specs. See ADR-0002 for why.

---

## Where things live

| Path | Purpose |
|---|---|
| `.claude/commands/*.md` | The 12 workflow specs — **canonical** |
| `.claude/skills/*/SKILL.md` | The 9 methodology skills — **canonical** |
| `.claude/skills/job-scraper/SKILL.md` | The `/scrape` spec |
| `.agents/skills/*-search/cli/` | The 12 provider CLIs |
| `.agents/skills/cli-shared/src/` | Shared CLI plumbing |
| `.opencode/`, `.codex/` | Thin-pointer adapters |
| `applyos/` | The Bun/TypeScript engine |
| `tools/` | The Python tooling |
| `templates/cv-stock/` | The stock LaTeX templates |
| `tests/` | The Python test suite |
| `docs/` | This blueprint and the prior audits |
| `input/`, `output/`, `workspace/` | **Personal data. Gitignored. Never commit.** |

---

## Before you open a pull request

```
python tools/lint_skills.py
python tools/security_guards.py
python -m unittest discover -s tests -t .
cd applyos && bun run test && bun run --filter "*" typecheck && cd ..
cd .agents/skills/<your-cli> && bun run typecheck && bun run test
```

Then check [../CHANGE_IMPACT_MATRIX.md](../CHANGE_IMPACT_MATRIX.md) for everything your change
touches, and [contributing.md](./contributing.md) for what gets merged and what does not.
