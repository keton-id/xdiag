# AGENTS.md

Repo-local instructions for coding agents working on xdiag.

## Project

`xdiag` is a browser-only DBML → ERD tool: React 19 + TypeScript + Vite, CodeMirror 6
editor, `@xyflow/react` canvas, dagre layout, `@dbml/core` parser. No backend; state
lives in the browser.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Vite dev server |
| `pnpm lint` | oxlint |
| `pnpm test` | vitest (jsdom) |
| `pnpm build` | `tsc -b && vite build` |
| `pnpm coverage` | vitest + v8 coverage |

Run `pnpm lint && pnpm test && pnpm build` before claiming a change is done.

## Conventions

- Styling: Tailwind utilities plus `--xd-*` CSS variables (`src/theme.ts`). Never hard-code
  colours that a palette should control.
- Small static string-keyed lookups are `Record<K, V>`; publish contracts as named exported
  types, not `ReturnType<typeof fn>`.
- `tsconfig.app.json` enables `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters`;
  use `import type` for type-only imports. Test files are type-checked by `pnpm build`.
- Persistence uses `localStorage` keys prefixed `xdiag_`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `keton-id/xdiag`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical role labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`, used verbatim. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
