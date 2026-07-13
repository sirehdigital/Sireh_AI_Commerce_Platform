import type { EmailContentGenerationInput } from "../dto/email-content.types.js";
import type { SocialMediaContentPackage } from "../dto/social-media-content.types.js";

export class SocialContentToEmailInputMapper {
  public map(socialMediaContentPackage: SocialMediaContentPackage): Partial<EmailContentGenerationInput> {
    return {
      productId: socialMediaContentPackage.productId,
      productTitle: socialMediaContentPackage.hook,
      benefits: socialMediaContentPackage.benefitBullets,
      highlights: socialMediaContentPackage.productHighlights,
      socialMediaContentPackage,
      language: socialMediaContentPackage.language,
      tone: socialMediaContentPackage.tone,
    };
  }
}
