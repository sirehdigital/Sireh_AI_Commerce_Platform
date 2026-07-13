import type { ProductContentPackage } from "../dto/product-content.types.js";
import type { VideoScriptGenerationInput } from "../dto/video-script.types.js";

export class ProductContentToVideoInputMapper {
  public map(productContentPackage: ProductContentPackage): Partial<VideoScriptGenerationInput> {
    return {
      productId: productContentPackage.productId,
      productTitle: productContentPackage.shopifyReady.title,
      productSubtitle: productContentPackage.shopifyReady.subtitle,
      productDescription: productContentPackage.shortDescription.snapshot().body,
      features: productContentPackage.shopifyReady.features,
      benefits: productContentPackage.shopifyReady.benefits,
      highlights: productContentPackage.shopifyReady.highlights,
      productContentPackage,
      language: productContentPackage.language,
      tone: productContentPackage.tone,
    };
  }
}
