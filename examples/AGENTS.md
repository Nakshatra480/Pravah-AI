# Examples Guidelines

## Scope
- Applies to `examples/`.
- Inherits root `AGENTS.md`.

## Example Quality
- Keep examples minimal, runnable, and focused on one capability.
- Ensure each example path works with `yarn example <path>`.
- When adding a new capability example, favor real patterns from `src/` over shortcuts.

## Documentation Sync
- If an example changes behavior or recommended API usage, update related docs.
- Keep provider-specific examples aligned with current configuration contracts.
- Avoid embedding brittle assumptions (hard-coded local-only paths, stale model names, hidden env requirements).
