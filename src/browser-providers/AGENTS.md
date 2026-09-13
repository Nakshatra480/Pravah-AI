# Browser Provider Guidelines

## Scope
- Applies to `src/browser-providers/`.
- Inherits root `AGENTS.md` and `src/AGENTS.md`.

## Provider Contracts
- Implement providers against `src/types/browser-providers/types.ts` contracts.
- Extend `LocalBrowserProvider`/`PravahCloudProvider` patterns instead of launching browsers ad hoc.
- Keep lifecycle behavior (`start`, `close`, `getSession`) consistent across providers.

## Runtime Behavior
- Preserve local provider defaults (Chrome channel and stealth-style flags) unless intentionally changing behavior.
- Keep remote provider session metadata/debug logging scoped to debug paths.
- Route provider selection through existing config wiring rather than direct instantiation in unrelated modules.
