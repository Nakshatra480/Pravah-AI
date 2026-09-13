import { AgentActionDefinition } from "@/types/agent/actions/types";
import { z } from "zod";

export type PravahRole = "system" | "user" | "assistant" | "tool";

export type PravahTextPart = {
  type: "text";
  text: string;
};

export type PravahImagePart = {
  type: "image";
  /** data URL or remote URL */
  url: string;
  /** optional mime type when using data URLs */
  mimeType?: string;
};

export type PravahToolPart = {
  type: "tool_call";
  toolName: string;
  arguments: unknown;
};

export type PravahContentPart =
  | PravahTextPart
  | PravahImagePart
  | PravahToolPart;

export type PravahMessage =
  | {
      role: Extract<PravahRole, "system" | "user">;
      content: string | PravahContentPart[];
    }
  | {
      role: Extract<PravahRole, "assistant">;
      content: string | PravahContentPart[];
      toolCalls?: Array<{ id?: string; name: string; arguments: unknown }>;
    }
  | {
      role: "tool";
      toolName: string;
      toolCallId?: string;
      content: string | PravahContentPart[];
    };

export type PravahCapabilities = {
  multimodal: boolean;
  toolCalling: boolean;
  jsonMode: boolean;
};

export type PravahInvokeOptions = {
  temperature?: number;
  maxTokens?: number;
  /** provider specific; passed through unmodified */
  providerOptions?: Record<string, unknown>;
};

export type StructuredOutputRequest<TSchema extends z.ZodTypeAny> = {
  schema: TSchema;
  /** hints to providers */
  hints?: {
    forceJson?: boolean;
    toolName?: string;
  };
  options?: PravahInvokeOptions;
  actions?: AgentActionDefinition[];
};

export type PravahStructuredResult<TSchema extends z.ZodTypeAny> = {
  rawText: string;
  parsed: z.infer<TSchema> | null;
};

export interface PravahLLM {
  invoke(
    messages: PravahMessage[],
    options?: PravahInvokeOptions
  ): Promise<{
    role: "assistant";
    content: string | PravahContentPart[];
    toolCalls?: Array<{ id?: string; name: string; arguments: unknown }>;
    usage?: { inputTokens?: number; outputTokens?: number };
  }>;

  invokeStructured<TSchema extends z.ZodTypeAny>(
    request: StructuredOutputRequest<TSchema>,
    messages: PravahMessage[]
  ): Promise<PravahStructuredResult<TSchema>>;

  getProviderId(): string;
  getModelId(): string;
  getCapabilities(): PravahCapabilities;
}
