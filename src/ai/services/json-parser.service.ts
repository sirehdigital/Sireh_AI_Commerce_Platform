/**
 * Project: Sireh AI Commerce Platform
 * Module: JSON Parser Service
 * Sprint: SAI-03.06
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

export class JsonParserService {
  parseObject<TOutput extends Record<string, unknown>>(rawText: string): TOutput {
    const cleanedText = this.cleanJsonText(rawText);

    const parsed: unknown = JSON.parse(cleanedText);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Parsed JSON must be an object.");
    }

    return parsed as TOutput;
  }

  private cleanJsonText(rawText: string): string {
    const trimmed = rawText.trim();

    if (trimmed.startsWith("```json") && trimmed.endsWith("```")) {
      return trimmed.slice(7, -3).trim();
    }

    if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
      return trimmed.slice(3, -3).trim();
    }

    return trimmed;
  }
}

export const jsonParserService = new JsonParserService();

