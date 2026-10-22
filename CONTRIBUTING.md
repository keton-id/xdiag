# Contributing

## Setup

```bash
pnpm install
pnpm dev
```

Node 22+ and pnpm 12+ are expected.

## Before pushing

```bash
pnpm lint
pnpm test
pnpm build
```

All three must pass. CI runs the same commands plus a Trivy scan.

## Ground rules

- **The engine stays pure.** `src/engine/**` and `src/theme.ts` must not import React or touch the DOM (settings code excepted, which is exercised under jsdom). This keeps the parser, layout and SQL export testable without a browser.
- **Add a test with the change.** Engine changes need a case in the matching `*.test.ts`; new behaviour that a consumer can observe (cardinality, ordering, generated SQL, routing) is what the suite covers. UI-only changes are verified in the browser.
- **Visual changes go through the tokens.** Colours are read from `--xd-*` CSS variables defined in `src/theme.ts`; don't hard-code hex values in components.
- **Surgical diffs.** Match the surrounding style; avoid drive-by refactors in a feature PR.

## Reporting bugs

Include the DBML that reproduces the issue, the browser and, if relevant, a screenshot. A malformed-schema case is best reported with the exact error line/column shown by the editor.
