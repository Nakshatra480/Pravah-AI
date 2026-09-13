import { PravahLLM } from "../types";
import { createOpenAIClient, OpenAIClientConfig } from "./openai";
import { createAnthropicClient, AnthropicClientConfig } from "./anthropic";
import { createGeminiClient, GeminiClientConfig } from "./gemini";
import { createDeepSeekClient, DeepSeekClientConfig } from "./deepseek";
import { createOpenRouterPoolClient } from "./openrouter";

export type LLMProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "openrouter";

export interface LLMConfig {
  provider: LLMProvider;
  /** Single API key (used by openai / anthropic / gemini / deepseek, and
   *  as a single-key shorthand for openrouter). */
  apiKey?: string;
  /** Multiple API keys — used by the "openrouter" provider pool. */
  apiKeys?: string[];
  model: string;
  /** Fallback model for the "openrouter" provider pool. */
  fallbackModel?: string;
  temperature?: number;
  maxTokens?: number;
  baseURL?: string; // For OpenAI custom endpoints
}

export function createLLMClient(config: LLMConfig): PravahLLM {
  switch (config.provider) {
    case "openai":
      return createOpenAIClient({
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        baseURL: config.baseURL,
      });

    case "anthropic":
      return createAnthropicClient({
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

    case "gemini":
      return createGeminiClient({
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });

    case "deepseek":
      return createDeepSeekClient({
        apiKey: config.apiKey,
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        baseURL: config.baseURL,
      });

    case "openrouter": {
      // Normalise: apiKeys takes precedence; fall back to single apiKey
      const keys: string[] = config.apiKeys?.length
        ? config.apiKeys
        : config.apiKey
          ? [config.apiKey]
          : [];
      if (keys.length === 0) {
        throw new Error(
          "[Pravah] openrouter provider requires at least one key in apiKeys or apiKey."
        );
      }
      return createOpenRouterPoolClient({
        apiKeys: keys,
        primaryModel: config.model,
        fallbackModel: config.fallbackModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });
    }

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

// Export individual provider creators for direct use
export { createOpenAIClient } from "./openai";
export { createAnthropicClient } from "./anthropic";
export { createGeminiClient } from "./gemini";
export { createDeepSeekClient } from "./deepseek";
export { createOpenRouterPoolClient } from "./openrouter";

// Export types (use type-only export for interface)
export type { PravahLLM } from "../types";

// Export utility functions
export * from "../utils/message-converter";
export * from "../utils/schema-converter";
