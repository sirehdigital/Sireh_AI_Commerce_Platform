import type {
  Content,
  ContentLanguage,
  ContentTemplateId,
  ContentTone,
  CTA,
} from "../../domain/index.js";
import type { ProductContentPackage } from "./product-content.types.js";
import type { SEOContentPackage } from "./seo-content.types.js";
import type { SocialMediaContentPackage } from "./social-media-content.types.js";
import type { VideoScriptPackage } from "./video-script.types.js";

export type EmailCampaignType =
  | "promotional"
  | "product-launch"
  | "welcome"
  | "abandoned-cart"
  | "browse-abandonment"
  | "post-purchase"
  | "cross-sell"
  | "upsell"
  | "win-back"
  | "educational-nurture"
  | "product-education"
  | "announcement"
  | "re-engagement"
  | "feedback-request"
  | "review-request-framework"
  | "back-in-stock-framework"
  | "limited-offer-framework";

export type EmailObjective =
  | "awareness"
  | "engagement"
  | "traffic"
  | "conversion"
  | "education"
  | "retention"
  | "recovery"
  | "re-engagement"
  | "product-launch"
  | "customer-support"
  | "relationship-building";

export type EmailLength = "short" | "medium" | "long";
export type EmailJourneyStage = "new-subscriber" | "consideration" | "cart" | "customer" | "lapsed" | "education";
export type PersonalizationToken =
  | "{{first_name}}"
  | "{{brand_name}}"
  | "{{product_name}}"
  | "{{cart_url}}"
  | "{{product_url}}"
  | "{{order_number}}"
  | "{{support_url}}"
  | "{{unsubscribe_url}}";

export interface EmailAudienceInput {
  readonly primaryAudience?: string;
  readonly customerSegment?: string;
  readonly description?: string;
  readonly customerProblems?: readonly string[];
  readonly purchaseMotivations?: readonly string[];
  readonly objections?: readonly string[];
}

export interface EmailOfferContext {
  readonly verified: boolean;
  readonly offerType?: string;
  readonly discountDescription?: string;
  readonly eligibility?: string;
  readonly expiryContext?: string;
  readonly productApplicability?: string;
}

export interface EmailCartContext {
  readonly cartUrl?: string;
  readonly itemCount?: number;
  readonly productInCart?: boolean;
}

export interface EmailBrowseContext {
  readonly productUrl?: string;
  readonly browsedCategory?: string;
}

export interface EmailOrderContext {
  readonly orderNumber?: string;
  readonly supportUrl?: string;
}

export interface EmailStockContext {
  readonly verifiedBackInStock: boolean;
  readonly stockContext?: string;
}

export interface EmailContentGenerationInput {
  readonly productId: string;
  readonly productTitle: string;
  readonly productSubtitle?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly productDescription?: string;
  readonly benefits?: readonly string[];
  readonly features?: readonly string[];
  readonly highlights?: readonly string[];
  readonly productRisks?: readonly string[];
  readonly usageGuidance?: readonly string[];
  readonly productContentPackage?: ProductContentPackage;
  readonly seoContentPackage?: SEOContentPackage;
  readonly socialMediaContentPackage?: SocialMediaContentPackage;
  readonly videoScriptPackage?: VideoScriptPackage;
  readonly targetAudience?: EmailAudienceInput;
  readonly customerPersona?: string;
  readonly customerSegment?: string;
  readonly marketingAngle?: string;
  readonly valueProposition?: string;
  readonly campaignObjective?: EmailObjective;
  readonly customerJourneyStage?: EmailJourneyStage;
  readonly lifecycleStage?: string;
  readonly purchaseContext?: string;
  readonly cartContext?: EmailCartContext;
  readonly browseContext?: EmailBrowseContext;
  readonly orderContext?: EmailOrderContext;
  readonly offerContext?: EmailOfferContext;
  readonly stockContext?: EmailStockContext;
  readonly language?: ContentLanguage;
  readonly tone?: ContentTone;
  readonly campaignId?: string;
  readonly correlationId?: string;
  readonly sourceMarketingAnalysisId?: string;
  readonly templateId?: ContentTemplateId;
}

export interface EmailContentGenerationOptionsInput {
  readonly campaignType?: EmailCampaignType;
  readonly objective?: EmailObjective;
  readonly language?: ContentLanguage;
  readonly tone?: ContentTone;
  readonly emailLength?: EmailLength;
  readonly subjectLineCount?: number;
  readonly preheaderCount?: number;
  readonly ctaCount?: number;
  readonly includeSecondaryCTA?: boolean;
  readonly includePersonalization?: boolean;
  readonly personalizationTokens?: readonly string[];
  readonly includePlainTextVersion?: boolean;
  readonly includeTrustSection?: boolean;
  readonly includeObjectionHandling?: boolean;
  readonly includeEducationalSection?: boolean;
  readonly includeProductHighlights?: boolean;
  readonly includeSequence?: boolean;
  readonly sequenceLength?: 2 | 3 | 5;
  readonly strictClaimSafety?: boolean;
  readonly strictCompliance?: boolean;
  readonly strictPersonalization?: boolean;
  readonly strictOfferValidation?: boolean;
  readonly templateId?: ContentTemplateId;
}

export interface EmailContentGenerationOptions {
  readonly campaignType: EmailCampaignType;
  readonly objective: EmailObjective;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly emailLength: EmailLength;
  readonly subjectLineCount: number;
  readonly preheaderCount: number;
  readonly ctaCount: number;
  readonly includeSecondaryCTA: boolean;
  readonly includePersonalization: boolean;
  readonly personalizationTokens: readonly PersonalizationToken[];
  readonly includePlainTextVersion: boolean;
  readonly includeTrustSection: boolean;
  readonly includeObjectionHandling: boolean;
  readonly includeEducationalSection: boolean;
  readonly includeProductHighlights: boolean;
  readonly includeSequence: boolean;
  readonly sequenceLength: 2 | 3 | 5;
  readonly strictClaimSafety: boolean;
  readonly strictCompliance: boolean;
  readonly strictPersonalization: boolean;
  readonly strictOfferValidation: boolean;
  readonly templateId?: ContentTemplateId;
}

export interface EmailSection {
  readonly key: string;
  readonly title: string;
  readonly body: string;
}

export interface EmailSequenceItem {
  readonly position: number;
  readonly purpose: string;
  readonly subjectLine: string;
  readonly preheader: string;
  readonly headline: string;
  readonly bodySummary: string;
  readonly cta: string;
  readonly delayGuidance: string;
}

export interface EmailWarning {
  readonly code: string;
  readonly message: string;
}

export interface EmailContentPackage {
  readonly productId: string;
  readonly campaignType: EmailCampaignType;
  readonly objective: EmailObjective;
  readonly audience?: EmailAudienceInput;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly subjectLines: readonly string[];
  readonly recommendedSubjectLine: string;
  readonly preheaders: readonly string[];
  readonly recommendedPreheader: string;
  readonly headline: string;
  readonly openingParagraph: string;
  readonly mainBody: string;
  readonly productHighlights: readonly string[];
  readonly benefits: readonly string[];
  readonly supportingFeatures: readonly string[];
  readonly objectionHandlingSection?: EmailSection;
  readonly trustBuildingSection?: EmailSection;
  readonly educationalSection?: EmailSection;
  readonly cta: CTA;
  readonly secondaryCTA?: CTA;
  readonly buttonLabels: readonly string[];
  readonly textLinkLabels: readonly string[];
  readonly personalizationTokens: readonly PersonalizationToken[];
  readonly footerGuidance: string;
  readonly unsubscribePlaceholderGuidance: string;
  readonly complianceNotes: readonly string[];
  readonly plainTextVersion?: string;
  readonly htmlSafeSections: readonly EmailSection[];
  readonly sequence: readonly EmailSequenceItem[];
  readonly warnings: readonly EmailWarning[];
  readonly contents: readonly Content[];
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
  readonly generatedAt: Date;
}
