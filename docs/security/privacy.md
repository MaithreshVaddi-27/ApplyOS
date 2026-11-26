# Privacy: data-flow inventory

> Phase 11. This table says exactly what leaves the machine and what does not. The last two rows are
> the honest ones: ApplyOS cannot prevent them, so it documents them.

| Path / flow | Contains | Leaves the machine? | Enforcement |
|---|---|---|---|
| `input/**` | CV, LinkedIn export, diplomas, references | **No** | `.gitignore` + `tools/security_guards.py` |
| `output/cv/**` | Tailored documents and PDFs | **No** | `.gitignore` + guard |
| `output/applications/**` | Application archives, outcome files, posting text | **No** | `.gitignore` + guard |
| `output/reports/**` | Generated HTML dashboards | **No** | `.gitignore` + guard |
| `workspace/**` | Seen store, tracker, sync state | **No** | `.gitignore` + guard |
| `salary_data.json` | Salary benchmarks | **No** | `.gitignore` + guard |
| `.claude/skills/job-application-assistant/01–09*.md` | The candidate profile | **No network call sends these** | Tracked by design; candidate must use a private repo |
| `output/research/*.md` (`.json` in current specs) | Search-result notes | **No** | **Tracked** — the candidate must keep them free of personal data; `/apply`'s researcher writes only public company facts |
| `/notion-sync` | **Filenames only** (CV names), never document bodies | **Yes — filenames** | One-way; the candidate opts in; the command never edits repo files |
| `/gmail-sync` | Email subjects, matched by the candidate's own binding | **Yes — to the model provider in context** | Batch approval before any write; the tracker is the source of truth |
| Job boards | The search query and the honest User-Agent | **Yes** | Unavoidable; queries are generic, never profile text |
| The model provider | Whatever the agent has in its context | **Yes** | Outside ApplyOS's control; the candidate's provider policy applies |

## What is never sent

- The full profile text is never used as a search query. `/scrape` derives generic queries from the
  stage and target roles.
- No document body is uploaded by any command. `/notion-sync` creates a page whose content is the
  shortlist and filenames; it does not read a CV into Notion.
- No telemetry, no analytics, no crash reporting. There is no server, no port, and no background
  process. `applyos doctor --check-remote` is the only flag that reaches a non-board service
  (GitHub, to ask whether `origin` is public), and it is opt-in.

## The candidate's responsibility

The framework runs in a private repository. `README.md` and `/setup` say so at onboarding because
the profile files are tracked: a public fork with a personalised profile publishes it. This is a
warning, not a technical block — the reason is recorded in `docs/security/threat-model.md` under
Residual risk 3.

A candidate who accepts a model provider's privacy policy accepts that the provider sees their
context. ApplyOS cannot change that and does not claim otherwise.
