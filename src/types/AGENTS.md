# Types Guidelines

## Scope
- Applies to `src/types/`.
- Inherits root `AGENTS.md` and `src/AGENTS.md`.

## Type Ownership
- Add or evolve shared interfaces here before consuming them in runtime code.
- Keep exports centralized via `src/types/index.ts`.
- Prefer explicit interfaces and unions; do not use `any`.

## Domain Boundaries
- Keep agent/action contracts under `src/types/agent/*`.
- Keep browser provider contracts under `src/types/browser-providers/*`.
- Keep config/runtime flags in `src/types/config.ts` and synchronize changes with callers.
