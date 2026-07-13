import type { EmailContentGenerationInput } from "../dto/email-content.types.js";
import type { SEOContentPackage } from "../dto/seo-content.types.js";

export class SEOContentToEmailInputMapper {
  public map(seoContentPackage: SEOContentPackage): Partial<EmailContentGenerationInput> {
    return {
      productId: seoContentPackage.productId,
      productTitle: seoContentPackage.seoProductTitle,
      productDescription: seoContentPackage.seoSummary,
      seoContentPackage,
      language: seoContentPackage.language,
    };
  }
}
