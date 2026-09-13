# Source Folder Guidelines

## Scope
- Applies to `src/` and everything below it unless a deeper `AGENTS.md` overrides details.
- Follow root `AGENTS.md` first; this file adds source-specific guardrails.

## Source-of-Truth Rules
- `src/` is the only hand-edited implementation code. Do not edit `dist/` directly.
- When public API shape changes, update `src/index.ts` exports intentionally.
- Keep imports on `@/*` aliases for internal modules to avoid brittle relative paths.

## Change Hygiene
- Put new shared interfaces in `src/types` before wiring behavior in runtime modules.
- Keep runtime paths typed end-to-end (no `any`), especially agent actions, LLM outputs, and CDP flows.
- Prefer extending existing modules in `src/*` over introducing parallel abstractions.
