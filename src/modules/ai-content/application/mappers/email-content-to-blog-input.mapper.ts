import type { BlogContentGenerationInput } from "../dto/blog-content.types.js";
import type { EmailContentPackage } from "../dto/email-content.types.js";

export class EmailContentToBlogInputMapper {
  public map(contentPackage: EmailContentPackage): Partial<BlogContentGenerationInput> {
    return {
      productId: contentPackage.productId,
      marketingAngle: contentPackage.headline,
      benefits: contentPackage.benefits,
      features: contentPackage.supportingFeatures,
      emailContentPackage: contentPackage,
    };
  }
}
