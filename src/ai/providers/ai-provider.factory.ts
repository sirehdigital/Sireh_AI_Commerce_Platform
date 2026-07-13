/**
 * Project: Sireh AI Commerce Platform
 * Module: AI Provider Factory
 * Sprint: SAI-03.11
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

import { MockAiClient } from "../clients/mock-ai.client.js";
import { OpenAiClient } from "../clients/openai.client.js";
import type { AiTextProvider } from "../types/ai-engine.types.js";

export function createAiProvider(): AiTextProvider {
  const provider =
    (process.env.AI_PROVIDER ?? "mock").toLowerCase();

  switch (provider) {
    case "openai":
      return new OpenAiClient();

    case "mock":
    default:
      return new MockAiClient();
  }
}
