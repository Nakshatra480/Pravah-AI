/**
 * # Pravah Cloud Provider Example
 *
 * This example demonstrates how to configure and use PravahAgent with the Pravah Cloud
 * provider for web browsing tasks with proxy support.
 *
 * ## What This Example Does
 *
 * The agent performs a simple web search task that:
 * 1. Configures PravahAgent with Pravah Cloud-specific settings
 * 2. Enables proxy support for enhanced privacy and reliability
 * 3. Searches for and extracts specific information about a movie release date
 *
 * ## Prerequisites
 *
 * 1. Node.js environment
 * 2. OpenAI API key set in your .env file (OPENAI_API_KEY)
 *
 * ## Running the Example
 *
 * ```bash
 * yarn ts-node examples/browser-providers/pravah-cloud.ts
 * ```
 */

import "dotenv/config";
import { PravahAgent } from "@pravah/agent";
// Removed LangChain import - using native SDK configuration
import chalk from "chalk";

async function runEval() {
  const agent = new PravahAgent({
    llm: {
      provider: "openai",
      model: "gpt-4o",
    },
    debug: true,
    browserProvider: "Cloud",
    cloudConfig: {
      sessionConfig: {
        useProxy: true,
      },
    },
  });
  const result = await agent.executeTask(
    "Find the initial release date for Guardians of the Galaxy Vol. 3 the movie",
    {
      debugOnAgentOutput: (agentOutput) => {
        console.log("\n" + chalk.cyan.bold("===== AGENT OUTPUT ====="));
        console.dir(agentOutput, { depth: null, colors: true });
        console.log(chalk.cyan.bold("===============") + "\n");
      },
      onStep: (step) => {
        console.log("\n" + chalk.cyan.bold(`===== STEP ${step.idx} =====`));
        console.dir(step, { depth: null, colors: true });
        console.log(chalk.cyan.bold("===============") + "\n");
      },
    }
  );
  await agent.closeAgent();
  console.log(chalk.green.bold("\nResult:"));
  console.log(chalk.white(result.output));
  return result;
}

(async () => {
  await runEval();
})().catch((error) => {
  console.error(chalk.red("Error:"), error);
  process.exit(1);
});
