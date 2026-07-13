import type { ContentQualityScoringInput } from "../dto/content-quality-scoring.types.js";
import type { SEOContentPackage } from "../dto/seo-content.types.js";

export class SEOContentToScoringInputMapper {
  public map(contentPackage: SEOContentPackage): ContentQualityScoringInput {
    return {
      contentId: `score:${contentPackage.productId}:seo-content`,
      contentType: "seo-title",
      channel: contentPackage.channel,
      language: contentPackage.language,
      tone: "professional",
      headline: contentPackage.h1,
      body: [contentPackage.seoSummary, ...contentPackage.h2Headings].join("\n"),
      structuredContent: {
        metaTitle: contentPackage.metaTitle.value,
        metaDescription: contentPackage.metaDescription.value,
        slug: contentPackage.slug.value,
      },
      seo: contentPackage.contentSEO,
      searchIntent: contentPackage.searchIntent === "comparison" || contentPackage.searchIntent === "local" ? "commercial" : contentPackage.searchIntent,
      sourceMetadata: { productId: contentPackage.productId, sourcePackage: "seo-content" },
      campaignMetadata: {},
      correlationMetadata: {},
      seoContentPackage: contentPackage,
    };
  }
}
