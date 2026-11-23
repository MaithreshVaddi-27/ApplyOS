# arbeitnow-cli

Zero-dependency CLI for searching remote tech jobs across Europe on
[Arbeitnow](https://www.arbeitnow.com) via its public job board API.

## Usage

```bash
bun run src/cli.ts search -q "engineer" --limit 5 --format table
bun run src/cli.ts detail <slug|url> --format json
```

The board is implemented once in `applyos/packages/provider/src/arbeitnow.ts`. This CLI is a thin
surface over it, as is the engine's `applyos/packages/portals/src/arbeitnow.ts`.
