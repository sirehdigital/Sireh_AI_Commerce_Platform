import type {
  Content,
  ContentChannel,
  ContentLanguage,
  ContentTemplateId,
  ContentTone,
  CTA,
} from "../../domain/index.js";
import type { ProductContentPackage } from "./product-content.types.js";
import type { SEOContentPackage, SEOKeywordSet } from "./seo-content.types.js";

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "x"
  | "youtube"
  | "generic";

export type SocialObjective =
  | "awareness"
  | "engagement"
  | "traffic"
  | "conversion"
  | "education"
  | "product-launch"
  | "retargeting"
  | "community-building"
  | "lead-generation"
  | "brand-positioning";

export type SocialContentAngle =
  | "product-benefit"
  | "problem-solution"
  | "educational"
  | "lifestyle"
  | "demonstration"
  | "before-after-concept"
  | "social-proof-framework"
  | "objection-handling"
  | "feature-spotlight"
  | "brand-story"
  | "comparison"
  | "faq"
  | "seasonal"
  | "launch"
  | "limited-offer";

export type SocialCaptionLength = "short" | "medium" | "long";
export type SocialHookStyle =
  | "question"
  | "problem"
  | "benefit"
  | "curiosity"
  | "educational"
  | "direct"
  | "lifestyle"
  | "contrarian";

export interface SocialMarketingAngleInput {
  readonly title: string;
  readonly hook?: string;
  readonly coreBenefit?: string;
  readonly emotionalOutcome?: string;
  readonly targetAudience?: string;
}

export interface SocialAudienceInput {
  readonly primaryAudience?: string;
  readonly targetMarket?: string;
  readonly description?: string;
  readonly customerProblems?: readonly string[];
  readonly customerDesires?: readonly string[];
  readonly purchaseMotivations?: readonly string[];
  readonly objections?: readonly string[];
}

export interface SocialMediaContentGenerationInput {
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
  readonly tags?: readonly string[];
  readonly productRisks?: readonly string[];
  readonly usageInformation?: string;
  readonly productContentPackage?: ProductContentPackage;
  readonly seoContentPackage?: SEOContentPackage;
  readonly seoKeywordSet?: SEOKeywordSet;
  readonly targetAudience?: SocialAudienceInput;
  readonly customerPersona?: string;
  readonly customerSegment?: string;
  readonly marketingAngles?: readonly SocialMarketingAngleInput[];
  readonly valueProposition?: string;
  readonly campaignObjective?: SocialObjective;
  readonly campaignMessage?: string;
  readonly targetMarkets?: readonly string[];
  readonly language?: ContentLanguage;
  readonly tone?: ContentTone;
  readonly platform?: SocialPlatform;
  readonly campaignId?: string;
  readonly correlationId?: string;
  readonly sourceMarketingAnalysisId?: string;
  readonly templateId?: ContentTemplateId;
}

export interface SocialMediaContentGenerationOptionsInput {
  readonly platform?: SocialPlatform;
  readonly language?: ContentLanguage;
  readonly tone?: ContentTone;
  readonly objective?: SocialObjective;
  readonly captionLength?: SocialCaptionLength;
  readonly hashtagCount?: number;
  readonly ctaCount?: number;
  readonly hookStyle?: SocialHookStyle;
  readonly contentAngle?: SocialContentAngle;
  readonly includeEmojis?: boolean;
  readonly includeEngagementQuestion?: boolean;
  readonly includeSavePrompt?: boolean;
  readonly includeSharePrompt?: boolean;
  readonly includeCarouselContent?: boolean;
  readonly carouselSlideLimit?: number;
  readonly includeStoryContent?: boolean;
  readonly storyFrameLimit?: number;
  readonly includeVisualDirection?: boolean;
  readonly strictClaimSafety?: boolean;
  readonly strictPlatformCompliance?: boolean;
  readonly templateId?: ContentTemplateId;
}

export interface SocialMediaContentGenerationOptions {
  readonly platform: SocialPlatform;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly objective: SocialObjective;
  readonly captionLength: SocialCaptionLength;
  readonly hashtagCount: number;
  readonly ctaCount: number;
  readonly hookStyle: SocialHookStyle;
  readonly contentAngle: SocialContentAngle;
  readonly includeEmojis: boolean;
  readonly includeEngagementQuestion: boolean;
  readonly includeSavePrompt: boolean;
  readonly includeSharePrompt: boolean;
  readonly includeCarouselContent: boolean;
  readonly carouselSlideLimit: number;
  readonly includeStoryContent: boolean;
  readonly storyFrameLimit: number;
  readonly includeVisualDirection: boolean;
  readonly strictClaimSafety: boolean;
  readonly strictPlatformCompliance: boolean;
  readonly templateId?: ContentTemplateId;
}

export interface SocialCarouselSlide {
  readonly sequence: number;
  readonly title: string;
  readonly body: string;
}

export interface SocialStoryFrame {
  readonly sequence: number;
  readonly text: string;
  readonly guidance?: string;
}

export interface SocialVisualDirection {
  readonly concept: string;
  readonly overlayText: string;
  readonly notes: readonly string[];
}

export interface SocialPlatformWarning {
  readonly code: string;
  readonly message: string;
}

export interface SocialMediaContentPackage {
  readonly productId: string;
  readonly platform: SocialPlatform;
  readonly channel: ContentChannel;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly objective: SocialObjective;
  readonly contentAngle: SocialContentAngle;
  readonly hook: string;
  readonly primaryCaption: string;
  readonly shortCaption: string;
  readonly longCaption?: string;
  readonly ctas: readonly CTA[];
  readonly hashtags: readonly string[];
  readonly productHighlights: readonly string[];
  readonly benefitBullets: readonly string[];
  readonly engagementQuestion?: string;
  readonly commentPrompt?: string;
  readonly savePrompt?: string;
  readonly sharePrompt?: string;
  readonly linkPrompt?: string;
  readonly visualDirection?: SocialVisualDirection;
  readonly imageOverlayText?: string;
  readonly carouselSlides: readonly SocialCarouselSlide[];
  readonly storyFrames: readonly SocialStoryFrame[];
  readonly shortFormPostConcept?: string;
  readonly socialProofGuidance: readonly string[];
  readonly riskAndComplianceNotes: readonly string[];
  readonly platformWarnings: readonly SocialPlatformWarning[];
  readonly contents: readonly Content[];
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
  readonly generatedAt: Date;
}
