# ApplyOS Engine

The deterministic core of ApplyOS: a zero-runtime-dependency Bun workspace that
powers both the `applyos` command-line tool and the agent workflows. It is
local-first and contains no personal data.

## Layout

### Applications

| Path | Description |
|---|---|
| `apps/cli` | The `applyos` binary. Stable, additive-only command surface: `scrape`, `rank`, `apply` (including `--batch`), `tracker`, `snapshot`, `profile`, `eval`, `doctor`, and `contract`. Callable from any runtime or script without agent-specific branching. |
| `apps/tui` | `applyos-tui`, a read-only terminal view over the tracker snapshot: pipeline, ranked shortlist with verdict bands and gaps, and posting detail with the score explanation and quoted evidence. No framework, no write path. |

### Packages

| Path | Description |
|---|---|
| `packages/core` | Shared contracts and utilities: `JobPosting` types, polite fetch, robots gate, deduplication, fair-slice interleave, byte-preserving tracker writer, snapshot, and `json`/`table`/`plain` formatters. |
| `packages/provider` | The single provider SDK implementation per board, plus `registry.yaml` as the one source of truth for boards and seeded company career sites. Fourteen entries: six aggregators and eight ATS providers. |
| `packages/company-scraper` | Employer career-site adapters (Greenhouse, Lever, SmartRecruiters, Workday, Amazon) and seven seeded companies, including a live-verified Workday tenant. |
| `packages/portals` | Six thin aggregator adapters (RemoteOK, Remotive, We Work Remotely, Unstop, freehire, Arbeitnow) over the provider SDK. |
| `packages/matching` | The explainable ranker: nine gates, four weighted dimensions, and five verdict bands. Gates without evidence report `not evaluated` rather than inventing a finding. |
| `packages/docgen` | The application factory and Document Manifest: keyword gaps are listed, never stuffed. |

### Evaluation

`evals/` holds a redacted, provenance-tagged corpus and four offline deterministic
runners (gates, deduplication, documents, ranking) with a committed baseline and
a CI tolerance gate. See `docs/engineering/evaluation.md` at the repository root.

## Design principles

- **One implementation per board.** Portal CLIs and engine commands are thin surfaces over the provider SDK.
- **One scoring model.** The ranker, the Python tooling, and the workflow specs all read the canonical tables in `framework/scoring.json`; `tools/spec_parity.py` fails if they drift.
- **No invented data.** `postedDate: null` stays null, and gates that cannot be evaluated say so explicitly.
- **Polite by default.** Public endpoints only, bounded pagination, pacing between hosts, and a robots gate.

## Development

```bash
bun install --frozen-lockfile
bun test
bun run apps/cli/src/cli.ts doctor
bun run apps/cli/src/cli.ts eval --format json
```

CI runs the engine checks on Ubuntu, Windows, and macOS (`applyos-checks`).
Module origins are recorded in `PROVENANCE.md`.
