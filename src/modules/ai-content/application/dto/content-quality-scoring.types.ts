import type {
  Content,
  ContentAudience,
  ContentChannel,
  ContentLanguage,
  ContentScore,
  ContentSearchIntent,
  ContentSEO,
  ContentTone,
  ContentType,
  CTA,
} from "../../domain/index.js";
import type { BlogContentPackage } from "./blog-content.types.js";
import type { EmailContentPackage } from "./email-content.types.js";
import type { ProductContentPackage } from "./product-content.types.js";
import type { SEOContentPackage } from "./seo-content.types.js";
import type { SocialMediaContentPackage } from "./social-media-content.types.js";
import type { VideoScriptPackage } from "./video-script.types.js";

export type ContentScoringProfile =
  | "balanced"
  | "conversion-focused"
  | "seo-focused"
  | "brand-focused"
  | "safety-focused"
  | "readability-focused"
  | "social-engagement-focused"
  | "email-conversion-focused"
  | "video-performance-readiness"
  | "editorial-quality-focused";

export type ContentQualityDimension =
  | "clarity"
  | "relevance"
  | "persuasiveness"
  | "readability"
  | "seoQuality"
  | "brandAlignment"
  | "audienceAlignment"
  | "channelSuitability"
  | "structuralQuality"
  | "ctaQuality"
  | "claimSafety"
  | "complianceReadiness"
  | "toneConsistency"
  | "languageConsistency"
  | "factualGrounding"
  | "originalityHeuristic"
  | "actionability";

export type ContentQualityRuleStatus = "pass" | "warning" | "fail";
export type ContentQualityCriticality = "low" | "medium" | "high" | "critical";
export type ContentApprovalReadiness =
  | "not-ready"
  | "needs-revision"
  | "ready-for-review"
  | "ready-for-approval"
  | "ready-for-publication";

export interface ContentQualityScoringInput {
  readonly contentId: string;
  readonly content?: Content;
  readonly contentType: ContentType;
  readonly channel: ContentChannel;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly audience?: ContentAudience;
  readonly headline: string;
  readonly body: string;
  readonly structuredContent: Readonly<Record<string, string>>;
  readonly cta?: CTA;
  readonly seo?: ContentSEO;
  readonly searchIntent?: ContentSearchIntent;
  readonly productSourceData?: Readonly<Record<string, unknown>>;
  readonly marketingSourceData?: Readonly<Record<string, unknown>>;
  readonly productContentPackage?: ProductContentPackage;
  readonly seoContentPackage?: SEOContentPackage;
  readonly socialMediaContentPackage?: SocialMediaContentPackage;
  readonly videoScriptPackage?: VideoScriptPackage;
  readonly emailContentPackage?: EmailContentPackage;
  readonly blogContentPackage?: BlogContentPackage;
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
  readonly campaignMetadata: Readonly<Record<string, unknown>>;
  readonly correlationMetadata: Readonly<Record<string, unknown>>;
}

export interface ContentQualityScoringOptionsInput {
  readonly scoringProfile?: ContentScoringProfile;
  readonly contentType?: ContentType;
  readonly channel?: ContentChannel;
  readonly language?: ContentLanguage;
  readonly objective?: string;
  readonly strictSafetyMode?: boolean;
  readonly strictComplianceMode?: boolean;
  readonly strictSEOMode?: boolean;
  readonly strictReadabilityMode?: boolean;
  readonly includeRecommendations?: boolean;
  readonly includeRevisionGuidance?: boolean;
  readonly includeFailedRuleDetails?: boolean;
  readonly minimumApprovalScore?: number;
  readonly minimumPublishScore?: number;
  readonly customDimensionWeights?: Partial<Record<ContentQualityDimension, number>>;
  readonly maximumRecommendationCount?: number;
  readonly maximumIssueCount?: number;
  readonly assignScoreToContent?: boolean;
}

export interface ContentQualityScoringOptions {
  readonly scoringProfile: ContentScoringProfile;
  readonly contentType?: ContentType;
  readonly channel?: ContentChannel;
  readonly language?: ContentLanguage;
  readonly objective?: string;
  readonly strictSafetyMode: boolean;
  readonly strictComplianceMode: boolean;
  readonly strictSEOMode: boolean;
  readonly strictReadabilityMode: boolean;
  readonly includeRecommendations: boolean;
  readonly includeRevisionGuidance: boolean;
  readonly includeFailedRuleDetails: boolean;
  readonly minimumApprovalScore: number;
  readonly minimumPublishScore: number;
  readonly dimensionWeights: Readonly<Record<ContentQualityDimension, number>>;
  readonly maximumRecommendationCount: number;
  readonly maximumIssueCount: number;
  readonly assignScoreToContent: boolean;
}

export interface ContentQualityRuleEvaluation {
  readonly ruleId: string;
  readonly dimension: ContentQualityDimension;
  readonly description: string;
  readonly status: ContentQualityRuleStatus;
  readonly score: number;
  readonly evidence: readonly string[];
  readonly recommendation?: string;
  readonly criticality: ContentQualityCriticality;
  readonly applicable: boolean;
}

export interface ContentDimensionScore {
  readonly dimension: ContentQualityDimension;
  readonly score: number;
  readonly weight: number;
  readonly passedChecks: readonly string[];
  readonly failedChecks: readonly string[];
  readonly warnings: readonly string[];
  readonly evidence: readonly string[];
}

export interface ContentQualityRecommendation {
  readonly priority: number;
  readonly dimension: ContentQualityDimension;
  readonly recommendation: string;
  readonly ruleId: string;
  readonly blocking: boolean;
}

export interface ContentRevisionGuidance {
  readonly priority: number;
  readonly dimension: ContentQualityDimension;
  readonly problem: string;
  readonly whyItMatters: string;
  readonly suggestedAction: string;
  readonly affectedContentSection: string;
  readonly blocking: boolean;
  readonly requiresReevaluation: boolean;
}

export interface ContentQualityScorecard {
  readonly contentId: string;
  readonly overallScore: number;
  readonly dimensionScores: readonly ContentDimensionScore[];
  readonly appliedWeights: Readonly<Record<ContentQualityDimension, number>>;
  readonly passedChecks: readonly string[];
  readonly failedChecks: readonly string[];
  readonly warnings: readonly string[];
  readonly criticalIssues: readonly ContentQualityRuleEvaluation[];
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly recommendations: readonly ContentQualityRecommendation[];
  readonly revisionGuidance: readonly ContentRevisionGuidance[];
  readonly approvalReadiness: ContentApprovalReadiness;
  readonly publicationReadiness: boolean;
  readonly scoringProfile: ContentScoringProfile;
  readonly contentType: ContentType;
  readonly channel: ContentChannel;
  readonly language: ContentLanguage;
  readonly evaluatedMetadata: Readonly<Record<string, unknown>>;
  readonly scoringVersion: "SACP Content Quality Rule Engine v1";
  readonly evaluatedAt: Date;
  readonly contentScore: ContentScore;
  readonly updatedContent?: Content;
}
