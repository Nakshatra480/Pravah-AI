# CLI Guidelines

## Scope
- Applies to `src/cli/`.
- Inherits root `AGENTS.md` and `src/AGENTS.md`.

## CLI Flow
- Keep CLI lifecycle routing through `PravahAgent` instead of re-implementing runtime steps in CLI code.
- Preserve interactive behavior (prompting, pause/resume, cleanup) when changing command flow.
- Keep option handling compatible with documented flags (`--debug`, `--cloud`, `--mcp`).

## Integration Expectations
- Register user-facing custom actions through config wiring, not hidden side channels.
- Keep debug and remote-provider setup optional and resilient to missing optional dependencies.
