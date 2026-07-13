import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCopy,
  ProductRiskAssessment,
} from "../../../ai-product/types/product.types.js";
import type { ProductContentGenerationInput } from "../dto/product-content.types.js";

export interface ProductToContentInputMapperInput {
  readonly product: NormalizedProduct;
  readonly analysis?: ProductAIAnalysis;
  readonly copy?: ProductCopy;
  readonly risk?: ProductRiskAssessment;
}

export class ProductToContentInputMapper {
  public map(input: ProductToContentInputMapperInput): ProductContentGenerationInput {
    const { product, analysis, copy, risk } = input;

    return {
      productId: product.id,
      productTitle: copy?.brandedTitle ?? product.title,
      productDescription: copy?.fullDescription ?? product.description,
      ...(product.brand === undefined ? {} : { brand: product.brand }),
      ...(product.category === undefined ? {} : { category: product.category }),
      ...(product.productType === undefined ? {} : { productType: product.productType }),
      features: [
        ...(copy?.featureHighlights ?? []),
        ...(analysis?.keyFeatures ?? []),
        ...product.options.map((option) => `${option.name}: ${option.values.join(", ")}`),
      ],
      benefits: [...(copy?.benefits ?? []), ...(analysis?.keyBenefits ?? [])],
      tags: product.tags,
      targetMarkets: product.targetMarkets,
      ...(product.supplier === undefined ? {} : { supplier: product.supplier }),
      ...(product.pricing === undefined ? {} : { pricing: product.pricing }),
      ...(analysis === undefined
        ? {}
        : {
            productAnalysis: {
              summary: analysis.summary,
              keyBenefits: analysis.keyBenefits,
              keyFeatures: analysis.keyFeatures,
              recommendation: analysis.recommendation,
              reasoning: analysis.reasoning,
            },
            marketingAudience: {
              primaryAudience: analysis.audience.primaryAudience,
              customerProblems: analysis.audience.customerProblems,
              customerDesires: analysis.audience.customerDesires,
              purchaseMotivations: analysis.audience.purchaseMotivations,
              objections: analysis.audience.objections,
            },
            marketingAngles: analysis.marketingAngles,
          }),
      ...(risk === undefined
        ? analysis === undefined
          ? {}
          : { productRisk: { level: analysis.risks.level, reasons: analysis.risks.reasons } }
        : { productRisk: { level: risk.level, reasons: risk.reasons } }),
    };
  }
}
