import type {
  Content,
  ContentChannel,
  ContentLanguage,
  ContentTemplateId,
  ContentTone,
  CTA,
} from "../../domain/index.js";
import type { ProductContentPackage } from "./product-content.types.js";
import type { SEOContentPackage } from "./seo-content.types.js";
import type { SocialMediaContentPackage } from "./social-media-content.types.js";

export type VideoPlatform =
  | "tiktok"
  | "instagram-reels"
  | "facebook-reels"
  | "youtube-shorts"
  | "youtube"
  | "generic-video";

export type VideoFormat =
  | "short-form"
  | "standard-product-video"
  | "product-demonstration"
  | "problem-solution"
  | "educational"
  | "feature-spotlight"
  | "faq"
  | "objection-handling"
  | "launch"
  | "brand-story"
  | "testimonial-framework"
  | "unboxing-framework"
  | "comparison"
  | "lifestyle"
  | "tutorial";

export type VideoObjective =
  | "awareness"
  | "engagement"
  | "traffic"
  | "conversion"
  | "education"
  | "product-launch"
  | "demonstration"
  | "retargeting"
  | "brand-positioning";

export type VideoContentAngle =
  | "product-benefit"
  | "problem-solution"
  | "educational"
  | "demonstration"
  | "feature-spotlight"
  | "brand-story"
  | "faq"
  | "objection-handling"
  | "testimonial-framework"
  | "unboxing-framework"
  | "comparison"
  | "lifestyle"
  | "launch";

export type VideoDurationSeconds = 15 | 30 | 45 | 60 | 90 | 120 | 180 | 300;
export type VideoPresenterStyle = "voiceover-only" | "presenter-to-camera" | "mixed" | "text-led";
export type VideoHookStyle =
  | "question"
  | "direct-benefit"
  | "problem"
  | "curiosity"
  | "demonstration"
  | "educational"
  | "feature-reveal"
  | "lifestyle"
  | "objection-handling";

export interface VideoAudienceInput {
  readonly primaryAudience?: string;
  readonly targetMarket?: string;
  readonly description?: string;
  readonly customerProblems?: readonly string[];
  readonly customerDesires?: readonly string[];
  readonly purchaseMotivations?: readonly string[];
  readonly objections?: readonly string[];
}

export interface VideoMarketingAngleInput {
  readonly title: string;
  readonly hook?: string;
  readonly coreBenefit?: string;
  readonly emotionalOutcome?: string;
  readonly targetAudience?: string;
}

export interface SourceMediaMetadata {
  readonly brandColorReference?: string;
  readonly availableProductImages?: number;
  readonly packagingDescription?: string;
  readonly materialNotes?: readonly string[];
  readonly ingredientNotes?: readonly string[];
}

export interface VideoScriptGenerationInput {
  readonly productId: string;
  readonly productTitle: string;
  readonly productSubtitle?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly productDescription?: string;
  readonly features?: readonly string[];
  readonly benefits?: readonly string[];
  readonly highlights?: readonly string[];
  readonly productRisks?: readonly string[];
  readonly usageInstructions?: readonly string[];
  readonly materialsOrIngredients?: readonly string[];
  readonly productContentPackage?: ProductContentPackage;
  readonly seoContentPackage?: SEOContentPackage;
  readonly socialMediaContentPackage?: SocialMediaContentPackage;
  readonly targetAudience?: VideoAudienceInput;
  readonly customerPersona?: string;
  readonly marketingAngles?: readonly VideoMarketingAngleInput[];
  readonly valueProposition?: string;
  readonly campaignObjective?: VideoObjective;
  readonly campaignMessage?: string;
  readonly targetMarkets?: readonly string[];
  readonly language?: ContentLanguage;
  readonly tone?: ContentTone;
  readonly sourceMediaMetadata?: SourceMediaMetadata;
  readonly campaignId?: string;
  readonly correlationId?: string;
  readonly sourceMarketingAnalysisId?: string;
  readonly templateId?: ContentTemplateId;
}

export interface VideoScriptGenerationOptionsInput {
  readonly platform?: VideoPlatform;
  readonly format?: VideoFormat;
  readonly language?: ContentLanguage;
  readonly tone?: ContentTone;
  readonly objective?: VideoObjective;
  readonly contentAngle?: VideoContentAngle;
  readonly targetDurationSeconds?: VideoDurationSeconds;
  readonly presenterStyle?: VideoPresenterStyle;
  readonly voiceoverEnabled?: boolean;
  readonly presenterDialogueEnabled?: boolean;
  readonly onScreenTextEnabled?: boolean;
  readonly captionEnabled?: boolean;
  readonly ctaEnabled?: boolean;
  readonly sceneLimit?: number;
  readonly hookStyle?: VideoHookStyle;
  readonly includeDemonstration?: boolean;
  readonly includeBRoll?: boolean;
  readonly includeTransitions?: boolean;
  readonly includeThumbnailSuggestion?: boolean;
  readonly includeMusicOrMoodGuidance?: boolean;
  readonly strictClaimSafety?: boolean;
  readonly strictTiming?: boolean;
  readonly strictPlatformCompliance?: boolean;
  readonly templateId?: ContentTemplateId;
}

export interface VideoScriptGenerationOptions {
  readonly platform: VideoPlatform;
  readonly format: VideoFormat;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly objective: VideoObjective;
  readonly contentAngle: VideoContentAngle;
  readonly targetDurationSeconds: VideoDurationSeconds;
  readonly presenterStyle: VideoPresenterStyle;
  readonly voiceoverEnabled: boolean;
  readonly presenterDialogueEnabled: boolean;
  readonly onScreenTextEnabled: boolean;
  readonly captionEnabled: boolean;
  readonly ctaEnabled: boolean;
  readonly sceneLimit: number;
  readonly hookStyle: VideoHookStyle;
  readonly includeDemonstration: boolean;
  readonly includeBRoll: boolean;
  readonly includeTransitions: boolean;
  readonly includeThumbnailSuggestion: boolean;
  readonly includeMusicOrMoodGuidance: boolean;
  readonly strictClaimSafety: boolean;
  readonly strictTiming: boolean;
  readonly strictPlatformCompliance: boolean;
  readonly templateId?: ContentTemplateId;
}

export interface VideoTiming {
  readonly startSecond: number;
  readonly endSecond: number;
  readonly durationSeconds: number;
}

export interface VideoScene {
  readonly sceneNumber: number;
  readonly purpose: string;
  readonly timing: VideoTiming;
  readonly shotType: string;
  readonly visualDirection: string;
  readonly voiceover?: string;
  readonly presenterDialogue?: string;
  readonly onScreenText?: string;
  readonly productFocus?: string;
  readonly ctaMarker: boolean;
  readonly transition?: string;
  readonly bRollSuggestion?: string;
  readonly complianceNote?: string;
  readonly spokenWordEstimate: number;
}

export interface VideoShot {
  readonly sequence: number;
  readonly shotType: string;
  readonly direction: string;
  readonly sceneNumber: number;
}

export interface VideoScriptWarning {
  readonly code: string;
  readonly message: string;
}

export interface VideoScriptPackage {
  readonly productId: string;
  readonly platform: VideoPlatform;
  readonly channel: ContentChannel;
  readonly format: VideoFormat;
  readonly objective: VideoObjective;
  readonly contentAngle: VideoContentAngle;
  readonly targetDurationSeconds: VideoDurationSeconds;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly scriptTitle: string;
  readonly hook: string;
  readonly scenes: readonly VideoScene[];
  readonly shotList: readonly VideoShot[];
  readonly voiceoverScript: string;
  readonly presenterDialogue: string;
  readonly onScreenText: readonly string[];
  readonly visualDirection: readonly string[];
  readonly productDemonstrationNotes: readonly string[];
  readonly bRollSuggestions: readonly string[];
  readonly transitionGuidance: readonly string[];
  readonly musicOrMoodGuidance?: string;
  readonly captionText?: string;
  readonly cta?: CTA;
  readonly endCardText?: string;
  readonly thumbnailTextSuggestion?: string;
  readonly safetyNotes: readonly string[];
  readonly complianceNotes: readonly string[];
  readonly missingSourceWarnings: readonly VideoScriptWarning[];
  readonly contents: readonly Content[];
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
  readonly generatedAt: Date;
}
