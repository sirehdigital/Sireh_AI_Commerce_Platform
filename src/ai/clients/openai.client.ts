/**
 * Project: Sireh AI Commerce Platform
 * Module: OpenAI Client
 * Sprint: SAI-03.04
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

import OpenAI from "openai";
import { env } from "../../config/env.js";
import type {
  AiGenerateTextInput,
  AiGenerateTextOutput,
  AiTextProvider,
} from "../types/ai-engine.types.js";

export class OpenAiClient implements AiTextProvider {
  readonly name = "openai" as const;

  private readonly client: OpenAI;

  private readonly model = "gpt-5.5";

  constructor() {
    this.client = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  async generateText(
    input: AiGenerateTextInput,
  ): Promise<AiGenerateTextOutput> {
    const response = await this.client.responses.create({
      model: this.model,
      input: input.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      temperature: input.temperature ?? 0.7,
      max_output_tokens: input.maxTokens ?? 1200,
    });

    return {
      provider: this.name,
      content: response.output_text,
    };
  }
}

