import type { ProductContentGenerationInput } from "../dto/product-content.types.js";
import { MissingProductContentSourceError } from "../errors/product-content.errors.js";

export class ProductContentInputFactory {
  public create(input: ProductContentGenerationInput): ProductContentGenerationInput {
    const productId = input.productId.trim();
    const productTitle = normalizeText(input.productTitle);

    if (productId.length === 0) {
      throw new MissingProductContentSourceError("Product content generation requires a product ID.");
    }

    if (productTitle.length === 0) {
      throw new MissingProductContentSourceError("Product content generation requires a product title.");
    }

    return {
      productId,
      productTitle,
      ...(input.productDescription === undefined
        ? {}
        : { productDescription: normalizeText(input.productDescription) }),
      ...(input.brand === undefined ? {} : { brand: normalizeText(input.brand) }),
      ...(input.category === undefined ? {} : { category: normalizeText(input.category) }),
      ...(input.productType === undefined ? {} : { productType: normalizeText(input.productType) }),
      features: normalizeList(input.features ?? []),
      benefits: normalizeList(input.benefits ?? []),
      tags: normalizeList(input.tags ?? []),
      targetMarkets: normalizeList(input.targetMarkets ?? []),
      ...(input.supplier === undefined ? {} : { supplier: { ...input.supplier } }),
      ...(input.pricing === undefined ? {} : { pricing: { ...input.pricing } }),
      ...(input.productAnalysis === undefined
        ? {}
        : {
            productAnalysis: {
              ...input.productAnalysis,
              keyBenefits: normalizeList(input.productAnalysis.keyBenefits ?? []),
              keyFeatures: normalizeList(input.productAnalysis.keyFeatures ?? []),
            },
          }),
      ...(input.productRisk === undefined
        ? {}
        : { productRisk: { ...input.productRisk, reasons: normalizeList(input.productRisk.reasons ?? []) } }),
      ...(input.brandPositioning === undefined
        ? {}
        : { brandPositioning: normalizeText(input.brandPositioning) }),
      ...(input.marketingAudience === undefined
        ? {}
        : {
            marketingAudience: {
              ...input.marketingAudience,
              customerProblems: normalizeList(input.marketingAudience.customerProblems ?? []),
              customerDesires: normalizeList(input.marketingAudience.customerDesires ?? []),
              purchaseMotivations: normalizeList(input.marketingAudience.purchaseMotivations ?? []),
              objections: normalizeList(input.marketingAudience.objections ?? []),
            },
          }),
      ...(input.customerPersona === undefined ? {} : { customerPersona: normalizeText(input.customerPersona) }),
      ...(input.valueProposition === undefined
        ? {}
        : { valueProposition: normalizeText(input.valueProposition) }),
      marketingAngles: (input.marketingAngles ?? []).map((angle) => ({
        title: normalizeText(angle.title),
        ...(angle.hook === undefined ? {} : { hook: normalizeText(angle.hook) }),
        ...(angle.coreBenefit === undefined ? {} : { coreBenefit: normalizeText(angle.coreBenefit) }),
        ...(angle.emotionalOutcome === undefined
          ? {}
          : { emotionalOutcome: normalizeText(angle.emotionalOutcome) }),
        ...(angle.targetAudience === undefined ? {} : { targetAudience: normalizeText(angle.targetAudience) }),
      })),
      ...(input.tone === undefined ? {} : { tone: input.tone }),
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.channel === undefined ? {} : { channel: input.channel }),
      ...(input.templateId === undefined ? {} : { templateId: input.templateId.trim() }),
      ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId.trim() }),
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId.trim() }),
      ...(input.sourceMarketingAnalysisId === undefined
        ? {}
        : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId.trim() }),
    };
  }
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function normalizeList(values: readonly string[]): readonly string[] {
  return [...new Set(values.map(normalizeText).filter((value) => value.length > 0))];
}
