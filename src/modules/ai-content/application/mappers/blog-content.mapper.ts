import type { ContentSnapshot } from "../../domain/index.js";
import type { BlogContentPackage } from "../dto/blog-content.types.js";

export interface BlogContentPackageSnapshot {
  readonly productId: string;
  readonly articleType: string;
  readonly objective: string;
  readonly recommendedTitle: string;
  readonly slug: string;
  readonly sectionCount: number;
  readonly faqCount: number;
  readonly wordCount: number;
  readonly contents: readonly ContentSnapshot[];
  readonly generatedAt: Date;
}

export class BlogContentMapper {
  public toSnapshot(contentPackage: BlogContentPackage): BlogContentPackageSnapshot {
    return {
      productId: contentPackage.productId,
      articleType: contentPackage.articleType,
      objective: contentPackage.objective,
      recommendedTitle: contentPackage.recommendedTitle,
      slug: contentPackage.slug,
      sectionCount: contentPackage.sections.length,
      faqCount: contentPackage.faqSection.length,
      wordCount: contentPackage.wordCount,
      contents: contentPackage.contents.map((content) => content.snapshot()),
      generatedAt: new Date(contentPackage.generatedAt),
    };
  }
}
