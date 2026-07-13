import type { NormalizedProduct, ProductAIAnalysis, ProductRiskAssessment } from "../../../ai-product/types/product.types.js";
import type { EmailContentGenerationInput } from "../dto/email-content.types.js";

export interface ProductToEmailInputMapperInput {
  readonly product: NormalizedProduct;
  readonly analysis?: ProductAIAnalysis;
  readonly risk?: ProductRiskAssessment;
}

export class ProductToEmailInputMapper {
  public map(input: ProductToEmailInputMapperInput): EmailContentGenerationInput {
    const { product, analysis, risk } = input;
    return {
      productId: product.id,
      productTitle: product.title,
      productDescription: product.description,
      ...(product.brand === undefined ? {} : { brand: product.brand }),
      ...(product.category === undefined ? {} : { category: product.category }),
      ...(product.productType === undefined ? {} : { productType: product.productType }),
      benefits: analysis?.keyBenefits ?? [],
      features: [...(analysis?.keyFeatures ?? []), ...product.options.map((option) => `${option.name}: ${option.values.join(", ")}`)],
      highlights: analysis?.keyFeatures ?? [],
      productRisks: risk?.reasons ?? analysis?.risks.reasons ?? [],
      ...(analysis === undefined
        ? {}
        : {
            targetAudience: {
              primaryAudience: analysis.audience.primaryAudience,
              customerProblems: analysis.audience.customerProblems,
              purchaseMotivations: analysis.audience.purchaseMotivations,
              objections: analysis.audience.objections,
            },
            valueProposition: analysis.summary,
          }),
    };
  }
}
