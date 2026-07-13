/**
 * Project: Sireh AI Commerce Platform
 * Module: AI Product Writer Prompt
 * Sprint: SAI-03A.02
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

import type { ProductWriterInput } from "./product-writer.types.js";

export function buildProductWriterPrompt(input: ProductWriterInput): string {
  const keywords = input.keywords?.length ? input.keywords.join(", ") : "none";

  return `
You are an expert ecommerce copywriter for Shopify stores.

Create high-converting product copy using AIDA principles.

Product name: ${input.productName}
Product type: ${input.productType ?? "general ecommerce product"}
Target market: ${input.targetMarket ?? "United States, United Kingdom, Australia, and Canada"}
Tone: ${input.tone ?? "premium"}
Language: ${input.language ?? "en"}
SEO keywords: ${keywords}

Return ONLY valid JSON with this exact structure:
{
  "title": "string",
  "shortDescription": "string",
  "longDescription": "string",
  "seoTitle": "string",
  "metaDescription": "string",
  "tags": ["string"],
  "benefits": ["string"],
  "callToAction": "string"
}

Rules:
- Do not include markdown.
- Do not include explanation.
- Do not use fake claims.
- Focus on benefits and customer outcome.
- Keep it clear, premium, and conversion-focused.
`.trim();
}

