import type {
  ProductContentGenerationOptions,
  ProductContentGenerationOptionsInput,
} from "../dto/product-content.types.js";
import {
  UnsupportedContentLanguageError,
  UnsupportedProductContentChannelError,
} from "../errors/product-content.errors.js";

const SUPPORTED_LANGUAGES = ["en", "ms"] as const;
const SUPPORTED_CHANNELS = ["shopify", "website", "generic"] as const;

export class ProductContentOptionsFactory {
  public create(
    input: ProductContentGenerationOptionsInput = {},
  ): ProductContentGenerationOptions {
    const language = input.language ?? "en";
    const channel = input.channel ?? "shopify";

    if (!SUPPORTED_LANGUAGES.includes(language as (typeof SUPPORTED_LANGUAGES)[number])) {
      throw new UnsupportedContentLanguageError(language);
    }

    if (!SUPPORTED_CHANNELS.includes(channel as (typeof SUPPORTED_CHANNELS)[number])) {
      throw new UnsupportedProductContentChannelError(channel);
    }

    return {
      tone: input.tone ?? "friendly",
      language,
      channel,
      desiredLength: input.desiredLength ?? "standard",
      benefitCount: clampInteger(input.benefitCount ?? 4, 1, 8),
      featureCount: clampInteger(input.featureCount ?? 5, 1, 10),
      faqCount: clampInteger(input.faqCount ?? 4, 0, 8),
      ctaCount: clampInteger(input.ctaCount ?? 3, 1, 5),
      includeUsageGuidance: input.includeUsageGuidance ?? true,
      includeObjectionHandling: input.includeObjectionHandling ?? true,
      includeTrustContent: input.includeTrustContent ?? true,
      strictClaimSafety: input.strictClaimSafety ?? true,
      ...(input.templateId === undefined ? {} : { templateId: input.templateId.trim() }),
    };
  }
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}
