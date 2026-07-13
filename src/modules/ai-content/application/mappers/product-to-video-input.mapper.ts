import type { NormalizedProduct, ProductAIAnalysis, ProductRiskAssessment } from "../../../ai-product/types/product.types.js";
import type { VideoScriptGenerationInput } from "../dto/video-script.types.js";

export interface ProductToVideoInputMapperInput {
  readonly product: NormalizedProduct;
  readonly analysis?: ProductAIAnalysis;
  readonly risk?: ProductRiskAssessment;
}

export class ProductToVideoInputMapper {
  public map(input: ProductToVideoInputMapperInput): VideoScriptGenerationInput {
    const { product, analysis, risk } = input;

    return {
      productId: product.id,
      productTitle: product.title,
      productDescription: product.description,
      ...(product.brand === undefined ? {} : { brand: product.brand }),
      ...(product.category === undefined ? {} : { category: product.category }),
      ...(product.productType === undefined ? {} : { productType: product.productType }),
      features: [
        ...(analysis?.keyFeatures ?? []),
        ...product.options.map((option) => `${option.name}: ${option.values.join(", ")}`),
      ],
      benefits: analysis?.keyBenefits ?? [],
      highlights: analysis?.keyFeatures ?? [],
      productRisks: risk?.reasons ?? analysis?.risks.reasons ?? [],
      targetMarkets: product.targetMarkets,
      ...(analysis === undefined
        ? {}
        : {
            targetAudience: {
              primaryAudience: analysis.audience.primaryAudience,
              customerProblems: analysis.audience.customerProblems,
              customerDesires: analysis.audience.customerDesires,
              purchaseMotivations: analysis.audience.purchaseMotivations,
              objections: analysis.audience.objections,
            },
            marketingAngles: analysis.marketingAngles,
            valueProposition: analysis.summary,
          }),
    };
  }
}
