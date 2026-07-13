import type { ContentLocalizationInput, SupportedLocale } from "../dto/content-localization.types.js";
import type { EmailContentPackage } from "../dto/email-content.types.js";

export class EmailContentToLocalizationInputMapper {
  public map(contentPackage: EmailContentPackage, targetLocale: SupportedLocale): ContentLocalizationInput {
    return {
      sourceContentId: `email-content:${contentPackage.productId}`,
      sourceLanguage: contentPackage.language,
      targetLanguage: targetLocale.startsWith("ms") ? "ms" : "en",
      targetLocale,
      contentType: "email-body",
      channel: "email",
      tone: contentPackage.tone,
      headline: contentPackage.headline,
      body: [contentPackage.openingParagraph, contentPackage.mainBody, contentPackage.footerGuidance].join("\n\n"),
      structuredContent: {
        subjectLines: contentPackage.subjectLines.join("\n"),
        preheaders: contentPackage.preheaders.join("\n"),
        sequence: contentPackage.sequence.map((item) => `${item.position}. ${item.subjectLine}`).join("\n"),
      },
      cta: contentPackage.cta,
      emailContentPackage: contentPackage,
      productFacts: [...contentPackage.benefits, ...contentPackage.supportingFeatures],
      brandTerminology: [],
      protectedTerms: [],
      productNames: [],
      brandNames: [],
      personalizationTokens: contentPackage.personalizationTokens,
      verifiedClaims: [],
      regulatoryNotes: contentPackage.complianceNotes,
      campaignMetadata: { campaignType: contentPackage.campaignType, objective: contentPackage.objective },
      correlationMetadata: {},
    };
  }
}
