import type {
  BlogArticleType,
  BlogContentGenerationInput,
  BlogContentGenerationOptionsInput,
  BlogContentPackage,
} from "./blog-content.types.js";
import type {
  ContentQualityScorecard,
  ContentScoringProfile,
} from "./content-quality-scoring.types.js";
import type { LocalizedContentPackage, SupportedLocale } from "./content-localization.types.js";
import type {
  EmailCampaignType,
  EmailContentGenerationInput,
  EmailContentGenerationOptionsInput,
  EmailContentPackage,
} from "./email-content.types.js";
import type {
  ProductContentGenerationOptionsInput,
  ProductContentPackage,
} from "./product-content.types.js";
import type {
  SEOContentGenerationInput,
  SEOContentGenerationOptionsInput,
  SEOContentPackage,
} from "./seo-content.types.js";
import type {
  SocialMediaContentGenerationInput,
  SocialMediaContentGenerationOptionsInput,
  SocialMediaContentPackage,
  SocialPlatform,
} from "./social-media-content.types.js";
import type {
  VideoFormat,
  VideoPlatform,
  VideoScriptGenerationInput,
  VideoScriptGenerationOptionsInput,
  VideoScriptPackage,
} from "./video-script.types.js";
import type { Content, ContentLanguage, ContentTone } from "../../domain/index.js";
import type { ProductToContentInputMapperInput } from "../mappers/product-to-content-input.mapper.js";

export type AIContentStageId =
  | "input-validation"
  | "product-content"
  | "seo-content"
  | "social-content"
  | "video-content"
  | "email-content"
  | "blog-content"
  | "quality-scoring"
  | "quality-gate"
  | "localization"
  | "portfolio-assembly";

export type AIContentStageStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed-with-warnings"
  | "skipped"
  | "failed"
  | "blocked";
export type AIContentStageCriticality = "required" | "optional";
export type AIContentQualityGatePolicy = "strict" | "advisory";
export type AIContentFailurePolicy = "fail-fast" | "partial-success";
export type AIContentPortfolioReadiness =
  | "failed"
  | "partial"
  | "needs-revision"
  | "ready-for-review"
  | "ready-for-approval"
  | "ready-for-publication";

export interface AIContentVideoSelection {
  readonly platform: VideoPlatform;
  readonly format: VideoFormat;
}

export interface AIContentOrchestrationInput {
  readonly product: ProductToContentInputMapperInput;
  readonly targetMarket?: string;
  readonly customerPersona?: string;
  readonly customerSegment?: string;
  readonly valueProposition?: string;
  readonly campaignObjective?: string;
  readonly customerJourneyStage?: string;
  readonly verifiedClaims?: readonly string[];
  readonly verifiedOffers?: readonly string[];
  readonly sourceLanguage?: ContentLanguage;
  readonly sourceLocale?: SupportedLocale;
  readonly targetLocales?: readonly SupportedLocale[];
  readonly correlationId: string;
  readonly campaignId?: string;
  readonly templateReferences?: Readonly<Record<string, string>>;
  readonly customMetadata?: Readonly<Record<string, unknown>>;
  readonly productContentOptions?: ProductContentGenerationOptionsInput;
  readonly seoInput?: Partial<SEOContentGenerationInput>;
  readonly seoOptions?: SEOContentGenerationOptionsInput;
  readonly socialInput?: Partial<SocialMediaContentGenerationInput>;
  readonly socialOptions?: SocialMediaContentGenerationOptionsInput;
  readonly videoInput?: Partial<VideoScriptGenerationInput>;
  readonly videoOptions?: VideoScriptGenerationOptionsInput;
  readonly emailInput?: Partial<EmailContentGenerationInput>;
  readonly emailOptions?: EmailContentGenerationOptionsInput;
  readonly blogInput?: Partial<BlogContentGenerationInput>;
  readonly blogOptions?: BlogContentGenerationOptionsInput;
}

export interface AIContentOrchestrationOptionsInput {
  readonly generateProductContent?: boolean;
  readonly generateSEOContent?: boolean;
  readonly generateSocialContent?: boolean;
  readonly generateVideoContent?: boolean;
  readonly generateEmailContent?: boolean;
  readonly generateBlogContent?: boolean;
  readonly scoreGeneratedContent?: boolean;
  readonly applyQualityGate?: boolean;
  readonly localizeApprovedContent?: boolean;
  readonly selectedSocialPlatforms?: readonly SocialPlatform[];
  readonly selectedVideoConfigurations?: readonly AIContentVideoSelection[];
  readonly selectedEmailCampaignTypes?: readonly EmailCampaignType[];
  readonly selectedBlogArticleTypes?: readonly BlogArticleType[];
  readonly targetLocales?: readonly SupportedLocale[];
  readonly contentTone?: ContentTone;
  readonly strictSafetyMode?: boolean;
  readonly strictQualityMode?: boolean;
  readonly failFastMode?: boolean;
  readonly partialSuccessMode?: boolean;
  readonly qualityGatePolicy?: AIContentQualityGatePolicy;
  readonly minimumApprovalScore?: number;
  readonly minimumPublicationScore?: number;
  readonly maximumWarnings?: number;
  readonly maximumCriticalIssues?: number;
  readonly qualityProfiles?: Partial<Record<AIContentStageId, ContentScoringProfile>>;
  readonly includeAuditTrail?: boolean;
  readonly includeExecutionMetrics?: boolean;
  readonly includeSkippedStageReasons?: boolean;
  readonly includeRawIntermediatePackages?: boolean;
  readonly includeLocalizedPackages?: boolean;
}

export interface AIContentOrchestrationOptions {
  readonly enabledStages: readonly AIContentStageId[];
  readonly selectedSocialPlatforms: readonly SocialPlatform[];
  readonly selectedVideoConfigurations: readonly AIContentVideoSelection[];
  readonly selectedEmailCampaignTypes: readonly EmailCampaignType[];
  readonly selectedBlogArticleTypes: readonly BlogArticleType[];
  readonly targetLocales: readonly SupportedLocale[];
  readonly contentTone?: ContentTone;
  readonly strictSafetyMode: boolean;
  readonly strictQualityMode: boolean;
  readonly failurePolicy: AIContentFailurePolicy;
  readonly qualityGatePolicy: AIContentQualityGatePolicy;
  readonly minimumApprovalScore: number;
  readonly minimumPublicationScore: number;
  readonly maximumWarnings: number;
  readonly maximumCriticalIssues: number;
  readonly qualityProfiles: Partial<Record<AIContentStageId, ContentScoringProfile>>;
  readonly includeAuditTrail: boolean;
  readonly includeExecutionMetrics: boolean;
  readonly includeSkippedStageReasons: boolean;
  readonly includeRawIntermediatePackages: boolean;
  readonly includeLocalizedPackages: boolean;
}

export interface AIContentExecutionStage {
  readonly id: AIContentStageId;
  readonly name: string;
  readonly order: number;
  readonly dependencies: readonly AIContentStageId[];
  readonly criticality: AIContentStageCriticality;
  readonly parallelizable: boolean;
  readonly expectedOutput: string;
}

export interface AIContentExecutionPlan {
  readonly stages: readonly AIContentExecutionStage[];
  readonly requestedStages: readonly AIContentStageId[];
  readonly requiredDependencyStages: readonly AIContentStageId[];
  readonly failurePolicy: AIContentFailurePolicy;
  readonly qualityGatePolicy: AIContentQualityGatePolicy;
  readonly localizationTargets: readonly SupportedLocale[];
}

export interface AIContentStageIssue {
  readonly stageId: AIContentStageId;
  readonly code: string;
  readonly message: string;
  readonly critical: boolean;
}

export interface AIContentStageResult {
  readonly stageId: AIContentStageId;
  readonly stageName: string;
  readonly status: AIContentStageStatus;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
  readonly inputReference: string;
  readonly outputReferences: readonly string[];
  readonly warnings: readonly string[];
  readonly errors: readonly AIContentStageIssue[];
  readonly retryable: boolean;
  readonly skippedReason?: string;
  readonly dependencies: readonly AIContentStageId[];
  readonly criticality: AIContentStageCriticality;
  readonly correlationId: string;
}

export interface AIContentQualityGateResult {
  readonly status: "passed" | "passed-with-warnings" | "failed";
  readonly blockingReasons: readonly string[];
  readonly affectedPackageIds: readonly string[];
  readonly requiredRevisions: readonly string[];
  readonly approvalReady: boolean;
  readonly publicationReady: boolean;
  readonly averageScore: number;
  readonly warningCount: number;
  readonly criticalIssueCount: number;
}

export interface AIContentAuditRecord {
  readonly sequence: number;
  readonly stageId: AIContentStageId;
  readonly action: string;
  readonly status: AIContentStageStatus;
  readonly timestamp: Date;
  readonly inputReference: string;
  readonly outputReferences: readonly string[];
  readonly warningCount: number;
  readonly errorCount: number;
  readonly correlationId: string;
  readonly message: string;
}

export interface AIContentExecutionMetrics {
  readonly stageCount: number;
  readonly completedStageCount: number;
  readonly failedStageCount: number;
  readonly skippedStageCount: number;
  readonly warningCount: number;
  readonly criticalIssueCount: number;
  readonly generatedContentCount: number;
  readonly localizedContentCount: number;
  readonly averageQualityScore: number;
  readonly durationMs: number;
}

export interface AIContentLocalizationSummary {
  readonly requestedLocales: readonly SupportedLocale[];
  readonly completedLocales: readonly SupportedLocale[];
  readonly localizedPackageCount: number;
  readonly reviewRequiredCount: number;
  readonly warningCount: number;
}

export interface AIContentPortfolio {
  readonly productId: string;
  readonly productContentPackage?: ProductContentPackage;
  readonly seoContentPackage?: SEOContentPackage;
  readonly socialContentPackages: readonly SocialMediaContentPackage[];
  readonly videoScriptPackages: readonly VideoScriptPackage[];
  readonly emailContentPackages: readonly EmailContentPackage[];
  readonly blogContentPackages: readonly BlogContentPackage[];
  readonly qualityScorecards: readonly ContentQualityScorecard[];
  readonly localizedContentPackages: readonly LocalizedContentPackage[];
  readonly contents: readonly Content[];
  readonly stageResults: readonly AIContentStageResult[];
  readonly qualityGate: AIContentQualityGateResult;
  readonly localizationSummary: AIContentLocalizationSummary;
  readonly readiness: AIContentPortfolioReadiness;
  readonly approvalReady: boolean;
  readonly publicationReady: boolean;
  readonly warnings: readonly string[];
  readonly errors: readonly AIContentStageIssue[];
  readonly skippedStages: readonly AIContentStageResult[];
  readonly auditTrail: readonly AIContentAuditRecord[];
  readonly executionMetrics?: AIContentExecutionMetrics;
  readonly portfolioMetadata: Readonly<Record<string, unknown>>;
  readonly sourceReferences: readonly string[];
  readonly campaignReferences: readonly string[];
  readonly correlationId: string;
  readonly orchestrationVersion: "SACP AI Content Orchestrator v1";
  readonly orchestratedAt: Date;
}

export interface AIContentOrchestrationClock {
  now(): Date;
}
