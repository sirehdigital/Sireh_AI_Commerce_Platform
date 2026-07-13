import type { BlogContentGenerationInput } from "../dto/blog-content.types.js";
import type { SocialMediaContentPackage } from "../dto/social-media-content.types.js";

export class SocialContentToBlogInputMapper {
  public map(contentPackage: SocialMediaContentPackage): Partial<BlogContentGenerationInput> {
    return {
      productId: contentPackage.productId,
      marketingAngle: contentPackage.hook,
      highlights: [contentPackage.hook, ...contentPackage.carouselSlides.map((slide) => slide.title)].slice(0, 5),
      socialMediaContentPackage: contentPackage,
    };
  }
}
