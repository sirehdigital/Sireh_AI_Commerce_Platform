import { Content, CTA, Headline, type ContentType } from "../../domain/index.js";
import type {
  EmailAudienceInput,
  EmailContentGenerationInput,
  EmailContentGenerationOptions,
  EmailContentPackage,
  EmailSection,
  EmailSequenceItem,
  EmailWarning,
} from "../dto/email-content.types.js";

export interface EmailContentPackageDraft {
  readonly subjectLines: readonly string[];
  readonly preheaders: readonly string[];
  readonly headline: string;
  readonly openingParagraph: string;
  readonly mainBody: string;
  readonly productHighlights: readonly string[];
  readonly benefits: readonly string[];
  readonly supportingFeatures: readonly string[];
  readonly objectionHandlingSection?: EmailSection;
  readonly trustBuildingSection?: EmailSection;
  readonly educationalSection?: EmailSection;
  readonly cta: string;
  readonly secondaryCTA?: string;
  readonly buttonLabels: readonly string[];
  readonly textLinkLabels: readonly string[];
  readonly footerGuidance: string;
  readonly unsubscribePlaceholderGuidance: string;
  readonly complianceNotes: readonly string[];
  readonly plainTextVersion?: string;
  readonly htmlSafeSections: readonly EmailSection[];
  readonly sequence: readonly EmailSequenceItem[];
  readonly warnings: readonly EmailWarning[];
}

export class EmailContentPackageFactory {
  public create(
    input: EmailContentGenerationInput,
    options: EmailContentGenerationOptions,
    draft: EmailContentPackageDraft,
  ): EmailContentPackage {
    const cta = CTA.create(draft.cta);
    const secondaryCTA = draft.secondaryCTA === undefined ? undefined : CTA.create(draft.secondaryCTA);
    const contents = [
      this.content(input, options, "email-subject", "subject", draft.subjectLines[0] ?? draft.headline, draft.subjectLines.join("\n")),
      this.content(input, options, "generic-content", "preheader", draft.preheaders[0] ?? draft.headline, draft.preheaders.join("\n")),
      this.content(input, options, "generic-content", "headline", draft.headline, draft.headline),
      this.content(input, options, "email-body", "body", draft.headline, draft.mainBody, cta, sectionsToRecord(draft.htmlSafeSections)),
      this.content(input, options, "cta", "cta", cta.value, [cta.value, secondaryCTA?.value ?? ""].filter(Boolean).join("\n"), cta),
      ...(draft.plainTextVersion === undefined
        ? []
        : [this.content(input, options, "email-body", "plain-text", draft.headline, draft.plainTextVersion, cta)]),
      ...(draft.sequence.length === 0
        ? []
        : [
            this.content(
              input,
              options,
              "generic-content",
              "sequence",
              "Email sequence",
              draft.sequence.map((item) => `${item.position}. ${item.subjectLine}: ${item.bodySummary}`).join("\n"),
              cta,
            ),
          ]),
      this.content(input, options, "generic-content", "footer", "Footer guidance", draft.footerGuidance),
    ];

    return {
      productId: input.productId,
      campaignType: options.campaignType,
      objective: options.objective,
      ...(input.targetAudience === undefined ? {} : { audience: cloneAudience(input.targetAudience) }),
      language: options.language,
      tone: options.tone,
      subjectLines: draft.subjectLines,
      recommendedSubjectLine: draft.subjectLines[0] ?? draft.headline,
      preheaders: draft.preheaders,
      recommendedPreheader: draft.preheaders[0] ?? draft.openingParagraph,
      headline: draft.headline,
      openingParagraph: draft.openingParagraph,
      mainBody: draft.mainBody,
      productHighlights: draft.productHighlights,
      benefits: draft.benefits,
      supportingFeatures: draft.supportingFeatures,
      ...(draft.objectionHandlingSection === undefined ? {} : { objectionHandlingSection: draft.objectionHandlingSection }),
      ...(draft.trustBuildingSection === undefined ? {} : { trustBuildingSection: draft.trustBuildingSection }),
      ...(draft.educationalSection === undefined ? {} : { educationalSection: draft.educationalSection }),
      cta,
      ...(secondaryCTA === undefined ? {} : { secondaryCTA }),
      buttonLabels: draft.buttonLabels,
      textLinkLabels: draft.textLinkLabels,
      personalizationTokens: options.includePersonalization ? options.personalizationTokens : [],
      footerGuidance: draft.footerGuidance,
      unsubscribePlaceholderGuidance: draft.unsubscribePlaceholderGuidance,
      complianceNotes: draft.complianceNotes,
      ...(draft.plainTextVersion === undefined ? {} : { plainTextVersion: draft.plainTextVersion }),
      htmlSafeSections: draft.htmlSafeSections,
      sequence: draft.sequence,
      warnings: draft.warnings,
      contents,
      sourceMetadata: sourceMetadata(input, options),
      generatedAt: new Date(),
    };
  }

  private content(
    input: EmailContentGenerationInput,
    options: EmailContentGenerationOptions,
    type: ContentType,
    component: string,
    headline: string,
    body: string,
    cta?: CTA,
    structuredContent: Readonly<Record<string, string>> = {},
  ): Content {
    return Content.create({
      id: `content:${input.productId}:email:${component}`,
      type,
      channel: "email",
      language: options.language,
      tone: options.tone,
      headline: Headline.create(headline.slice(0, 120)),
      body,
      structuredContent,
      ...(cta === undefined ? {} : { cta }),
      metadata: {
        sourceProductId: input.productId,
        ...(input.sourceMarketingAnalysisId === undefined ? {} : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
        ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
        ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
        ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
        tags: ["email-content", options.campaignType, component],
        custom: {
          component,
          campaignType: options.campaignType,
          objective: options.objective,
          journeyStage: input.customerJourneyStage,
        },
      },
      ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
    });
  }
}

function sectionsToRecord(sections: readonly EmailSection[]): Readonly<Record<string, string>> {
  return Object.fromEntries(sections.map((section) => [section.key, `${section.title}\n${section.body}`]));
}

function cloneAudience(audience: EmailAudienceInput): EmailAudienceInput {
  return {
    ...audience,
    ...(audience.customerProblems === undefined ? {} : { customerProblems: [...audience.customerProblems] }),
    ...(audience.purchaseMotivations === undefined ? {} : { purchaseMotivations: [...audience.purchaseMotivations] }),
    ...(audience.objections === undefined ? {} : { objections: [...audience.objections] }),
  };
}

function sourceMetadata(
  input: EmailContentGenerationInput,
  options: EmailContentGenerationOptions,
): Readonly<Record<string, unknown>> {
  return {
    productId: input.productId,
    campaignType: options.campaignType,
    objective: options.objective,
    journeyStage: input.customerJourneyStage,
    lifecycleStage: input.lifecycleStage,
    ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
    ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
    ...(input.sourceMarketingAnalysisId === undefined ? {} : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
  };
}
