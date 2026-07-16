import {
  DeterministicEmailContentGenerator,
  DeterministicProductContentGenerator,
  DeterministicSEOContentGenerator,
  DeterministicSocialMediaContentGenerator,
} from "../../../ai-content/index.js";
import {
  GenerateEmailContentUseCase,
  GenerateProductContentUseCase,
  GenerateSEOContentUseCase,
  GenerateSocialMediaContentUseCase,
} from "../../../ai-content/index.js";
import type { ContentAgentAIContentPort } from "./content-agent.ports.js";
import type {
  ContentAgentInput,
  ContentCapabilityDraft,
  ContentChannelAdaptation,
} from "./content-agent.types.js";

export class ExistingAIContentCapabilityAdapter implements ContentAgentAIContentPort {
  public constructor(
    private readonly productContent = new GenerateProductContentUseCase(
      new DeterministicProductContentGenerator(),
    ),
    private readonly socialContent = new GenerateSocialMediaContentUseCase(
      new DeterministicSocialMediaContentGenerator(),
    ),
    private readonly emailContent = new GenerateEmailContentUseCase(
      new DeterministicEmailContentGenerator(),
    ),
    private readonly seoContent = new GenerateSEOContentUseCase(new DeterministicSEOContentGenerator()),
  ) {}

  public createDraft(input: ContentAgentInput): ContentCapabilityDraft {
    const language = input.locale === "ms" ? "ms" : "en";
    const tone = toContentTone(input.brandVoice);
    const productId = toStableProductId(input.productTitle);
    const valueProposition = input.productBenefits[0] ?? input.productTitle;
    const productContentPackage = this.productContent.execute({
      input: {
        productId,
        productTitle: input.productTitle,
        brand: input.brandName,
        category: input.productCategory,
        benefits: [...input.productBenefits],
        targetMarkets: [input.targetAudience],
        marketingAudience: {
          primaryAudience: input.targetAudience,
          description: input.campaignObjective,
        },
        valueProposition,
        tone,
        language,
        channel: "website",
      },
      options: {
        tone,
        language,
        channel: "website",
        desiredLength: "standard",
        strictClaimSafety: false,
      },
    });
    const socialContentPackage = this.socialContent.execute({
      input: {
        productId,
        productTitle: input.productTitle,
        brand: input.brandName,
        category: input.productCategory,
        benefits: [...input.productBenefits],
        productContentPackage,
        targetAudience: {
          primaryAudience: input.targetAudience,
          description: input.campaignObjective,
        },
        valueProposition,
        campaignObjective: "awareness",
        campaignMessage: input.campaignObjective,
        language,
        tone,
        platform: toSocialPlatform(input.recommendedChannels[0]),
      },
      options: {
        language,
        tone,
        platform: toSocialPlatform(input.recommendedChannels[0]),
        objective: "awareness",
        strictClaimSafety: false,
        strictPlatformCompliance: false,
      },
    });
    const emailContentPackage = this.emailContent.execute({
      input: {
        productId,
        productTitle: input.productTitle,
        brand: input.brandName,
        category: input.productCategory,
        benefits: [...input.productBenefits],
        productContentPackage,
        socialMediaContentPackage: socialContentPackage,
        targetAudience: {
          primaryAudience: input.targetAudience,
          description: input.campaignObjective,
        },
        valueProposition,
        campaignObjective: "awareness",
        language,
        tone,
      },
      options: {
        language,
        tone,
        objective: "awareness",
        subjectLineCount: 3,
        strictClaimSafety: false,
        strictCompliance: false,
        strictOfferValidation: false,
        strictPersonalization: false,
      },
    });
    const seoContentPackage = this.seoContent.execute({
      input: {
        productId,
        productTitle: input.productTitle,
        brand: input.brandName,
        category: input.productCategory,
        benefits: [...input.productBenefits],
        productKeywords: [...input.productBenefits, input.productCategory],
        productContentPackage,
        marketingAudience: {
          primaryAudience: input.targetAudience,
          description: input.campaignObjective,
        },
        valueProposition,
        preferredLanguage: language,
        targetChannel: "website",
      },
      options: {
        language,
        channel: "website",
        searchIntent: "commercial",
        strictClaimSafety: false,
        strictKeywordSafety: false,
      },
    });

    return {
      primaryHeadline: productContentPackage.title.snapshot().headline.value,
      shortProductDescription: productContentPackage.shortDescription.snapshot().body,
      longFormContentSummary: productContentPackage.longDescription.snapshot().body,
      keyBenefitBullets: productContentPackage.benefits.map((benefit) => textFromContent(benefit)),
      campaignHooks: [socialContentPackage.hook, productContentPackage.valueProposition.snapshot().body],
      socialCaptions: [
        socialContentPackage.shortCaption,
        socialContentPackage.primaryCaption,
        ...(socialContentPackage.longCaption === undefined ? [] : [socialContentPackage.longCaption]),
      ],
      emailSubjectSuggestions: [...emailContentPackage.subjectLines],
      contentThemes: [
        productContentPackage.brandPositioningStatement.snapshot().body,
        productContentPackage.targetAudienceStatement.snapshot().body,
        seoContentPackage.seoSummary,
      ],
      recommendedFormats: ["product content block", "social caption set", "email subject set", "SEO metadata set"],
      channelAdaptations: buildChannelAdaptations(input.recommendedChannels),
      seoKeywords: [
        seoContentPackage.keywords.primaryKeyword.value,
        ...seoContentPackage.keywords.secondaryKeywords.map((keyword) => keyword.value),
        ...seoContentPackage.keywords.longTailKeywords.map((keyword) => keyword.value),
      ],
      localizationNotes: [
        language === "ms"
          ? "Malay locale requested; AI Content generated Malay-ready copy where supported."
          : "English content proposal generated; local review is required before publication.",
      ],
      complianceCautions: [
        ...socialContentPackage.riskAndComplianceNotes,
        ...emailContentPackage.complianceNotes,
        ...seoContentPackage.warnings,
        "No generated content should be published, posted, emailed, scheduled, or advertised without approval.",
      ],
      sourceCapabilities: [
        "GenerateProductContentUseCase",
        "GenerateSocialMediaContentUseCase",
        "GenerateEmailContentUseCase",
        "GenerateSEOContentUseCase",
      ],
    };
  }
}

const buildChannelAdaptations = (channels: readonly string[]): readonly ContentChannelAdaptation[] =>
  channels.map((channel) => ({
    channel,
    guidance: `Prepare descriptive content for ${channel}; no posting, scheduling, spending, or delivery action is allowed.`,
  }));

const textFromContent = (content: { readonly snapshot: () => { readonly headline: { readonly value: string }; readonly body: string } }): string => {
  const snapshot = content.snapshot();

  return snapshot.body.length > 0 ? snapshot.body : snapshot.headline.value;
};

const toStableProductId = (title: string): string =>
  `saie-content-${title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")}`;

const toContentTone = (brandVoice: string): "professional" | "friendly" | "conversational" | "persuasive" =>
  brandVoice.toLowerCase().includes("friendly")
    ? "friendly"
    : brandVoice.toLowerCase().includes("conversational")
      ? "conversational"
      : brandVoice.toLowerCase().includes("persuasive")
        ? "persuasive"
        : "professional";

const toSocialPlatform = (
  channel: string | undefined,
): "facebook" | "instagram" | "tiktok" | "linkedin" | "x" | "youtube" | "generic" => {
  const normalized = channel?.toLowerCase() ?? "";

  if (normalized.includes("instagram")) {
    return "instagram";
  }

  if (normalized.includes("tiktok")) {
    return "tiktok";
  }

  if (normalized.includes("facebook") || normalized.includes("meta")) {
    return "facebook";
  }

  if (normalized.includes("youtube")) {
    return "youtube";
  }

  if (normalized.includes("linkedin")) {
    return "linkedin";
  }

  if (normalized === "x" || normalized.includes("twitter")) {
    return "x";
  }

  return "generic";
};
