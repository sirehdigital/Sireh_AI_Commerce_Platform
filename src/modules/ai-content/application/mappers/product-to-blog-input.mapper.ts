import type { BlogContentGenerationInput } from "../dto/blog-content.types.js";

export interface ProductToBlogInputMapperInput {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly description?: string;
  readonly benefits?: readonly string[];
  readonly features?: readonly string[];
  readonly highlights?: readonly string[];
  readonly risks?: readonly string[];
  readonly usageGuidance?: readonly string[];
  readonly targetMarket?: string;
  readonly language?: BlogContentGenerationInput["language"];
  readonly tone?: BlogContentGenerationInput["tone"];
}

export class ProductToBlogInputMapper {
  public map(product: ProductToBlogInputMapperInput): BlogContentGenerationInput {
    return {
      productId: product.id,
      productTitle: product.title,
      ...(product.subtitle === undefined ? {} : { productSubtitle: product.subtitle }),
      ...(product.brand === undefined ? {} : { brand: product.brand }),
      ...(product.category === undefined ? {} : { category: product.category }),
      ...(product.productType === undefined ? {} : { productType: product.productType }),
      ...(product.description === undefined ? {} : { productDescription: product.description }),
      benefits: [...(product.benefits ?? [])],
      features: [...(product.features ?? [])],
      highlights: [...(product.highlights ?? [])],
      productRisks: [...(product.risks ?? [])],
      usageGuidance: [...(product.usageGuidance ?? [])],
      ...(product.targetMarket === undefined ? {} : { targetMarket: product.targetMarket }),
      ...(product.language === undefined ? {} : { language: product.language }),
      ...(product.tone === undefined ? {} : { tone: product.tone }),
    };
  }
}
