import type { BlogContentGenerationInput } from "../dto/blog-content.types.js";
import type { SEOContentPackage } from "../dto/seo-content.types.js";

export class SEOContentToBlogInputMapper {
  public map(contentPackage: SEOContentPackage): Partial<BlogContentGenerationInput> {
    return {
      productId: contentPackage.productId,
      productTitle: contentPackage.seoProductTitle,
      searchIntent: contentPackage.searchIntent === "comparison" || contentPackage.searchIntent === "local" ? "commercial" : contentPackage.searchIntent,
      language: contentPackage.language,
      ...(contentPackage.targetMarket === undefined ? {} : { targetMarket: contentPackage.targetMarket }),
      seoContentPackage: contentPackage,
    };
  }
}
