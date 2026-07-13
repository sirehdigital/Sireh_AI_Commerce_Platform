import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductRiskAssessment,
} from "../../../ai-product/types/product.types.js";
import type { SEOContentGenerationInput } from "../dto/seo-content.types.js";

export interface ProductToSEOInputMapperInput {
  readonly product: NormalizedProduct;
  readonly analysis?: ProductAIAnalysis;
  readonly risk?: ProductRiskAssessment;
}

export class ProductToSEOInputMapper {
  public map(input: ProductToSEOInputMapperInput): SEOContentGenerationInput {
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
      tags: product.tags,
      targetMarkets: product.targetMarkets,
      productKeywords: [...product.tags, product.category ?? "", product.productType ?? ""],
      productRiskFlags: risk?.reasons ?? analysis?.risks.reasons ?? [],
      ...(analysis === undefined
        ? {}
        : {
            marketingAudience: {
              primaryAudience: analysis.audience.primaryAudience,
              customerProblems: analysis.audience.customerProblems,
              purchaseMotivations: analysis.audience.purchaseMotivations,
            },
            marketingAngles: analysis.marketingAngles,
            valueProposition: analysis.keyBenefits[0] ?? analysis.summary,
          }),
    };
  }
}
