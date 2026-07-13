import type { ProductContentPackage } from "../dto/product-content.types.js";
import type { SEOContentGenerationInput } from "../dto/seo-content.types.js";

export class ProductContentToSEOInputMapper {
  public map(productContentPackage: ProductContentPackage): SEOContentGenerationInput {
    return {
      productId: productContentPackage.productId,
      productTitle: productContentPackage.title.snapshot().body,
      productSubtitle: productContentPackage.subtitle.snapshot().body,
      productDescription: productContentPackage.longDescription.snapshot().body,
      benefits: productContentPackage.benefits.map((content) => content.snapshot().body),
      features: productContentPackage.features.map((content) => content.snapshot().body),
      targetChannel: productContentPackage.channel,
      preferredLanguage: productContentPackage.language,
      productContentPackage,
    };
  }
}
