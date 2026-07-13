import type {
  EmailCampaignType,
  EmailContentGenerationOptions,
  EmailContentGenerationOptionsInput,
  EmailObjective,
} from "../dto/email-content.types.js";
import {
  UnsupportedEmailCampaignTypeError,
  UnsupportedEmailLanguageError,
  UnsupportedEmailObjectiveError,
} from "../errors/product-content.errors.js";
import { PersonalizationTokenFactory } from "./personalization-token.factory.js";

const CAMPAIGNS: readonly EmailCampaignType[] = [
  "promotional",
  "product-launch",
  "welcome",
  "abandoned-cart",
  "browse-abandonment",
  "post-purchase",
  "cross-sell",
  "upsell",
  "win-back",
  "educational-nurture",
  "product-education",
  "announcement",
  "re-engagement",
  "feedback-request",
  "review-request-framework",
  "back-in-stock-framework",
  "limited-offer-framework",
];
const OBJECTIVES: readonly EmailObjective[] = [
  "awareness",
  "engagement",
  "traffic",
  "conversion",
  "education",
  "retention",
  "recovery",
  "re-engagement",
  "product-launch",
  "customer-support",
  "relationship-building",
];

export class EmailContentOptionsFactory {
  public constructor(private readonly tokenFactory = new PersonalizationTokenFactory()) {}

  public create(input: EmailContentGenerationOptionsInput = {}): EmailContentGenerationOptions {
    const campaignType = input.campaignType ?? "promotional";
    const objective = input.objective ?? defaultObjective(campaignType);
    const language = input.language ?? "en";

    if (!CAMPAIGNS.includes(campaignType)) {
      throw new UnsupportedEmailCampaignTypeError(campaignType);
    }
    if (!OBJECTIVES.includes(objective)) {
      throw new UnsupportedEmailObjectiveError(objective);
    }
    if (language !== "en" && language !== "ms") {
      throw new UnsupportedEmailLanguageError(language);
    }

    return {
      campaignType,
      objective,
      language,
      tone: input.tone ?? "friendly",
      emailLength: input.emailLength ?? "medium",
      subjectLineCount: clamp(input.subjectLineCount ?? 4, 1, 6),
      preheaderCount: clamp(input.preheaderCount ?? 3, 1, 5),
      ctaCount: clamp(input.ctaCount ?? 1, 1, 3),
      includeSecondaryCTA: input.includeSecondaryCTA ?? campaignType !== "abandoned-cart",
      includePersonalization: input.includePersonalization ?? true,
      personalizationTokens: this.tokenFactory.create(input.personalizationTokens),
      includePlainTextVersion: input.includePlainTextVersion ?? true,
      includeTrustSection: input.includeTrustSection ?? true,
      includeObjectionHandling: input.includeObjectionHandling ?? campaignType === "abandoned-cart",
      includeEducationalSection: input.includeEducationalSection ?? campaignType.includes("education"),
      includeProductHighlights: input.includeProductHighlights ?? true,
      includeSequence: input.includeSequence ?? false,
      sequenceLength: input.sequenceLength ?? 3,
      strictClaimSafety: input.strictClaimSafety ?? true,
      strictCompliance: input.strictCompliance ?? true,
      strictPersonalization: input.strictPersonalization ?? true,
      strictOfferValidation: input.strictOfferValidation ?? true,
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
    };
  }
}

function defaultObjective(campaignType: EmailCampaignType): EmailObjective {
  if (campaignType === "abandoned-cart" || campaignType === "browse-abandonment") {
    return "recovery";
  }
  if (campaignType === "post-purchase") {
    return "retention";
  }
  if (campaignType === "product-launch") {
    return "product-launch";
  }
  if (campaignType.includes("education")) {
    return "education";
  }
  return "conversion";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
