import type { SEOContentGenerationInput, SEOSearchIntent } from "../dto/seo-content.types.js";

export class SEOSearchIntentService {
  public infer(input: SEOContentGenerationInput, explicitIntent?: SEOSearchIntent): SEOSearchIntent {
    if (explicitIntent !== undefined) {
      return explicitIntent;
    }

    const hintedIntent = input.searchIntentHints?.[0];
    if (hintedIntent !== undefined) {
      return hintedIntent;
    }

    const text = [
      input.productTitle,
      input.category ?? "",
      input.productType ?? "",
      ...(input.tags ?? []),
      ...(input.marketingAngles ?? []).map((angle) => angle.title),
    ].join(" ").toLowerCase();

    if (/\b(compare|vs|alternative)\b/u.test(text)) {
      return "comparison";
    }

    if (/\b(buy|shop|order|price)\b/u.test(text)) {
      return "transactional";
    }

    if (input.valueProposition !== undefined || (input.benefits ?? []).length > 0) {
      return "commercial";
    }

    return "informational";
  }
}
