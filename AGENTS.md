# AGENTS.md

Repo-local instructions for coding agents working on xdiag.

## Project

`xdiag` is a browser-only multi-kind diagram tool: React 19 + TypeScript + Vite, CodeMirror 6
editor, `@xyflow/react` ERD canvas, dagre layout, `@dbml/core` parser, plus hand-rolled SVG
canvases for sequence, flowchart and mindmap. A project is a list of documents, one kind
each. No backend; state lives in the browser.

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
- Diagram kinds are declared once in `KINDS: Record<DiagramKind, KindSpec>`
  (`src/kinds/registry.ts`). A new kind is one entry plus a parser and a canvas; never
  branch on a kind outside the registry.
- Non-ERD canvases are `lazy()`-loaded and must stay out of the ERD entry chunk.
  Parsers in `src/kinds/*/parse.ts` are React-free and total: return the last good model
  plus an error rather than throwing.

## Agent skills

### Issue tracker

Issues live in GitHub Issues at `keton-id/xdiag`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical role labels `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`,
`wontfix`, used verbatim. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Standing flow

For any non-trivial change: grill the request against `GLOSSARY.md` and `docs/adr/` until
terms and decisions are settled → write the spec or open tickets (labels from
`docs/agents/triage-labels.md`) → implement test-first, adding a test beside every parser,
layout or exporter change → `pnpm lint && pnpm test && pnpm build` → review the diff →
open the PR → record anything surprising as an ADR or glossary term before merging.
