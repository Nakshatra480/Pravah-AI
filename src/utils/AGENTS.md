# Utilities Guidelines

## Scope
- Applies to `src/utils/`.
- Inherits root `AGENTS.md` and `src/AGENTS.md`.

## Reuse First
- Add shared helpers here only when logic is reused or expected to be reused.
- Reuse existing primitives (`retry`, `sleep`, `error-emitter`, `waitForSettledDOM`) instead of duplicating behavior.
- Keep `src/utils/index.ts` exports synchronized with utility additions/removals.

## Reliability
- Utility changes that affect runtime stability (retries, wait logic, conversion helpers) should include targeted tests.
- Keep helpers framework-agnostic unless a module is explicitly runtime-coupled.
