import type { ContentQualityScoringInput } from "../dto/content-quality-scoring.types.js";
import type { SocialMediaContentPackage } from "../dto/social-media-content.types.js";

export class SocialContentToScoringInputMapper {
  public map(contentPackage: SocialMediaContentPackage): ContentQualityScoringInput {
    return {
      contentId: `score:${contentPackage.productId}:social-content`,
      contentType: "social-post",
      channel: contentPackage.channel,
      language: contentPackage.language,
      tone: contentPackage.tone,
      headline: contentPackage.hook,
      body: [contentPackage.primaryCaption, contentPackage.shortCaption, contentPackage.longCaption ?? "", ...contentPackage.hashtags].join(" "),
      structuredContent: {
        carousel: contentPackage.carouselSlides.map((slide) => `${slide.title}: ${slide.body}`).join("\n"),
        story: contentPackage.storyFrames.map((frame) => frame.text).join("\n"),
      },
      ...(contentPackage.ctas[0] === undefined ? {} : { cta: contentPackage.ctas[0] }),
      sourceMetadata: { productId: contentPackage.productId, sourcePackage: "social-content", platform: contentPackage.platform },
      campaignMetadata: {},
      correlationMetadata: {},
      socialMediaContentPackage: contentPackage,
    };
  }
}
