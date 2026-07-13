import type { ContentLocalizationInput, SupportedLocale } from "../dto/content-localization.types.js";
import type { BlogContentPackage } from "../dto/blog-content.types.js";

export class BlogContentToLocalizationInputMapper {
  public map(contentPackage: BlogContentPackage, targetLocale: SupportedLocale): ContentLocalizationInput {
    return {
      sourceContentId: `blog-content:${contentPackage.productId}`,
      sourceLanguage: contentPackage.language,
      targetLanguage: targetLocale.startsWith("ms") ? "ms" : "en",
      targetLocale,
      contentType: "blog-article",
      channel: contentPackage.channel,
      tone: contentPackage.tone,
      headline: contentPackage.recommendedTitle,
      body: [
        contentPackage.articleSummary,
        contentPackage.introduction,
        ...contentPackage.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
        ...contentPackage.faqSection.flatMap((item) => [item.question, item.answer]),
        contentPackage.conclusion,
      ].join("\n\n"),
      structuredContent: {
        outline: contentPackage.outline.map((item) => `${item.order}. ${item.heading}`).join("\n"),
        faq: contentPackage.faqSection.map((item) => `${item.question}: ${item.answer}`).join("\n"),
      },
      cta: contentPackage.primaryCTA,
      blogContentPackage: contentPackage,
      productFacts: [...contentPackage.benefitExplanations, ...contentPackage.featureExplanations],
      brandTerminology: [],
      protectedTerms: [],
      productNames: [contentPackage.productId],
      brandNames: [],
      personalizationTokens: [],
      verifiedClaims: [],
      regulatoryNotes: contentPackage.complianceNotes,
      campaignMetadata: { objective: contentPackage.objective },
      correlationMetadata: {},
    };
  }
}
