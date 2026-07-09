# Contributing to Compass

Thanks for your interest! Compass is small and hackable — contributions and
forks are both welcome.

## Development setup

```bash
pnpm install
pnpm dev          # Vite dev server with HMR
```

Load the extension for testing:

1. `pnpm build` (or use the `pnpm dev` output).
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**,
   and select the `dist/` folder.
3. Open a new tab to see your changes.

## Before opening a PR

Please make sure the checks that CI runs pass locally:

```bash
pnpm typecheck    # tsc -b --noEmit — must be clean
pnpm test         # vitest — must be green
pnpm build        # must succeed
```

## Style

- Match the surrounding code — this project favours small, focused modules and
  comments that explain *why*, not *what*.
- Keep the local-first, zero-telemetry guarantee intact. If a change introduces
  a network request, call it out explicitly in the PR description — the only
  existing network surface is `src/lib/vault.ts`.
- Prefer editing defaults (`src/lib/storage.ts`, `src/lib/quotes.ts`) over
  hardcoding personal data anywhere else.

## Reporting bugs / ideas

Open an issue with what you expected, what happened, and your browser + version.
For features, describe the problem you're trying to solve.
