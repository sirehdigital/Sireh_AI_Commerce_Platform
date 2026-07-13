import type { VideoScriptGenerationInput } from "../dto/video-script.types.js";
import { MissingVideoContentSourceError } from "../errors/product-content.errors.js";

export class VideoScriptInputFactory {
  public create(input: VideoScriptGenerationInput): VideoScriptGenerationInput {
    const productId = clean(input.productId);
    const productTitle = clean(input.productTitle);

    if (productId === undefined) {
      throw new MissingVideoContentSourceError("Product ID is required for video script generation.");
    }

    if (productTitle === undefined) {
      throw new MissingVideoContentSourceError("Product title is required for video script generation.");
    }

    const productSubtitle = clean(input.productSubtitle);
    const brand = clean(input.brand);
    const category = clean(input.category);
    const productType = clean(input.productType);
    const productDescription = clean(input.productDescription);
    const customerPersona = clean(input.customerPersona);
    const valueProposition = clean(input.valueProposition);
    const campaignMessage = clean(input.campaignMessage);

    return {
      productId,
      productTitle,
      ...(productSubtitle === undefined ? {} : { productSubtitle }),
      ...(brand === undefined ? {} : { brand }),
      ...(category === undefined ? {} : { category }),
      ...(productType === undefined ? {} : { productType }),
      ...(productDescription === undefined ? {} : { productDescription }),
      features: cleanList(input.features),
      benefits: cleanList(input.benefits),
      highlights: cleanList(input.highlights),
      productRisks: cleanList(input.productRisks),
      usageInstructions: cleanList(input.usageInstructions),
      materialsOrIngredients: cleanList(input.materialsOrIngredients),
      ...(input.productContentPackage === undefined ? {} : { productContentPackage: input.productContentPackage }),
      ...(input.seoContentPackage === undefined ? {} : { seoContentPackage: input.seoContentPackage }),
      ...(input.socialMediaContentPackage === undefined
        ? {}
        : { socialMediaContentPackage: input.socialMediaContentPackage }),
      ...(input.targetAudience === undefined ? {} : { targetAudience: input.targetAudience }),
      ...(customerPersona === undefined ? {} : { customerPersona }),
      ...(input.marketingAngles === undefined ? {} : { marketingAngles: input.marketingAngles }),
      ...(valueProposition === undefined ? {} : { valueProposition }),
      ...(input.campaignObjective === undefined ? {} : { campaignObjective: input.campaignObjective }),
      ...(campaignMessage === undefined ? {} : { campaignMessage }),
      targetMarkets: cleanList(input.targetMarkets),
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.tone === undefined ? {} : { tone: input.tone }),
      ...(input.sourceMediaMetadata === undefined ? {} : { sourceMediaMetadata: input.sourceMediaMetadata }),
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
