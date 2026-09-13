# LLM Layer Guidelines

## Scope
- Applies to `src/llm/`.
- Inherits root `AGENTS.md` and `src/AGENTS.md`.

## Adapter Contracts
- Provider clients must implement `PravahLLM`.
- Wire provider selection through `createLLMClient` in `src/llm/providers/index.ts`.
- Keep each provider aligned with shared model capabilities and structured output expectations.

## Message and Schema Translation
- Update `src/llm/utils/message-converter.ts` and `src/llm/utils/schema-converter.ts` when provider message/schema requirements change.
- Preserve zod-first structured output flow for tool/action decisions.
- Avoid provider-specific assumptions leaking into agent/runtime modules.
