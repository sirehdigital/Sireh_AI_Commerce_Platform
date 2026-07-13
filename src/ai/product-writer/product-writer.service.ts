/**
 * Project: Sireh AI Commerce Platform
 * Module: AI Product Writer Service
 * Sprint: SAI-03A.08
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

import { jsonParserService } from "../services/json-parser.service.js";
import { aiOrchestratorService } from "../services/ai-orchestrator.service.js";
import { responseValidatorService } from "../services/response-validator.service.js";
import { promptEngine } from "../prompts/prompt-engine.js";
import { buildProductWriterPrompt } from "./product-writer.prompt.js";
import type {
  ProductWriterInput,
  ProductWriterOutput,
  ProductWriterService,
} from "./product-writer.types.js";

const requiredStringFields = [
  "title",
  "shortDescription",
  "longDescription",
  "seoTitle",
  "metaDescription",
  "callToAction",
];

const requiredStringArrayFields = ["tags", "benefits"];

function getString(data: Record<string, unknown>, key: string): string {
  const value = data[key];

  if (typeof value !== "string") {
    throw new Error(`${key} must be a string.`);
  }

  return value;
}

function getStringArray(data: Record<string, unknown>, key: string): string[] {
  const value = data[key];

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${key} must be a string array.`);
  }

  return value;
}

export class AiProductWriterService implements ProductWriterService {
  async generateProductCopy(input: ProductWriterInput): Promise<ProductWriterOutput> {
    const messages = promptEngine.buildMessages({
      systemInstruction:
        "You are Sireh AI Product Genius, an expert Shopify ecommerce copywriter. Always return valid JSON only.",
      userInstruction: buildProductWriterPrompt(input),
    });

    const aiResponse = await aiOrchestratorService.generateText({
      messages,
      temperature: 0.7,
      maxTokens: 1200,
    });

    const parsed = jsonParserService.parseObject<Record<string, unknown>>(
      aiResponse.content,
    );

    const stringValidation =
      responseValidatorService.validateRequiredStringFields(
        parsed,
        requiredStringFields,
      );

    if (!stringValidation.valid) {
      throw new Error(stringValidation.errors.join(" "));
    }

    const arrayValidation =
      responseValidatorService.validateRequiredStringArrayFields(
        parsed,
        requiredStringArrayFields,
      );

    if (!arrayValidation.valid) {
      throw new Error(arrayValidation.errors.join(" "));
    }

    return {
      title: getString(parsed, "title"),
      shortDescription: getString(parsed, "shortDescription"),
      longDescription: getString(parsed, "longDescription"),
      seoTitle: getString(parsed, "seoTitle"),
      metaDescription: getString(parsed, "metaDescription"),
      tags: getStringArray(parsed, "tags"),
      benefits: getStringArray(parsed, "benefits"),
      callToAction: getString(parsed, "callToAction"),
    };
  }
}

export const productWriterService: ProductWriterService =
  new AiProductWriterService();

  