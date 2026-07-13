import { SEOKeyword } from "../../domain/index.js";
import type {
  SEOContentGenerationInput,
  SEOContentGenerationOptions,
  SEOKeywordSet,
} from "../dto/seo-content.types.js";

const FILLER_WORDS = new Set(["the", "and", "for", "with", "a", "an", "to", "of"]);

export class SEOKeywordSetFactory {
  public create(input: SEOContentGenerationInput, options: SEOContentGenerationOptions): SEOKeywordSet {
    const primary = this.primaryKeyword(input, options);
    const candidates = [
      ...(input.productKeywords ?? []),
      input.productType ?? "",
      input.category ?? "",
      ...(input.tags ?? []),
      ...(input.benefits ?? []),
      ...(input.productContentPackage?.shopifyReady.benefits ?? []),
    ];
    const secondary = this.unique(candidates)
      .filter((keyword) => keyword.toLowerCase() !== primary.toLowerCase())
      .slice(0, options.maxSecondaryKeywords)
      .map((keyword) => SEOKeyword.create(keyword));
    const longTail = this.unique([
      `${input.productType ?? input.category ?? primary} for ${this.audience(input)}`,
      `${primary} for ${options.targetMarket ?? input.targetMarkets?.[0] ?? "online shoppers"}`,
      `${primary} ${this.intentPhrase(options.searchIntent)}`,
      ...(input.valueProposition === undefined ? [] : [`${primary} ${input.valueProposition}`]),
    ])
      .slice(0, options.maxLongTailKeywords)
      .map((keyword) => SEOKeyword.create(keyword));
    const semanticVariants = this.unique([
      primary.replace(/\bbrush\b/iu, "tool"),
      `${input.category ?? input.productType ?? primary} product`,
      ...(input.benefits ?? []).map((benefit) => `${primary} ${benefit}`),
    ])
      .filter((keyword) => keyword.toLowerCase() !== primary.toLowerCase())
      .slice(0, 6)
      .map((keyword) => SEOKeyword.create(keyword));

    return {
      primaryKeyword: SEOKeyword.create(primary),
      secondaryKeywords: secondary,
      longTailKeywords: longTail,
      semanticVariants,
    };
  }

  private primaryKeyword(input: SEOContentGenerationInput, options: SEOContentGenerationOptions): string {
    if (options.preferredPrimaryKeyword !== undefined && options.preferredPrimaryKeyword.length > 0) {
      return options.preferredPrimaryKeyword;
    }

    const identity = input.productType ?? input.category ?? input.productTitle;
    const brandPrefix =
      input.brand === undefined || identity.toLowerCase().includes(input.brand.toLowerCase())
        ? ""
        : `${input.brand} `;

    return `${brandPrefix}${this.compact(identity)}`.trim();
  }

  private compact(value: string): string {
    const words = value
      .trim()
      .split(/\s+/u)
      .filter((word) => !FILLER_WORDS.has(word.toLowerCase()));

    return words.slice(0, 5).join(" ");
  }

  private audience(input: SEOContentGenerationInput): string {
    return input.marketingAudience?.primaryAudience ?? input.customerPersona ?? "customers";
  }

  private intentPhrase(intent: SEOContentGenerationOptions["searchIntent"]): string {
    if (intent === "transactional") {
      return "buy online";
    }

    if (intent === "informational") {
      return "guide";
    }

    if (intent === "comparison") {
      return "comparison";
    }

    return "product";
  }

  private unique(values: readonly string[]): readonly string[] {
    return [
      ...new Set(
        values
          .map((value) => value.trim().replace(/\s+/gu, " "))
          .filter((value) => value.length >= 3),
      ),
    ];
  }
}
