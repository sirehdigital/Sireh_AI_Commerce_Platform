/**
 * Project: Sireh AI Commerce Platform
 * Module: Mock AI Client
 * Sprint: SAI-03.02
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

import type {
  AiGenerateTextInput,
  AiGenerateTextOutput,
  AiTextProvider,
} from "../types/ai-engine.types.js";

export class MockAiClient implements AiTextProvider {
  readonly name = "mock" as const;

  generateText(input: AiGenerateTextInput): Promise<AiGenerateTextOutput> {
    const lastMessage = input.messages.at(-1)?.content ?? "No prompt provided.";

    return Promise.resolve({
      provider: this.name,
      content: `MOCK_AI_RESPONSE: ${lastMessage}`,
    });
  }
}

