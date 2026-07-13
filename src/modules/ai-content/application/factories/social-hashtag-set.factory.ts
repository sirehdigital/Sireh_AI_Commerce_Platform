import type {
  SocialMediaContentGenerationInput,
  SocialMediaContentGenerationOptions,
} from "../dto/social-media-content.types.js";

export class SocialHashtagSetFactory {
  public create(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): readonly string[] {
    const sources = [
      input.brand,
      input.productType,
      input.category,
      ...firstWords(input.benefits, 3),
      ...firstWords(input.targetAudience?.purchaseMotivations, 2),
      ...firstWords(input.targetMarkets, 2),
      input.seoKeywordSet?.primaryKeyword.value,
      ...((input.seoKeywordSet?.secondaryKeywords ?? []).map((keyword) => keyword.value)),
      options.objective,
    ];

    return dedupe(
      sources
        .map((value) => toHashtag(value))
        .filter((value): value is string => value !== undefined)
        .filter((value) => !isUnsafeHashtag(value)),
    ).slice(0, options.hashtagCount);
  }
}

function firstWords(values: readonly string[] | undefined, count: number): readonly string[] {
  return (values ?? []).slice(0, count);
}

function toHashtag(value: string | undefined): string | undefined {
  const normalized = value
    ?.replace(/&/gu, " and ")
    .replace(/[^a-zA-Z0-9\s]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

  if (normalized === undefined || normalized.length < 2) {
    return undefined;
  }

  const pascal = normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");

  return pascal.length < 2 ? undefined : `#${pascal}`;
}

function isUnsafeHashtag(value: string): boolean {
  return /guaranteed|cure|treat|rank1|nearMe|discount|coupon|free|limited|best/iu.test(value);
}

function dedupe(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
