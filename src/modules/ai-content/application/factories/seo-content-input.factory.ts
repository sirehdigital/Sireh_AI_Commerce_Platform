import type { SEOContentGenerationInput } from "../dto/seo-content.types.js";
import { MissingSEOSourceError } from "../errors/product-content.errors.js";

export class SEOContentInputFactory {
  public create(input: SEOContentGenerationInput): SEOContentGenerationInput {
    const productId = input.productId.trim();
    const productTitle = normalizeText(input.productTitle);

    if (productId.length === 0) {
      throw new MissingSEOSourceError("SEO content generation requires a product ID.");
    }

    if (productTitle.length === 0) {
      throw new MissingSEOSourceError("SEO content generation requires a product title.");
    }

    return {
      productId,
      productTitle,
      ...(input.productSubtitle === undefined ? {} : { productSubtitle: normalizeText(input.productSubtitle) }),
      ...(input.brand === undefined ? {} : { brand: normalizeText(input.brand) }),
      ...(input.category === undefined ? {} : { category: normalizeText(input.category) }),
      ...(input.productType === undefined ? {} : { productType: normalizeText(input.productType) }),
      ...(input.productDescription === undefined
        ? {}
        : { productDescription: normalizeText(input.productDescription) }),
      benefits: normalizeList(input.benefits ?? []),
      features: normalizeList(input.features ?? []),
      tags: normalizeList(input.tags ?? []),
      targetMarkets: normalizeList(input.targetMarkets ?? []),
      productKeywords: normalizeList(input.productKeywords ?? []),
      productRiskFlags: normalizeList(input.productRiskFlags ?? []),
      ...(input.productContentPackage === undefined
        ? {}
        : { productContentPackage: input.productContentPackage }),
      ...(input.marketingAudience === undefined
        ? {}
        : {
            marketingAudience: {
              ...input.marketingAudience,
              customerProblems: normalizeList(input.marketingAudience.customerProblems ?? []),
              purchaseMotivations: normalizeList(input.marketingAudience.purchaseMotivations ?? []),
            },
          }),
      ...(input.customerPersona === undefined ? {} : { customerPersona: normalizeText(input.customerPersona) }),
      ...(input.marketingAngles === undefined
        ? {}
        : {
            marketingAngles: input.marketingAngles.map((angle) => ({
              title: normalizeText(angle.title),
              ...(angle.hook === undefined ? {} : { hook: normalizeText(angle.hook) }),
              ...(angle.coreBenefit === undefined
                ? {}
                : { coreBenefit: normalizeText(angle.coreBenefit) }),
              ...(angle.targetAudience === undefined
                ? {}
                : { targetAudience: normalizeText(angle.targetAudience) }),
            })),
          }),
      ...(input.valueProposition === undefined ? {} : { valueProposition: normalizeText(input.valueProposition) }),
      ...(input.searchIntentHints === undefined ? {} : { searchIntentHints: [...input.searchIntentHints] }),
      ...(input.preferredLanguage === undefined ? {} : { preferredLanguage: input.preferredLanguage }),
      ...(input.targetChannel === undefined ? {} : { targetChannel: input.targetChannel }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId.trim() }),
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId.trim() }),
      ...(input.sourceMarketingAnalysisId === undefined
        ? {}
        : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId.trim() }),
      ...(input.templateId === undefined ? {} : { templateId: input.templateId.trim() }),
    };
  }
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function normalizeList(values: readonly string[]): readonly string[] {
  return [...new Set(values.map(normalizeText).filter((value) => value.length > 0))];
}
