import type { SEOContentPackage } from "../dto/seo-content.types.js";

export interface SEOContentPackageSnapshot {
  readonly productId: string;
  readonly primaryKeyword: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly slug: string;
  readonly contentIds: readonly string[];
}

export class SEOContentMapper {
  public toSnapshot(productContentPackage: SEOContentPackage): SEOContentPackageSnapshot {
    return {
      productId: productContentPackage.productId,
      primaryKeyword: productContentPackage.keywords.primaryKeyword.value,
      metaTitle: productContentPackage.metaTitle.value,
      metaDescription: productContentPackage.metaDescription.value,
      slug: productContentPackage.slug.value,
      contentIds: productContentPackage.contents.map((content) => content.id),
    };
  }
}
