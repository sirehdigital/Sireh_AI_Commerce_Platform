import type { ContentLocalizationInput, SupportedLocale } from "../dto/content-localization.types.js";
import type { SocialMediaContentPackage } from "../dto/social-media-content.types.js";

export class SocialContentToLocalizationInputMapper {
  public map(contentPackage: SocialMediaContentPackage, targetLocale: SupportedLocale): ContentLocalizationInput {
    return {
      sourceContentId: `social-content:${contentPackage.productId}`,
      sourceLanguage: contentPackage.language,
      targetLanguage: targetLocale.startsWith("ms") ? "ms" : "en",
      targetLocale,
      contentType: "social-post",
      channel: contentPackage.channel,
      tone: contentPackage.tone,
      headline: contentPackage.hook,
      body: [contentPackage.primaryCaption, contentPackage.shortCaption, contentPackage.longCaption ?? ""].join("\n"),
      structuredContent: {
        carousel: contentPackage.carouselSlides.map((slide) => `${slide.title}: ${slide.body}`).join("\n"),
        story: contentPackage.storyFrames.map((frame) => frame.text).join("\n"),
      },
      ...(contentPackage.ctas[0] === undefined ? {} : { cta: contentPackage.ctas[0] }),
      socialMediaContentPackage: contentPackage,
      productFacts: [...contentPackage.productHighlights, ...contentPackage.benefitBullets],
      brandTerminology: [],
      protectedTerms: contentPackage.hashtags,
      productNames: [],
      brandNames: [],
      personalizationTokens: [],
      verifiedClaims: [],
      regulatoryNotes: [],
      campaignMetadata: { platform: contentPackage.platform },
      correlationMetadata: {},
    };
  }
}
