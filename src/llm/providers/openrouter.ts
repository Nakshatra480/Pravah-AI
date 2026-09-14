/**
 * OpenRouter multi-key pool LLM client for Pravah AI.
 *
 * Implements PravahLLM using the existing OpenAIClient internally
 * (OpenRouter is 100% OpenAI-API-compatible via baseURL override).
 *
 * Key rotation strategy:
 *   - Round-robin across keys during normal operation.
 *   - On HTTP 429 / rate-limit error: mark key as cooling, rotate to next key.
 *   - If all keys are cooling: wait for the soonest recovery, then retry.
 *   - If primary model exhausted on all keys: retry all keys with fallbackModel.
 *   - Non-rate-limit errors are re-thrown immediately (not a key-pool concern).
 */

import { z } from "zod";
import {
  PravahLLM,
  PravahMessage,
  PravahStructuredResult,
  PravahCapabilities,
  PravahContentPart,
  PravahInvokeOptions,
  StructuredOutputRequest,
} from "../types";
import { createOpenAIClient, OpenAIClient } from "./openai";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_PRIMARY_MODEL = "openrouter/free";
const DEFAULT_FALLBACK_MODEL = "google/gemma-3-27b-it:free";
const DEFAULT_COOLDOWN_MS = 30_000;
const DEFAULT_MAX_WAIT_MS = 30_000;
/** Full passes over the key pool when every failure was a dropped connection. */
const TRANSIENT_RETRY_PASSES = 2;
/** Pause between transient retry passes. */
const TRANSIENT_RETRY_DELAY_MS = 1_000;
/** Per-request ceiling. Free-tier endpoints occasionally stall for many
 *  minutes; without this the SDK would wait 10 minutes and freeze the agent.
 *  Lowered to 15s to fast-fail on stalled free-tier endpoints. */
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
/** Hard ceiling for one logical LLM call, across every key, retry pass and
 *  model fallback. Kept tight (60s) so the agent recovers quickly. */
const DEFAULT_OVERALL_TIMEOUT_MS = 60_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OpenRouterPoolConfig {
  /** At least one API key is required. */
  apiKeys: string[];
  /** Primary model — used by all keys during normal operation.
   *  Default: "nex-agi/nex-n2.5-pro:free" */
  primaryModel: string;
  /** Fallback model — used only when ALL keys are rate-limited on primaryModel.
   *  Default: "dots-studio/dots-3-note-preview:free" */
  fallbackModel?: string;
  temperature?: number;
  maxTokens?: number;
  /** How long (ms) a rate-limited key is put into cooldown. Default: 60_000 */
  cooldownMs?: number;
  /** Per-request timeout in ms before the call is abandoned and the pool
   *  rotates to the next key. Default: 45_000 */
  requestTimeoutMs?: number;
  /** Hard ceiling in ms for one logical call across all keys, retry passes
   *  and model fallbacks. Default: 150_000 */
  overallTimeoutMs?: number;
}

interface KeyEntry {
  apiKey: string;
  /** Stable 1-based position in the pool, used for log messages. */
  index: number;
  /** Epoch ms per model — a key is skipped for a model while cooling.
   *  OpenRouter free-tier limits are per key PER MODEL, so a key exhausted on
   *  the primary model is still usable for the fallback model. */
  coolingUntil: Map<string, number>;
  failCount: number;
  /** Set when the key is rejected outright (401/403) — skipped for the rest
   *  of the process lifetime. */
  disabled: boolean;
  /** Lazily created OpenAIClient instances, keyed by model id. */
  clients: Map<string, OpenAIClient>;
}

// ---------------------------------------------------------------------------
// Rate-limit error detection
// ---------------------------------------------------------------------------

const RATE_LIMIT_PATTERN =
  /rate.?limit|quota|token.?limit|context.?length|insufficient_quota|too.?many.?requests/i;

/** How the pool should react to a given upstream failure. */
export type OpenRouterFailureKind =
  | "rate_limit" // key is throttled for this model — cool it and rotate
  | "key_invalid" // key is rejected outright — disable it and rotate
  | "model_unavailable" // model is gone/offline — no key will help, switch model
  | "transient" // upstream hiccup — try the next key
  | "other"; // caller's problem — rethrow untouched

const MODEL_UNAVAILABLE_PATTERN =
  /no endpoints found|no allowed providers|model not found|is not a valid model|unknown model|no instances available|only available on|not available for|requires more credits|data policy/i;
/** Connection-level failures: no HTTP status, worth retrying on another key. */
const NETWORK_ERROR_PATTERN =
  /terminated|socket hang up|econnreset|econnrefused|etimedout|epipe|enotfound|eai_again|fetch failed|network error|premature close|aborted|stream closed|timed out|timeout|connection error/i;

const KEY_INVALID_PATTERN =
  /user not found|invalid api key|no auth credentials|api key not found|unauthorized|disabled key/i;

function errorStatus(err: unknown): number | undefined {
  return (
    (err as { status?: number }).status ??
    (err as { statusCode?: number }).statusCode
  );
}

function errorMessage(err: unknown): string {
  return (err as { message?: string }).message ?? String(err);
}

/**
 * Classify an upstream OpenRouter/OpenAI error so the pool knows whether to
 * rotate keys, switch models, or give the error straight back to the caller.
 */
export function classifyFailure(err: unknown): OpenRouterFailureKind {
  if (err == null) return "other";

  const status = errorStatus(err);
  const message = errorMessage(err);
  const type: string | undefined = (err as { type?: string }).type;

  // Model is retired, offline, or unroutable — rotating keys cannot help.
  if (MODEL_UNAVAILABLE_PATTERN.test(message)) return "model_unavailable";
  if (status === 404) return "model_unavailable";

  // Key itself is rejected — rotate to another key and stop using this one.
  if (status === 401 || status === 403) return "key_invalid";
  if (KEY_INVALID_PATTERN.test(message)) return "key_invalid";

  // Throttled / out of quota for this key+model.
  if (status === 429 || status === 402) return "rate_limit";
  if (type === "rate_limit_exceeded" || type === "insufficient_quota") {
    return "rate_limit";
  }
  if (RATE_LIMIT_PATTERN.test(message)) return "rate_limit";

  // Upstream instability — another key may well succeed.
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return "transient";
  }

  // Dropped connections / DNS / timeouts surface with no HTTP status at all.
  if (status === undefined && NETWORK_ERROR_PATTERN.test(message)) {
    return "transient";
  }
  const code: string | undefined = (err as { code?: string }).code;
  if (code !== undefined && NETWORK_ERROR_PATTERN.test(code)) {
    return "transient";
  }

  return "other";
}

/** Retained for readability at call sites and for external consumers. */
function isRateLimitError(err: unknown): boolean {
  return classifyFailure(err) === "rate_limit";
}

/** Raised internally when a model cannot be served by any key. */
class ModelUnavailableError extends Error {
  constructor(
    readonly model: string,
    readonly cause: unknown
  ) {
    super(
      `[Pravah] Model "${model}" is unavailable on OpenRouter: ${errorMessage(cause)}`
    );
    this.name = "ModelUnavailableError";
  }
}

// ---------------------------------------------------------------------------
// Pool client
// ---------------------------------------------------------------------------

export class OpenRouterPoolClient implements PravahLLM {
  private readonly keys: KeyEntry[];
  private readonly primaryModel: string;
  private readonly fallbackModel: string;
  private readonly cooldownMs: number;
  private readonly requestTimeoutMs: number;
  private readonly overallTimeoutMs: number;
  private readonly temperature: number;
  private readonly maxTokens?: number;

  /** Round-robin pointer — advances on every successful call. */
  private currentIndex = 0;

  constructor(config: OpenRouterPoolConfig) {
    const apiKeys = (config.apiKeys ?? []).filter(
      (key) => typeof key === "string" && key.length > 0
    );
    if (apiKeys.length === 0) {
      throw new Error(
        "[Pravah] OpenRouterPoolClient requires at least one API key."
      );
    }

    this.primaryModel = config.primaryModel || DEFAULT_PRIMARY_MODEL;
    this.fallbackModel = config.fallbackModel || DEFAULT_FALLBACK_MODEL;
    this.cooldownMs = config.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.requestTimeoutMs =
      config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.overallTimeoutMs =
      config.overallTimeoutMs ?? DEFAULT_OVERALL_TIMEOUT_MS;
    this.temperature = config.temperature ?? 0;
    this.maxTokens = config.maxTokens;

    this.keys = apiKeys.map((apiKey, i) => ({
      apiKey,
      index: i + 1,
      coolingUntil: new Map<string, number>(),
      failCount: 0,
      disabled: false,
      clients: new Map<string, OpenAIClient>(),
    }));
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Returns keys that are not currently in cooldown, in round-robin order
   * starting from currentIndex.
   */
  private getAvailableKeys(model: string): KeyEntry[] {
    const now = Date.now();
    const ordered: KeyEntry[] = [];
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[idx]!;
      if (key.disabled) continue;
      if (now >= (key.coolingUntil.get(model) ?? 0)) {
        ordered.push(key);
      }
    }
    return ordered;
  }

  /**
   * Waits until the soonest key cooldown expires.
   * Throws if the wait would exceed maxWaitMs.
   */
  private async waitForAnyKey(
    model: string,
    maxWaitMs = DEFAULT_MAX_WAIT_MS
  ): Promise<void> {
    const live = this.keys.filter((k) => !k.disabled);
    if (live.length === 0) {
      throw new Error(
        "[Pravah] Every OpenRouter API key was rejected as invalid. " +
          "Check OPENROUTER_API_KEY_* in your .env."
      );
    }
    const soonest = Math.min(
      ...live.map((k) => k.coolingUntil.get(model) ?? 0)
    );
    const waitMs = soonest - Date.now();
    if (waitMs <= 0) return;
    if (waitMs > maxWaitMs) {
      throw new Error(
        `[Pravah] All OpenRouter API keys are rate-limited on "${model}". ` +
          `Next available in ${Math.ceil(waitMs / 1000)}s, which exceeds the max wait of ${maxWaitMs / 1000}s.`
      );
    }
    console.warn(
      `[Pravah][Pool] All keys cooling on "${model}". ` +
        `Waiting ${Math.ceil(waitMs / 1000)}s for recovery...`
    );
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs + 100));
  }

  /** Lazily create (and cache) the OpenAIClient for a key/model pair. */
  private getClient(entry: KeyEntry, model: string): OpenAIClient {
    const existing = entry.clients.get(model);
    if (existing) return existing;

    const client = createOpenAIClient({
      apiKey: entry.apiKey,
      baseURL: OPENROUTER_BASE_URL,
      model,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      timeout: this.requestTimeoutMs,
      // The pool handles retries itself by rotating keys.
      maxRetries: 0,
    });
    entry.clients.set(model, client);
    return client;
  }

  /** Mark a key as rate-limited. */
  private markKeyCooling(entry: KeyEntry, model: string): void {
    entry.failCount++;
    entry.coolingUntil.set(model, Date.now() + this.cooldownMs);
    console.warn(
      `[Pravah][Pool] Key #${entry.index} rate-limited on "${model}" (fail #${entry.failCount}). ` +
        `Cooling for ${this.cooldownMs / 1000}s. Rotating to next key...`
    );
  }

  /** Permanently retire a key that the API rejected (bad/revoked key). */
  private markKeyInvalid(entry: KeyEntry, err: unknown): void {
    entry.disabled = true;
    console.warn(
      `[Pravah][Pool] Key #${entry.index} rejected by OpenRouter ` +
        `(${errorMessage(err)}). Disabling it and rotating to next key...`
    );
  }

  /** Mark a key as healthy after a successful call. */
  private markKeySuccess(entry: KeyEntry): void {
    entry.failCount = 0;
    // Advance round-robin for next call
    this.currentIndex = entry.index % this.keys.length;
  }

  /**
   * Core execution wrapper: tries all available keys in order for a given model.
   * Returns the result or throws if all keys failed (rate-limit or otherwise).
   */
  private async tryAllKeys<TResult>(
    model: string,
    fn: (client: OpenAIClient) => Promise<TResult>,
    deadline: number
  ): Promise<TResult> {
    let lastError: unknown;

    // A dropped connection is usually momentary, so make a second full pass
    // over the pool before giving up. Rate-limited/disabled keys are skipped
    // by getAvailableKeys, so a pass never retries a key that cannot serve us.
    for (let pass = 0; pass < TRANSIENT_RETRY_PASSES; pass++) {
      // Ensure at least one key is available (wait if needed)
      let available = this.getAvailableKeys(model);
      if (available.length === 0) {
        await this.waitForAnyKey(model);
        available = this.getAvailableKeys(model);
      }

      let sawOnlyTransient = available.length > 0;

      for (const entry of available) {
        if (Date.now() >= deadline) {
          throw (
            lastError ??
            new Error(
              `[Pravah] Timed out after ${this.overallTimeoutMs / 1000}s calling OpenRouter ("${model}").`
            )
          );
        }
        try {
          const result = await fn(this.getClient(entry, model));
          this.markKeySuccess(entry);
          return result;
        } catch (err: unknown) {
          const kind = classifyFailure(err);
          lastError = err;

          if (kind === "rate_limit") {
            this.markKeyCooling(entry, model);
            sawOnlyTransient = false;
          } else if (kind === "key_invalid") {
            this.markKeyInvalid(entry, err);
            sawOnlyTransient = false;
          } else if (kind === "transient") {
            console.warn(
              `[Pravah][Pool] Key #${entry.index} hit a transient upstream error ` +
                `on "${model}" (${errorMessage(err)}). Trying next key...`
            );
          } else if (kind === "model_unavailable") {
            // No key can serve this model — stop rotating and let the caller
            // switch to the fallback model.
            throw new ModelUnavailableError(model, err);
          } else {
            // Genuine caller-side error: bubble up untouched.
            throw err;
          }
        }
      }

      // Only worth another pass if every failure was a dropped connection,
      // and only while there is still budget left.
      if (!sawOnlyTransient) break;
      if (Date.now() >= deadline) break;
      if (pass < TRANSIENT_RETRY_PASSES - 1) {
        console.warn(
          `[Pravah][Pool] All keys hit transient errors on "${model}". ` +
            `Retrying the pool (pass ${pass + 2}/${TRANSIENT_RETRY_PASSES})...`
        );
        await new Promise<void>((resolve) =>
          setTimeout(resolve, TRANSIENT_RETRY_DELAY_MS)
        );
      }
    }

    // Every key failed for this model
    throw lastError ?? new Error("[Pravah] All OpenRouter keys failed.");
  }

  /**
   * High-level call that tries primaryModel first, then fallbackModel if all
   * keys are exhausted on the primary.
   */
  private async withFallback<TResult>(
    fn: (client: OpenAIClient) => Promise<TResult>
  ): Promise<TResult> {
    const deadline = Date.now() + this.overallTimeoutMs;
    try {
      return await this.tryAllKeys(this.primaryModel, fn, deadline);
    } catch (primaryErr: unknown) {
      const unavailable = primaryErr instanceof ModelUnavailableError;
      if (!unavailable && !isRateLimitError(primaryErr)) throw primaryErr;

      // Primary is unusable (exhausted on every key, or the model is gone) —
      // try the fallback model.
      if (this.fallbackModel && this.fallbackModel !== this.primaryModel) {
        console.warn(
          unavailable
            ? `[Pravah][Pool] Primary model "${this.primaryModel}" is unavailable on OpenRouter. ` +
                `Switching to fallback model "${this.fallbackModel}"...`
            : `[Pravah][Pool] Primary model "${this.primaryModel}" exhausted on all keys. ` +
                `Switching to fallback model "${this.fallbackModel}"...`
        );
        // Give the fallback model a fresh slice of budget if the primary
        // burned it all — otherwise it would be dead on arrival.
        return await this.tryAllKeys(
          this.fallbackModel,
          fn,
          Math.max(deadline, Date.now() + this.overallTimeoutMs / 2)
        );
      }

      throw primaryErr;
    }
  }

  // -------------------------------------------------------------------------
  // PravahLLM interface
  // -------------------------------------------------------------------------

  async invoke(
    messages: PravahMessage[],
    options?: PravahInvokeOptions
  ): Promise<{
    role: "assistant";
    content: string | PravahContentPart[];
    toolCalls?: Array<{ id?: string; name: string; arguments: unknown }>;
    usage?: { inputTokens?: number; outputTokens?: number };
  }> {
    return this.withFallback((client) => client.invoke(messages, options));
  }

  async invokeStructured<TSchema extends z.ZodTypeAny>(
    request: StructuredOutputRequest<TSchema>,
    messages: PravahMessage[]
  ): Promise<PravahStructuredResult<TSchema>> {
    return this.withFallback((client) =>
      client.invokeStructured(request, messages)
    );
  }

  getProviderId(): string {
    return "openrouter";
  }

  getModelId(): string {
    return this.primaryModel;
  }

  getCapabilities(): PravahCapabilities {
    return {
      multimodal: true, // primary/fallback models are vision-capable
      toolCalling: true,
      jsonMode: true, // Supports response_format json_schema via OpenRouter
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createOpenRouterPoolClient(
  config: OpenRouterPoolConfig
): OpenRouterPoolClient {
  return new OpenRouterPoolClient(config);
}
