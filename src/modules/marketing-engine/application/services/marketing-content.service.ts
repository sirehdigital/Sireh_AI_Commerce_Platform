import { MarketingEngineValidationError } from "../../domain/errors/marketing-engine.errors.js";
import type {
  MarketingContent,
  MarketingContentInput,
} from "../../domain/models/marketing-content.model.js";

const SEO_TITLE_MAX_LENGTH = 60;
const SEO_DESCRIPTION_MAX_LENGTH = 155;
const PRODUCT_TAG_LIMIT = 12;

const UNSUPPORTED_CLAIM_REPLACEMENTS: readonly [RegExp, string][] = [
  [/\bguaranteed\b/giu, "designed"],
  [/\bguarantee\b/giu, "support"],
  [/\bcure(s|d)?\b/giu, "support"],
  [/\btreat(s|ed|ing)?\s+disease\b/giu, "support everyday use"],
  [/\bclinically\s+proven\b/giu, "carefully designed"],
  [/\bdoctor\s+approved\b/giu, "thoughtfully designed"],
  [/\bfda\s+approved\b/giu, "quality-focused"],
  [/\bmiracle\b/giu, "practical"],
  [/\binstant\s+results\b/giu, "a simple routine"],
  [/\bpermanent\s+results\b/giu, "lasting everyday value"],
  [/\b100%\s+effective\b/giu, "useful"],
  [/\brisk-free\b/giu, "simple"],
];

export class MarketingContentService {
  public generate(input: MarketingContentInput): MarketingContent {
    const normalized = this.normalizeInput(input);
    const productContext = normalized.productType ?? normalized.category ?? "product";
    const primaryBenefit = this.firstValue(normalized.keyBenefits, "everyday value");
    const supportingBenefit = this.firstValue(normalized.keyBenefits.slice(1), primaryBenefit);
    const primaryFeature = this.firstValue(normalized.features, `thoughtful ${productContext.toLowerCase()} design`);
    const callToAction = this.buildCallToAction(normalized);
    const productDescription = this.buildProductDescription(
      normalized,
      productContext,
      primaryBenefit,
      supportingBenefit,
      primaryFeature,
      callToAction,
    );

    return {
      productTitle: normalized.productTitle,
      productDescription,
      seoTitle: this.buildSeoTitle(normalized, productContext),
      seoDescription: this.buildSeoDescription(normalized, productContext, primaryBenefit),
      productTags: this.buildProductTags(normalized, productContext),
      facebookCaption: this.buildFacebookCaption(normalized, primaryBenefit, callToAction),
      instagramCaption: this.buildInstagramCaption(normalized, primaryBenefit, supportingBenefit),
      tiktokCaption: this.buildTiktokCaption(normalized, primaryBenefit),
      emailSubject: this.buildEmailSubject(normalized, primaryBenefit),
      emailBody: this.buildEmailBody(normalized, productContext, primaryBenefit, primaryFeature, callToAction),
      callToAction,
    };
  }

  private normalizeInput(input: MarketingContentInput): MarketingContentInput {
    const productTitle = this.normalizeRequiredText(input.productTitle, "Product title is required.");
    const targetAudience = this.normalizeRequiredText(input.targetAudience, "Target audience is required.");
    const brandName = this.normalizeRequiredText(input.brandName, "Brand name is required.");
    const targetMarket = this.normalizeRequiredText(input.targetMarket, "Target market is required.");
    const tone = this.normalizeRequiredText(input.tone, "Marketing tone is required.");
    const keyBenefits = this.normalizeList(input.keyBenefits);

    if (keyBenefits.length === 0) {
      throw new MarketingEngineValidationError("At least one key benefit is required.");
    }

    return {
      productTitle,
      ...this.optionalText("productType", input.productType),
      ...this.optionalText("category", input.category),
      keyBenefits,
      features: this.normalizeList(input.features),
      targetAudience,
      brandName,
      targetMarket,
      keywords: this.normalizeList(input.keywords),
      tone,
      ...this.optionalText("productUrl", input.productUrl),
    };
  }

  private buildProductDescription(
    input: MarketingContentInput,
    productContext: string,
    primaryBenefit: string,
    supportingBenefit: string,
    primaryFeature: string,
    callToAction: string,
  ): string {
    return this.ensureNonEmpty(
      this.sanitizeClaims(
        `${input.productTitle} helps ${input.targetAudience.toLowerCase()} enjoy ${primaryBenefit.toLowerCase()} with ${supportingBenefit.toLowerCase()}. This ${productContext.toLowerCase()} keeps the value clear first, then supports it with ${primaryFeature}. ${callToAction}`,
      ),
      input.productTitle,
    );
  }

  private buildSeoTitle(input: MarketingContentInput, productContext: string): string {
    return this.truncateText(
      this.sanitizeClaims(`${input.productTitle} | ${productContext} for ${input.targetMarket}`),
      SEO_TITLE_MAX_LENGTH,
    );
  }

  private buildSeoDescription(
    input: MarketingContentInput,
    productContext: string,
    primaryBenefit: string,
  ): string {
    return this.truncateText(
      this.sanitizeClaims(
        `${input.productTitle} from ${input.brandName} helps ${input.targetAudience.toLowerCase()} get ${primaryBenefit.toLowerCase()} from a practical ${productContext.toLowerCase()}.`,
      ),
      SEO_DESCRIPTION_MAX_LENGTH,
    );
  }

  private buildProductTags(input: MarketingContentInput, productContext: string): readonly string[] {
    return this.normalizeList([
      input.brandName,
      input.targetMarket,
      productContext,
      ...input.keyBenefits,
      ...input.keywords,
    ])
      .map((tag) => tag.toLowerCase())
      .slice(0, PRODUCT_TAG_LIMIT);
  }

  private buildFacebookCaption(
    input: MarketingContentInput,
    primaryBenefit: string,
    callToAction: string,
  ): string {
    return this.sanitizeClaims(
      `${input.productTitle} is made for ${input.targetAudience.toLowerCase()} who want ${primaryBenefit.toLowerCase()} without overcomplicating the routine. ${callToAction}`,
    );
  }

  private buildInstagramCaption(
    input: MarketingContentInput,
    primaryBenefit: string,
    supportingBenefit: string,
  ): string {
    return this.sanitizeClaims(
      `${input.productTitle}: ${primaryBenefit}. ${supportingBenefit}. Built for ${input.targetAudience.toLowerCase()} by ${input.brandName}.`,
    );
  }

  private buildTiktokCaption(input: MarketingContentInput, primaryBenefit: string): string {
    return this.sanitizeClaims(
      `A quick look at ${input.productTitle}: designed for ${input.targetAudience.toLowerCase()} who want ${primaryBenefit.toLowerCase()}.`,
    );
  }

  private buildEmailSubject(input: MarketingContentInput, primaryBenefit: string): string {
    return this.truncateText(
      this.sanitizeClaims(`${input.productTitle}: ${primaryBenefit} for ${input.targetAudience}`),
      78,
    );
  }

  private buildEmailBody(
    input: MarketingContentInput,
    productContext: string,
    primaryBenefit: string,
    primaryFeature: string,
    callToAction: string,
  ): string {
    const urlLine = input.productUrl === undefined ? "" : `\n\nSee product details: ${input.productUrl}`;

    return this.sanitizeClaims(
      `Hi there,\n\nMeet ${input.productTitle} from ${input.brandName}. It is a ${productContext.toLowerCase()} selected for ${input.targetAudience.toLowerCase()} who care about ${primaryBenefit.toLowerCase()}.\n\nThe main promise is simple: start with the customer benefit, then support it with useful details like ${primaryFeature.toLowerCase()}.\n\n${callToAction}${urlLine}`,
    );
  }

  private buildCallToAction(input: MarketingContentInput): string {
    const action = input.productUrl === undefined ? "Explore it today." : `Explore it here: ${input.productUrl}`;

    if (input.tone.toLowerCase() === "premium") {
      return input.productUrl === undefined ? "Discover the details today." : `Discover the details here: ${input.productUrl}`;
    }

    if (input.tone.toLowerCase() === "expert") {
      return input.productUrl === undefined ? "Review the product details today." : `Review the product details here: ${input.productUrl}`;
    }

    return action;
  }

  private normalizeRequiredText(value: string, message: string): string {
    const normalized = this.normalizeText(value);

    if (normalized.length === 0) {
      throw new MarketingEngineValidationError(message);
    }

    return this.sanitizeClaims(normalized);
  }

  private optionalText<Key extends "productType" | "category" | "productUrl">(
    key: Key,
    value: string | undefined,
  ): Pick<MarketingContentInput, Key> | Record<string, never> {
    const normalized = this.normalizeText(value);

    return normalized.length === 0 ? {} : { [key]: this.sanitizeClaims(normalized) } as Pick<MarketingContentInput, Key>;
  }

  private normalizeList(values: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const normalizedValues: string[] = [];

    for (const value of values) {
      const normalized = this.sanitizeClaims(this.normalizeText(value));
      const dedupeKey = normalized.toLowerCase();

      if (normalized.length > 0 && !seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        normalizedValues.push(normalized);
      }
    }

    return normalizedValues;
  }

  private normalizeText(value: string | undefined): string {
    return value?.replace(/\r\n?/gu, "\n").replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim() ?? "";
  }

  private sanitizeClaims(value: string): string {
    return UNSUPPORTED_CLAIM_REPLACEMENTS.reduce(
      (safeValue, [pattern, replacement]) => safeValue.replace(pattern, replacement),
      value,
    );
  }

  private truncateText(value: string, maxLength: number): string {
    const normalized = this.normalizeText(value);

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return this.ensureSentenceEnding(normalized.slice(0, maxLength).replace(/\s+\S*$/u, "").trim());
  }

  private ensureSentenceEnding(value: string): string {
    if (value.length === 0 || /[.!?]$/u.test(value)) {
      return value;
    }

    return `${value}.`;
  }

  private firstValue(values: readonly string[], fallback: string): string {
    return values[0] ?? fallback;
  }

  private ensureNonEmpty(value: string, fallback: string): string {
    const normalized = this.normalizeText(value);

    return normalized.length === 0 ? fallback : normalized;
  }
}
