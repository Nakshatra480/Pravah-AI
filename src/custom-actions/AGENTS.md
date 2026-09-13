# Custom Actions Guidelines

## Scope
- Applies to `src/custom-actions/`.
- Inherits root `AGENTS.md` and `src/AGENTS.md`.

## Action Definition Rules
- Define actions with typed `AgentActionDefinition` contracts and zod schemas.
- Use this folder for extension actions that are opt-in via `PravahConfig.customActions`.
- Never define or register `complete` here; it is runtime-reserved.

## Behavior Requirements
- Keep action prompts/outputs deterministic enough for repeated runs.
- Ensure side-effecting custom actions document expected user interaction and error behavior.
