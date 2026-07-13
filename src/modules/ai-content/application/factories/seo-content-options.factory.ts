import { CONTENT_VALUE_LIMITS } from "../../domain/index.js";
import type {
  SEOContentGenerationOptions,
  SEOContentGenerationOptionsInput,
  SEOSearchIntent,
} from "../dto/seo-content.types.js";
import {
  UnsupportedSEOChannelError,
  UnsupportedSEOLanguageError,
  UnsupportedSearchIntentError,
} from "../errors/product-content.errors.js";

const SUPPORTED_LANGUAGES = ["en", "ms"] as const;
const SUPPORTED_CHANNELS = ["shopify", "website", "generic"] as const;
const SUPPORTED_INTENTS: readonly SEOSearchIntent[] = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
  "local",
  "comparison",
];

export class SEOContentOptionsFactory {
  public create(input: SEOContentGenerationOptionsInput = {}): SEOContentGenerationOptions {
    const language = input.language ?? "en";
    const channel = input.channel ?? "shopify";
    const searchIntent = input.searchIntent ?? "commercial";

    if (!SUPPORTED_LANGUAGES.includes(language as (typeof SUPPORTED_LANGUAGES)[number])) {
      throw new UnsupportedSEOLanguageError(language);
    }

    if (!SUPPORTED_CHANNELS.includes(channel as (typeof SUPPORTED_CHANNELS)[number])) {
      throw new UnsupportedSEOChannelError(channel);
    }

    if (!SUPPORTED_INTENTS.includes(searchIntent)) {
      throw new UnsupportedSearchIntentError(searchIntent);
    }

    return {
      language,
      channel,
      searchIntent,
      maxSecondaryKeywords: clampInteger(input.maxSecondaryKeywords ?? 6, 1, 12),
      maxLongTailKeywords: clampInteger(input.maxLongTailKeywords ?? 5, 0, 10),
      metaTitleMaxLength: clampInteger(
        input.metaTitleMaxLength ?? CONTENT_VALUE_LIMITS.metaTitleMaxLength,
        20,
        CONTENT_VALUE_LIMITS.metaTitleMaxLength,
      ),
      metaDescriptionMaxLength: clampInteger(
        input.metaDescriptionMaxLength ?? CONTENT_VALUE_LIMITS.metaDescriptionMaxLength,
        80,
        CONTENT_VALUE_LIMITS.metaDescriptionMaxLength,
      ),
      slugStrategy: input.slugStrategy ?? "primary-keyword",
      includeImageAltText: input.includeImageAltText ?? true,
      includeInternalLinks: input.includeInternalLinks ?? true,
      includeCanonical: input.includeCanonical ?? true,
      strictKeywordSafety: input.strictKeywordSafety ?? true,
      strictClaimSafety: input.strictClaimSafety ?? true,
      ...(input.targetMarket === undefined ? {} : { targetMarket: input.targetMarket.trim() }),
      ...(input.preferredPrimaryKeyword === undefined
        ? {}
        : { preferredPrimaryKeyword: input.preferredPrimaryKeyword.trim() }),
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
