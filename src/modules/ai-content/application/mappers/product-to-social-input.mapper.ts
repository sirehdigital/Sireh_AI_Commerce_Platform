import type { NormalizedProduct, ProductAIAnalysis, ProductRiskAssessment } from "../../../ai-product/types/product.types.js";
import type { SocialMediaContentGenerationInput } from "../dto/social-media-content.types.js";

export interface ProductToSocialInputMapperInput {
  readonly product: NormalizedProduct;
  readonly analysis?: ProductAIAnalysis;
  readonly risk?: ProductRiskAssessment;
}

export class ProductToSocialInputMapper {
  public map(input: ProductToSocialInputMapperInput): SocialMediaContentGenerationInput {
    const { product, analysis, risk } = input;

    return {
      productId: product.id,
      productTitle: product.title,
      productDescription: product.description,
      ...(product.brand === undefined ? {} : { brand: product.brand }),
      ...(product.category === undefined ? {} : { category: product.category }),
      ...(product.productType === undefined ? {} : { productType: product.productType }),
      benefits: analysis?.keyBenefits ?? [],
      features: [
        ...(analysis?.keyFeatures ?? []),
        ...product.options.map((option) => `${option.name}: ${option.values.join(", ")}`),
      ],
      productRisks: risk?.reasons ?? analysis?.risks.reasons ?? [],
      targetMarkets: product.targetMarkets,
      tags: product.tags,
      ...(analysis?.audience === undefined
        ? {}
        : {
            targetAudience: {
              primaryAudience: analysis.audience.primaryAudience,
              customerProblems: analysis.audience.customerProblems,
              customerDesires: analysis.audience.customerDesires,
              purchaseMotivations: analysis.audience.purchaseMotivations,
              objections: analysis.audience.objections,
            },
          }),
      ...(analysis === undefined
        ? {}
        : {
            valueProposition: analysis.summary,
            marketingAngles: analysis.marketingAngles,
          }),
    };
  }
}
