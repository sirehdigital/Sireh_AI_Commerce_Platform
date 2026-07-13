import type { SEOContentPackage } from "../dto/seo-content.types.js";
import type { VideoScriptGenerationInput } from "../dto/video-script.types.js";

export class SEOContentToVideoInputMapper {
  public map(seoContentPackage: SEOContentPackage): Partial<VideoScriptGenerationInput> {
    return {
      productId: seoContentPackage.productId,
      productTitle: seoContentPackage.seoProductTitle,
      productDescription: seoContentPackage.seoSummary,
      seoContentPackage,
      language: seoContentPackage.language,
    };
  }
}
