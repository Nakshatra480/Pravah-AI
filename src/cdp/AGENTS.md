# CDP Guidelines

## Scope
- Applies to `src/cdp/`.
- Inherits root `AGENTS.md` and `src/AGENTS.md`.

## CDP-First Contract
- Treat this folder as the canonical implementation for CDP element resolution and dispatch.
- Keep `resolveElement` and `dispatchCDPAction` behavior aligned with frame graph/context tracking.
- Preserve Playwright fallback compatibility in `playwright-adapter.ts` when CDP paths are unavailable.

## Frame and Coordinate Integrity
- Keep `frame-graph.ts`, `frame-context-manager.ts`, and frame filtering logic synchronized.
- Coordinate handling in `bounding-box.ts` must stay compatible with context-provider overlays and maps.
- Use local shared `types.ts` definitions; avoid ad-hoc CDP payload objects.
