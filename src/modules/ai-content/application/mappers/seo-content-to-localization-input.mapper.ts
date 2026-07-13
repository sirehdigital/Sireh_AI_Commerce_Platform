import type { ContentLocalizationInput, SupportedLocale } from "../dto/content-localization.types.js";
import type { SEOContentPackage } from "../dto/seo-content.types.js";

export class SEOContentToLocalizationInputMapper {
  public map(contentPackage: SEOContentPackage, targetLocale: SupportedLocale): ContentLocalizationInput {
    return {
      sourceContentId: `seo-content:${contentPackage.productId}`,
      sourceLanguage: contentPackage.language,
      targetLanguage: targetLocale.startsWith("ms") ? "ms" : "en",
      targetLocale,
      contentType: "seo-title",
      channel: contentPackage.channel,
      tone: "professional",
      headline: contentPackage.h1,
      body: contentPackage.seoSummary,
      structuredContent: {
        metaTitle: contentPackage.metaTitle.value,
        metaDescription: contentPackage.metaDescription.value,
        slug: contentPackage.slug.value,
      },
      seo: contentPackage.contentSEO,
      seoContentPackage: contentPackage,
      productFacts: [],
      brandTerminology: [],
      protectedTerms: [],
      productNames: [contentPackage.seoProductTitle],
      brandNames: [],
      personalizationTokens: [],
      verifiedClaims: [],
      regulatoryNotes: [],
      campaignMetadata: { productId: contentPackage.productId },
      correlationMetadata: {},
    };
  }
}
