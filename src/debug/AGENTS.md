# Debug Guidelines

## Scope
- Applies to `src/debug/`.
- Inherits root `AGENTS.md` and `src/AGENTS.md`.

## Debug Option Ownership
- Keep global debug-option shape in `src/debug/options.ts`.
- New debug toggles must be wired through `setDebugOptions`/`getDebugOptions` and consumed via existing runtime paths.
- Avoid debug behavior that mutates runtime semantics when debug is disabled.

## Instrumentation
- Prefer additive instrumentation (timing, traces, dumps) that can be toggled without code-path drift.
- Keep debug output structure stable for downstream tooling and scripts.
