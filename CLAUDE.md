# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commonly Used Commands

### Setup and Onboarding
- `/setup` - Initialize your profile (interactive setup for candidate information)
- `/reset` - Clear profile data or documents (use with caution)

### Job Search Workflow
- `/scrape` - Search multiple job portals for positions matching your profile
- `/rank` - Batch-score scraped postings against fit framework to get ranked shortlist (now includes staleness flags for postings >30 days old)
- `/apply <URL>` - Run full workflow: evaluate fit, draft a tailored CV, review, revise, and present final output
  - Can also accept raw job description text: `/apply <paste job description>`
- `/expand` - Enrich profile by scanning public sources (GitHub, portfolio, etc.) for competencies
- `/upskill` - Analyze skill gaps between profile and job postings, generate learning plan

### Application Management
- `/outcome` - Record application results (interviews, offers, rejections), archive materials
- `/outcome followup` - Surface quiet applications and draft follow-up messages
- `/interview` - Prepare for scheduled interviews with stage-specific prep packs
- `/gmail-sync` - Auto-detect application status from Gmail (approved changes only)

### Reporting and Extensions
- `/html-report` - Generate self-contained HTML dashboard from application tracker
- `/notion-sync` - Publish pipeline view to Notion database (one-way sync)
- `/add-template` - Register a custom CV LaTeX/Templating toolchain
- `/add-portal` - Generate job-portal search skill for new job boards

## Where the India guidance lives

India-market behavior executes in the skill and command specs, not here — this file stays lean so every agent turn doesn't pay for it twice:
/scrape/ — Stage Profile, portal sets, and referral-first contact links in .claude/skills/job-scraper/ (search-queries.md, SKILL.md)
/rank/ — per-stage weights and the stage-conditional gates (Stipend, Batch, Bond, Notice-Period, CTC, Timezone) in 04-job-evaluation.md + .claude/commands/rank.md
/apply/ — 1-page student/fresher CVs, project-led experience, +91/City-State conventions, and the fixed English + professional-font policy in 05-cv-templates.md
/outcome/ — 7-day follow-up cadence + WhatsApp short-form drafts in .claude/commands/outcome.md
/gmail-sync/ — shortlist-advances / views-are-noise classification in .claude/commands/gmail-sync.md
/upskill/ — NPTEL/GeeksforGeeks/free-option mapping in .claude/skills/upskill/SKILL.md
/html-report/ — portal-yield table in .claude/commands/html-report.md
Salary data — copy salary_data.example.json to salary_data.json; setup in tools/README_SALARY_TOOL.md

### Developer Experience Notes

There are no `/skill-create`, `/skill-update`, `/skill-test`, or `/debug` commands in this
repository - earlier revisions of this file listed them, which misled agents into citing
capabilities that do not exist. The real extension paths are `/add-portal` (new job board),
`/add-template` (custom CV/letter toolchain), and `/setup` (profile). Feature ideas are tracked
in [docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md), not as phantom commands here. The same applies
to flag-shaped ideas that were proposed but never built (`/scrape --save-profile`,
`/outcome followup --stage`, `/html-report --insights`, `/upskill --market-trends`,
`/interview --company-specific` / `--role-play`): they do not exist — do not cite them. Diagnostics:
`/scrape health <portal>` probes portal CLIs; `bun test` inside a skill's `cli/` runs its suite;
`python tools/lint_skills.py` and `python tools/security_guards.py` guard the repo.

## Documentation Map

| Document | Contents |
|---|---|
| [docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md) | The working refactor roadmap: audit findings, upgrade/degrade lists, phases, pending tasks |
| [docs/COMPANY_PORTAL_SCRAPER.md](docs/COMPANY_PORTAL_SCRAPER.md) | Company-career-portal scraper: verified endpoints, seeds, build guide, usage, verification log |
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Historical status of the first India-market upgrade pass (verified-work snapshot) |
| [CHANGELOG.md](CHANGELOG.md) | Release notes; `[Unreleased]` carries the latest changes |
| [SETUP.md](SETUP.md) | Install and onboarding walkthrough |
| [SECURITY.md](SECURITY.md) | Untrusted-content and supply-chain posture |

## Maintenance and Updates

### Keeping Current
1. **Regular skill updates**:
   ```
   # Update all job search skills to latest versions
   for skill in .agents/skills/*/cli; do (cd $skill && bun install); done
   ```

2. **Framework version tracking**:
   - Monitor `framework_version` markers in skill files
   - Use `python tools/check_framework_version.py` to detect version mismatches
   - Read CHANGELOG.md for detailed update notes

3. **Contributing improvements**:
   - Follow CONTRIBUTING.md guidelines for submitting new job portal skills
   - Ensure new skills meet zero-runtime-dependency requirement and include comprehensive tests
   - Market-specific behavior belongs in the skill or command spec that executes it, not in this file