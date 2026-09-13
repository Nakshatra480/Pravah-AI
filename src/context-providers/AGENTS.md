# Context Provider Guidelines

## Scope
- Applies to `src/context-providers/`.
- Inherits root `AGENTS.md` and `src/AGENTS.md`.

## Provider Architecture
- `a11y-dom` is the primary DOM context pipeline; keep tree capture, ID maps, cache, and overlays coherent.
- When encoded ID or node mapping behavior changes, update `build-tree.ts`, `build-maps.ts`, and `visual-overlay.ts` together.
- Keep shared screenshot/highlight helpers in `src/context-providers/shared/` as the reuse layer.

## Cache and Invalidations
- Preserve `dom-cache.ts` semantics, including short-lived caching and explicit dirty marking.
- New action or navigation side effects must continue to trigger cache invalidation through existing entrypoints.
- Keep provider output compatible with both agent loop capture and `page.perform` single-action flows.
