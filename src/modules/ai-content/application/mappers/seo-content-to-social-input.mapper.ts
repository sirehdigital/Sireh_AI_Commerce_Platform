import type { SocialMediaContentGenerationInput } from "../dto/social-media-content.types.js";
import type { SEOContentPackage } from "../dto/seo-content.types.js";

export class SEOContentToSocialInputMapper {
  public map(seoContentPackage: SEOContentPackage): Partial<SocialMediaContentGenerationInput> {
    return {
      productId: seoContentPackage.productId,
      productTitle: seoContentPackage.seoProductTitle,
      productDescription: seoContentPackage.seoSummary,
      seoContentPackage,
      seoKeywordSet: seoContentPackage.keywords,
      language: seoContentPackage.language,
    };
  }
}
