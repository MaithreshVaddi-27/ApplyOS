# cli-shared — one copy of the portal-CLI plumbing

Twelve `*-search` CLIs grew the same helpers by copy-paste (`writeError`,
flag tokenizers, entity decoders, `slugify`, `sleep`). This folder is the
single copy. It is **not a skill** (no `SKILL.md`, no CLI of its own) and
**not a published package** — CLIs import it via relative paths
(`../../cli-shared/src/errors.js`), so a skill folder plus this sibling
folder is still all you need to run one CLI. That is the whole trade this
module makes: see `/add-portal`, which scaffolds new CLIs against it.

## Modules

| File | Exports | Canonical source |
|---|---|---|
| `errors.ts` | `writeError(message, code)` — stderr `{"error","code"}`, no default, no case munging | all 12 CLIs (unified 2026-10-11) |
| `flags.ts` | `parseRawArgs(argv, aliases, mode)` — argv tokenizer; `mode` pins the CLI's negative-number semantics | 4 observed modes, see below |
| `entities.ts` | `decodeHtmlEntities` — union entity set, `fromCodePoint` with range guard | linkedin (strictest) + careers (`&#x2F;`, `&#x3D;`) |
| `text.ts` | `slugify`, `sleep` — byte-identical copies collapsed | internshala/naukri/wayup/cutshort |

## Flag-tokenizer modes

Tokenizers looked identical until negative numbers were compared — the modes
below encode the observed per-CLI behavior exactly, so adopting the shared
tokenizer changes no CLI's behavior:

- `"none"` — any dash-led token is a flag; a dash-led next token is never a
  value (linkedin, unstop, freehire, internshala, naukri, remotive,
  wellfound).
- `"int-only"` — a dash-led next token counts as a value when it is an
  integer (`-3` yes, `-3.5` no); flag tokens have no negative guard
  (weworkremotely, remoteok, wayup).
- `"cutshort"` — `/^-\d/` tokens are values in both positions
  (cutshort-search).
- `"careers"` — bare `-` is a positional; values allow `/^-?\d/`
  (careers-search).

## Deliberately NOT here

- `fetchWithBackoff` — exhaustion semantics diverge per CLI (return-null vs
  throw, retry counts 3–6) and retry-backoff suites pin them. Unifying would
  change network behavior.
- Table renderers — column widths and truncation markers are per-CLI output
  contract, pinned by tests (e.g. wayup's id round-trip). Only the
  `truncate`/`pad` primitives would be safe; not yet extracted.
- Tag strippers — whitespace handling diverges (collapse+trim vs
  newline-preserving vs inline); each CLI keeps its own and calls the shared
  decoder inside it.
