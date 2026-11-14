# ApplyOS Documentation

This directory contains project documentation, roadmaps, and technical specifications.

## The engineering blueprint

Start here: **[PROJECT_BLUEPRINT.md](./PROJECT_BLUEPRINT.md)** — the architecture, the decisions,
the twelve-phase roadmap, and the plan for the next implementation step.

| Document | Contents |
|---|---|
| [PROJECT_BLUEPRINT.md](./PROJECT_BLUEPRINT.md) | **Start here.** The master blueprint and the documentation map |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | What is `IMPLEMENTED` vs. `PROPOSED`, verified against the code |
| [DECISION_LOG.md](./DECISION_LOG.md) | Every architectural decision, with a pointer to the full ADR |
| [CHANGE_IMPACT_MATRIX.md](./CHANGE_IMPACT_MATRIX.md) | "If I change X, what else must change?" |
| [OPEN_QUESTIONS.md](./OPEN_QUESTIONS.md) | What is not known, who can answer it, and what it blocks |
| [architecture/](./architecture/README.md) | Current state, target state, system design, ADRs |
| [design/](./design/README.md) | Product requirements, provider SDK, plugin architecture, public API, CLI, UX, file formats |
| [engineering/](./engineering/README.md) | Standards, testing, evaluation, performance |
| [roadmap/](./roadmap/README.md) | Master roadmap, dependencies, risk register |
| [phases/](./phases/README.md) | Twelve detailed implementation plans |
| [security/](./security/README.md) | Threat model, privacy data flows, security testing |
| [developer/](./developer/README.md) | Setup, contribution, portal and command authoring guides, glossary |
| [research/](./research/README.md) | Competitive analysis, technology and ecosystem |

## Prior audits (historical record — not superseded)

- [AUDIT_2026-10-09.md](./AUDIT_2026-10-09.md) — Full re-audit: findings, deletion log, recommended fix order (numeric baseline superseded — see UPGRADES below).
- [UPGRADES_2026-10-11.md](./UPGRADES_2026-10-11.md) — **Start here.** Deep audit with 4 workers: applied cleanups, prioritized upgrades (P0–P2) with file:line evidence, verified dependency targets, folder-structure verdict.
- [COMPANY_PORTAL_SCRAPER.md](./COMPANY_PORTAL_SCRAPER.md) — The company-career-portal scraper (`careers-search`): verified ATS endpoints, seed registry, build architecture, usage, verification log, and preserved declined-board evidence.
- [ApplyOS-setup-guide.pdf](./ApplyOS-setup-guide.pdf) — Generated setup + architecture guide (regenerate with `python docs/generate_setup_guide.py`).
- [PROVENANCE.md](../applyos/PROVENANCE.md) — Clean-room origin log for every ApplyOS engine module.
- [examples/](./examples/) — Shareable sample outputs (no personal data).
