/**
 * Project: Sireh AI Commerce Platform
 * Module: Prompt Engine
 * Sprint: SAI-03.05
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

export interface PromptMessage {
  role: "system" | "user";
  content: string;
}

export interface BuildPromptInput {
  systemInstruction: string;
  userInstruction: string;
}

export class PromptEngine {
  buildMessages(input: BuildPromptInput): PromptMessage[] {
    return [
      {
        role: "system",
        content: input.systemInstruction.trim(),
      },
      {
        role: "user",
        content: input.userInstruction.trim(),
      },
    ];
  }
}

export const promptEngine = new PromptEngine();

