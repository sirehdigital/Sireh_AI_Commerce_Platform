import type { SocialMediaContentGenerationInput } from "../dto/social-media-content.types.js";
import type { ProductContentPackage } from "../dto/product-content.types.js";

export class ProductContentToSocialInputMapper {
  public map(productContentPackage: ProductContentPackage): Partial<SocialMediaContentGenerationInput> {
    return {
      productId: productContentPackage.productId,
      productTitle: productContentPackage.shopifyReady.title,
      productSubtitle: productContentPackage.shopifyReady.subtitle,
      productDescription: productContentPackage.shortDescription.snapshot().body,
      benefits: productContentPackage.shopifyReady.benefits,
      features: productContentPackage.shopifyReady.features,
      highlights: productContentPackage.shopifyReady.highlights,
      productContentPackage,
      language: productContentPackage.language,
      tone: productContentPackage.tone,
    };
  }
}
