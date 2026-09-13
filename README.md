<div align="center">

  <h1>Pravah AI</h1>
  <p><strong>Autonomous Browser Agent Infrastructure for Human-AI Collaboration</strong></p>

  <p>
    <a href="https://www.npmjs.com/package/@pravah/agent">
      <img src="https://img.shields.io/npm/v/@pravah/agent?style=flat-square&color=6366f1" alt="npm version" />
    </a>
    <a href="https://github.com/hyperbrowserai/pravah/blob/main/LICENSE">
      <img src="https://img.shields.io/npm/l/@pravah/agent?style=flat-square&color=10b981" alt="license" />
    </a>
    <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Playwright-powered-2EAD33?style=flat-square&logo=playwright" alt="Playwright" />
  </p>

  <p>
    <a href="#what-is-pravah">Overview</a> ·
    <a href="#technical-architecture">Architecture</a> ·
    <a href="#core-apis">APIs</a> ·
    <a href="#project-structure">Project Structure</a>
  </p>
</div>

---

## What is Pravah?

**Pravah** is a production-grade autonomous browser agent framework built for human-AI collaboration. It gives LLMs eyes, hands, and memory inside real browsers — enabling agents to navigate, interact, extract, and reason about any web page using only natural language.

Unlike traditional browser automation built on brittle selectors, Pravah uses a **live accessibility tree** as its world model, speaks **Chrome DevTools Protocol natively**, and wraps a full **agentic loop** around any LLM you choose — OpenAI, Anthropic, Gemini, DeepSeek, or any OpenRouter model.

---

## Technical Architecture

Pravah is composed of seven tightly integrated subsystems:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PravahAgent  (Public API)                     │
│         executeTask · newPage · initializeMCPClient             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐     ┌─────────────────────────────┐
│    Agent Runtime Loop │     │      LLM Adapter Layer      │
│  agent/tools/agent.ts │◄───►│  OpenAI · Anthropic ·       │
│                       │     │  Gemini · DeepSeek ·        │
│  • Task planning      │     │  OpenRouter                 │
│  • Step tracking      │     │  (native SDKs per provider) │
│  • Action dispatch    │     └─────────────────────────────┘
│  • Completion detect  │
└──────────┬────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
page.ai()    page.perform()
Multi-step   Single-action
  loop       examine-dom/
     │            │
     └─────┬──────┘
           ▼
┌──────────────────────────────────────────────────────┐
│              A11y-DOM Context Provider                │
│          context-providers/a11y-dom/                  │
│                                                      │
│  Accessibility tree  ·  Encoded IDs  ·  DOM cache   │
│  Visual overlay (opt-in)  ·  Streaming capture       │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│                    CDP Layer                          │
│                     src/cdp/                          │
│                                                      │
│  Frame graph  ·  Element resolver  ·  Interactions   │
│  Bounding boxes  ·  Ad/tracker iframe filtering      │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│              Browser Provider Layer                   │
│            src/browser-providers/                     │
│                                                      │
│  Local (stealth Playwright)  ·  Cloud (remote scale) │
└──────────────────────────────────────────────────────┘
```

### Subsystem Overview

| Layer | Path | Responsibility |
|---|---|---|
| **Agent Runtime** | `src/agent/tools/agent.ts` | Agentic loop, planning, action dispatch, completion detection |
| **Examine-DOM** | `src/agent/examine-dom/` | Powers `page.perform()` — a11y tree → LLM rank → single action |
| **A11y-DOM Provider** | `src/context-providers/a11y-dom/` | Accessibility tree extraction, encoded IDs, DOM snapshot cache, visual overlays |
| **CDP Layer** | `src/cdp/` | Chrome DevTools Protocol — frame graph, element resolution, action dispatch |
| **LLM Adapters** | `src/llm/providers/` | Native SDK adapters: OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter |
| **Browser Providers** | `src/browser-providers/` | Local stealth browser and Cloud remote session lifecycle |
| **MCP Client** | `src/agent/mcp/client.ts` | Model Context Protocol — registers remote tools as native agent actions |
| **Action Cache** | `src/agent/shared/action-cache*` | XPath-based deterministic replay of recorded agent sessions |
| **Custom Actions** | `src/custom-actions/` | Extension point for domain-specific agent capabilities |

---

### How the Agentic Loop Works

1. **Capture DOM State** — The A11y-DOM provider walks the Chrome accessibility tree via CDP, assigns every interactive element a unique Encoded ID (`frameIndex-backendNodeId`), and optionally composites bounding boxes onto a screenshot for visual mode.

2. **Build Prompt** — The message builder assembles a system prompt, the DOM snapshot, and the full action history into a single LLM message.

3. **LLM Decision** — The chosen LLM returns the next action: which element to target, which method to use, and what parameters to pass.

4. **Dispatch Action** — The action dispatcher executes via CDP first (exact coordinates, native events), falling back to Playwright locators if CDP is disabled. Built-in actions include `goToUrl`, `actElement`, `extract`, `wait`, and `pdf`.

5. **Repeat or Complete** — If the task is not done, the loop captures a fresh DOM state and repeats. When the LLM emits `complete`, the result is returned to the caller.

---

### DOM Encoding

Every interactive element gets a **stable Encoded ID** that survives DOM mutations:

```
EncodedID = frameIndex - backendNodeId
            "0-138"  →  main frame, CDP backend node 138
            "2-441"  →  iframe #2,  CDP backend node 441
```

This encoding powers correct element resolution across deeply nested and cross-origin iframes (OOPIFs), and makes the ~1-second DOM snapshot cache reliable.

---

### Visual Mode

When enabled, the A11y provider composites element bounding boxes directly onto a CDP screenshot. The resulting annotated image is sent as a multimodal prompt to vision-capable LLMs (GPT-4o, Claude, Gemini), giving the agent a grounded visual understanding of the page.

---

## Core APIs

### `page.perform()` — Fast Single Actions
Best for precise, targeted interactions like filling a field or clicking a button. Uses only the accessibility tree (no screenshot), making it fast and cheap — one LLM call per action.

### `page.ai()` — Autonomous Multi-Step Execution
Best for complex workflows that span multiple pages and states. Runs the full agentic loop — DOM capture, LLM planning, action dispatch, and retry — until the task is complete. Returns structured output and an `actionCache` for deterministic replay.

### `page.extract()` — Typed Structured Extraction
Extracts structured data from any page using a Zod schema you define. The agent reads the DOM, locates the relevant information, and returns it in exactly the shape you specify.

### `agent.executeTask()` — Highest-Level Entry Point
The simplest API — pass a natural language task string and get a result. Handles browser launch, page management, the full agentic loop, and cleanup automatically.

---

## LLM Providers

Pravah uses **native SDKs** for each provider — no abstraction overhead, maximum reliability.

| Provider | Best For | Source |
|---|---|---|
| **OpenAI** | Tool use, MCP, general tasks | `src/llm/providers/openai.ts` |
| **Anthropic** | Complex multi-step reasoning | `src/llm/providers/anthropic.ts` |
| **Gemini** | Visual mode, long context windows | `src/llm/providers/gemini.ts` |
| **DeepSeek** | Cost-sensitive workloads | `src/llm/providers/deepseek.ts` |
| **OpenRouter** | Any model via a single API key | `src/llm/providers/openrouter.ts` |

---

## Extending Pravah

### Custom Actions
Register domain-specific actions by providing a unique type name, a Zod parameter schema, and a `run` function. The LLM learns these actions are available and decides when to invoke them during task execution. The reserved type name `complete` cannot be used.

### MCP Client
Pravah is a fully functional Model Context Protocol (MCP) client. Connect any MCP server and its exposed tools are automatically registered as native agent actions — no manual wiring required.

---

## Action Caching

Every `page.ai()` session records a full **action cache** — XPaths, frame indices, element IDs, and execution metadata for every step taken.

**Replay** runs XPath-based execution (zero LLM calls) and falls back to LLM resolution only if the page structure has changed. Each step reports whether XPath succeeded or LLM fallback was used.

**Use cases:**
- **Regression testing** — record once, replay in CI without LLM cost
- **Workflow templates** — save login/checkout flows and replay across environments
- **Audit trails** — replay exactly what the agent did for debugging

---

## CDP Layer

Pravah communicates with the browser via **Chrome DevTools Protocol natively**. This gives it:

- **Stable element IDs** — `backendNodeId` is permanent for the session lifetime, unlike CSS selectors
- **Exact coordinates** — bounding boxes come from CDP's geometry API, not estimated from the DOM
- **Deep iframe support** — full frame graph tracking including cross-origin (OOPIF) iframes
- **Automatic ad filtering** — `frame-filters.ts` removes ad and tracking iframes from the agent's context
- **Full event stream** — access to any CDP domain for advanced automation needs

Playwright is still available as a fallback. Set `cdpActions: false` to route all actions through Playwright's native locators instead.

---

## Project Structure

```
pravah-ai/
├── src/
│   ├── agent/
│   │   ├── tools/agent.ts          # Core agentic loop
│   │   ├── actions/index.ts        # Built-in actions
│   │   ├── examine-dom/            # page.perform() single-action flow
│   │   ├── messages/               # Prompt construction
│   │   ├── shared/                 # DOM capture, action cache, helpers
│   │   └── mcp/client.ts           # MCP client
│   ├── cdp/                        # Chrome DevTools Protocol layer
│   ├── context-providers/
│   │   └── a11y-dom/               # Accessibility tree provider
│   ├── llm/providers/              # Per-provider native SDK adapters
│   ├── browser-providers/          # Local + Cloud browser lifecycle
│   ├── custom-actions/             # User-defined action extension point
│   ├── types/                      # Shared TypeScript interfaces
│   └── utils/                      # Shared helpers
├── examples/                       # Reference flows
├── scripts/                        # Smoke tests and eval harnesses
└── evals/                          # Baseline evaluation datasets
```

---

## License

MIT © 2025 Digitium Labs. See [LICENSE](./LICENSE) for full terms.
