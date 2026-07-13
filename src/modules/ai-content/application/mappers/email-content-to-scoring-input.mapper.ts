import type { ContentQualityScoringInput } from "../dto/content-quality-scoring.types.js";
import type { EmailContentPackage } from "../dto/email-content.types.js";

export class EmailContentToScoringInputMapper {
  public map(contentPackage: EmailContentPackage): ContentQualityScoringInput {
    return {
      contentId: `score:${contentPackage.productId}:email-content`,
      contentType: "email-body",
      channel: "email",
      language: contentPackage.language,
      tone: contentPackage.tone,
      headline: contentPackage.headline,
      body: [contentPackage.recommendedSubjectLine, contentPackage.recommendedPreheader, contentPackage.mainBody, contentPackage.footerGuidance].join("\n\n"),
      structuredContent: {
        subjectLines: contentPackage.subjectLines.join("\n"),
        preheaders: contentPackage.preheaders.join("\n"),
        sequence: contentPackage.sequence.map((item) => `${item.position}. ${item.subjectLine}`).join("\n"),
      },
      cta: contentPackage.cta,
      sourceMetadata: { productId: contentPackage.productId, sourcePackage: "email-content", campaignType: contentPackage.campaignType },
      campaignMetadata: { objective: contentPackage.objective },
      correlationMetadata: {},
      emailContentPackage: contentPackage,
    };
  }
}
