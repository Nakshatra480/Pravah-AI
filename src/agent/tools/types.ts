import { AgentActionDefinition } from "@/types/agent/actions/types";
import { MCPClient } from "../mcp/client";
import { PravahLLM } from "@/llm/types";
import { PravahVariable } from "@/types/agent/types";
import { Page } from "playwright-core";

export interface AgentCtx {
  mcpClient?: MCPClient;
  debugDir?: string;
  debug?: boolean;
  variables: Record<string, PravahVariable>;
  actions: Array<AgentActionDefinition>;
  tokenLimit: number;
  llm: PravahLLM;
  cdpActions?: boolean;
  schemaErrors?: Array<{
    stepIndex: number;
    error: string;
    rawResponse: string;
  }>;
  activePage?: () => Promise<Page>;
}
