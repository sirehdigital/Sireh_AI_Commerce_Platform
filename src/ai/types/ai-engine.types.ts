/**
 * Project: Sireh AI Commerce Platform
 * Module: AI Engine Types
 * Sprint: SAI-03.01
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

export type AiProviderName = "mock" | "openai";

export type AiMessageRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiGenerateTextInput {
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiGenerateTextOutput {
  provider: AiProviderName;
  content: string;
}

export interface AiTextProvider {
  readonly name: AiProviderName;
  generateText(input: AiGenerateTextInput): Promise<AiGenerateTextOutput>;
}



