import type { SocialMediaContentGenerationInput } from "../dto/social-media-content.types.js";
import { MissingSocialContentSourceError } from "../errors/product-content.errors.js";

export class SocialMediaContentInputFactory {
  public create(input: SocialMediaContentGenerationInput): SocialMediaContentGenerationInput {
    const productId = input.productId.trim();
    const productTitle = input.productTitle.trim();
    const productSubtitle = clean(input.productSubtitle);
    const brand = clean(input.brand);
    const category = clean(input.category);
    const productType = clean(input.productType);
    const productDescription = clean(input.productDescription);
    const usageInformation = clean(input.usageInformation);
    const customerPersona = clean(input.customerPersona);
    const customerSegment = clean(input.customerSegment);
    const valueProposition = clean(input.valueProposition);
    const campaignMessage = clean(input.campaignMessage);

    if (productId.length === 0) {
      throw new MissingSocialContentSourceError("Product ID is required for social content generation.");
    }

    if (productTitle.length === 0) {
      throw new MissingSocialContentSourceError("Product title is required for social content generation.");
    }

    return {
      productId,
      productTitle,
      ...(productSubtitle === undefined ? {} : { productSubtitle }),
      ...(brand === undefined ? {} : { brand }),
      ...(category === undefined ? {} : { category }),
      ...(productType === undefined ? {} : { productType }),
      ...(productDescription === undefined ? {} : { productDescription }),
      benefits: cleanList(input.benefits),
      features: cleanList(input.features),
      highlights: cleanList(input.highlights),
      tags: cleanList(input.tags),
      productRisks: cleanList(input.productRisks),
      ...(usageInformation === undefined ? {} : { usageInformation }),
      ...(input.productContentPackage === undefined ? {} : { productContentPackage: input.productContentPackage }),
      ...(input.seoContentPackage === undefined ? {} : { seoContentPackage: input.seoContentPackage }),
      ...(input.seoKeywordSet === undefined ? {} : { seoKeywordSet: input.seoKeywordSet }),
      ...(input.targetAudience === undefined ? {} : { targetAudience: input.targetAudience }),
      ...(customerPersona === undefined ? {} : { customerPersona }),
      ...(customerSegment === undefined ? {} : { customerSegment }),
      targetMarkets: cleanList(input.targetMarkets),
      ...(input.marketingAngles === undefined
        ? {}
        : {
            marketingAngles: input.marketingAngles.map((angle) => {
              const hook = clean(angle.hook);
              const coreBenefit = clean(angle.coreBenefit);
              const emotionalOutcome = clean(angle.emotionalOutcome);
              const targetAudience = clean(angle.targetAudience);

              return {
                title: angle.title.trim(),
                ...(hook === undefined ? {} : { hook }),
                ...(coreBenefit === undefined ? {} : { coreBenefit }),
                ...(emotionalOutcome === undefined ? {} : { emotionalOutcome }),
                ...(targetAudience === undefined ? {} : { targetAudience }),
              };
            }),
          }),
      ...(valueProposition === undefined ? {} : { valueProposition }),
      ...(input.campaignObjective === undefined ? {} : { campaignObjective: input.campaignObjective }),
      ...(campaignMessage === undefined ? {} : { campaignMessage }),
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.tone === undefined ? {} : { tone: input.tone }),
      ...(input.platform === undefined ? {} : { platform: input.platform }),
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
      ...(input.sourceMarketingAnalysisId === undefined
        ? {}
        : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
    };
  }
}

function clean(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function cleanList(values: readonly string[] | undefined): readonly string[] {
  return [...new Set((values ?? []).map((value) => clean(value)).filter((value): value is string => value !== undefined))];
}
