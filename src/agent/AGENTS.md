# Agent Runtime Guidelines

## Scope
- Applies to `src/agent/` and its subdirectories.
- Inherits root `AGENTS.md` and `src/AGENTS.md`.

## Runtime Invariants
- Keep `src/agent/tools/agent.ts` and `src/agent/index.ts` as the orchestration entrypoints; avoid bypassing the runtime loop.
- Register first-party actions via `src/agent/actions/index.ts` and typed `AgentActionDefinition` contracts.
- Do not manually register `complete`; runtime injects completion variants (`generateCompleteActionWithOutputDefinition`).

## DOM and Action Consistency
- Any page-mutating action path must invalidate DOM snapshots through `markDomSnapshotDirty`.
- Keep `actElement`/cached-action flows aligned with `src/agent/shared/run-cached-action.ts` semantics.
- Preserve compatibility between action execution and `cdpActions` toggles.

## Prompting and Schemas
- Keep message builders under `src/agent/messages/` consistent with available actions.
- Use zod schemas for structured LLM inputs/outputs in `examine-dom` and action definitions.
