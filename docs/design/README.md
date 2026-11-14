# Design

Product and interface design for ApplyOS. These documents describe **what the product does and
what interfaces it exposes**, independent of how the work is sequenced (see
[../roadmap/master-roadmap.md](../roadmap/master-roadmap.md)).

| Document | Contents |
|---|---|
| [product-requirements.md](./product-requirements.md) | Who ApplyOS is for, what it must do, what it must never do |
| [provider-sdk.md](./provider-sdk.md) | The provider contract, types, and lifecycle |
| [plugin-architecture.md](./plugin-architecture.md) | How the SDK is extended; trust model for third-party code |
| [public-api.md](./public-api.md) | The stable CLI and JSON surfaces, and their versioning policy |
| [cli-design.md](./cli-design.md) | Command structure, output formats, exit codes, argument policy |
| [ux-flows.md](./ux-flows.md) | The candidate-facing flows and their states |
| [document-formats.md](./document-formats.md) | Every file format ApplyOS reads and writes |

## Relationship to the other document sets

- **Design** — the *what*. Interfaces, contracts, user-visible behaviour.
- [../architecture/](../architecture/README.md) — the *why* and the *shape*. Decisions and topology.
- [../engineering/](../engineering/README.md) — the *how well*. Standards, testing, performance.
- [../phases/](../phases/README.md) — the *when*. Sequenced implementation plans.
- [../developer/](../developer/README.md) — the *how to*. Onboarding and extension guides.

## Design principles

1. **Local-first is not a mode.** It is the only mode. There is no hosted variant.
2. **The human decides.** ApplyOS scores, drafts, and proposes. It never submits, sends, or
   contacts anyone. Every automation has an approval gate.
3. **Absence is data.** A field the source did not state is `null`, never a placeholder, never an
   empty string, never an inferred value. Most of the project's worst bugs were absence being
   rendered as presence.
4. **Errors are typed and quiet.** A dead source is a note in the run summary, not an exception
   and not a silent empty result.
5. **Every number is traceable.** A score shows its dimensions; a document claim shows its source;
   a report number shows the file it came from.
6. **One contract per concern.** One provider contract, one tracker schema, one invocation shape.
