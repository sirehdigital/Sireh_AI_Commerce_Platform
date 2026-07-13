import type { BlogContentGenerationInput } from "../dto/blog-content.types.js";
import type { ProductContentPackage } from "../dto/product-content.types.js";

export class ProductContentToBlogInputMapper {
  public map(contentPackage: ProductContentPackage): Partial<BlogContentGenerationInput> {
    return {
      productId: contentPackage.productId,
      productTitle: contentPackage.title.snapshot().headline.value,
      productDescription: contentPackage.longDescription.snapshot().body,
      benefits: contentPackage.benefits.map((content) => content.snapshot().body),
      features: contentPackage.features.map((content) => content.snapshot().body),
      highlights: contentPackage.highlights.map((content) => content.snapshot().body),
      productContentPackage: contentPackage,
    };
  }
}
