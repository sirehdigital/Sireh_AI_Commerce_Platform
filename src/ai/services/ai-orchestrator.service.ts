/**
 * Project: Sireh AI Commerce Platform
 * Module: AI Orchestrator Service
 * Sprint: SAI-03.12
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

import { createAiProvider } from "../providers/ai-provider.factory.js";
import type {
  AiGenerateTextInput,
  AiGenerateTextOutput,
  AiTextProvider,
} from "../types/ai-engine.types.js";

export class AiOrchestratorService {
  constructor(
    private readonly provider: AiTextProvider,
  ) {}

  generateText(
    input: AiGenerateTextInput,
  ): Promise<AiGenerateTextOutput> {
    return this.provider.generateText(input);
  }
}

export const aiOrchestratorService =
  new AiOrchestratorService(
    createAiProvider(),
  );

  