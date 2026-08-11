import type { CreativeIntelligencePipelineResult } from "../../ai-creative-intelligence/index.js";
import type { AriaCampaignStrategyContribution } from "./maya-aria-specialist.model.js";
import type {
  FounderMarketingObjectiveIntake,
  SpecialistAssignment,
  SpecialistContribution,
} from "./miss-hermes-director.model.js";
import type {
  MarketingArtifactReference,
  MarketingTeamReviewRequirement,
} from "./marketing-team.model.js";

export const LUNA_LYLA_VERSION = "MARKETING-TEAM-01D";
export type LunaContentChannel =
  "SHOPIFY" | "FACEBOOK" | "INSTAGRAM" | "THREADS" | "TIKTOK" | "EMAIL" | "LANDING_PAGE";
export type LunaContentType =
  "PRODUCT_COPY" | "SOCIAL_POST" | "EMAIL_COPY" | "LANDING_PAGE_COPY" | "VIDEO_SCRIPT";

export interface LunaClaimInput {
  readonly claimId: string;
  readonly text: string;
  readonly status: "APPROVED_FACT" | "SUPPORTED_CLAIM" | "ASSUMPTION";
  readonly evidenceReferences: readonly MarketingArtifactReference[];
}
export interface LunaContentCopyInput {
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly assignment: SpecialistAssignment;
  readonly founderObjective: FounderMarketingObjectiveIntake;
  readonly ariaContribution: AriaCampaignStrategyContribution;
  readonly productReferences: readonly MarketingArtifactReference[];
  readonly targetMarkets: readonly string[];
  readonly targetChannel: LunaContentChannel;
  readonly contentType: LunaContentType;
  readonly messagingDirection: string;
  readonly claims: readonly LunaClaimInput[];
  readonly brandConstraints: readonly string[];
  readonly contentRequirements: readonly string[];
  readonly reviewRequirements: readonly MarketingTeamReviewRequirement[];
  readonly preparedCopy: {
    readonly hooks: readonly string[];
    readonly headline?: string;
    readonly bodyCopy: string;
    readonly cta: string;
  };
}
export interface LunaContentCopyContribution {
  readonly contributionId: string;
  readonly persona: "LUNA";
  readonly role: "CONTENT_COPY";
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly sourceReferences: readonly MarketingArtifactReference[];
  readonly ariaStrategyReferences: readonly MarketingArtifactReference[];
  readonly channel: LunaContentChannel;
  readonly market: readonly string[];
  readonly contentType: LunaContentType;
  readonly messagingObjective: string;
  readonly hooks: readonly string[];
  readonly headline?: string;
  readonly bodyCopy: string;
  readonly cta: string;
  readonly approvedFacts: readonly LunaClaimInput[];
  readonly supportedClaims: readonly LunaClaimInput[];
  readonly assumptions: readonly LunaClaimInput[];
  readonly creativeCopy: readonly string[];
  readonly recommendations: readonly string[];
  readonly claimReferences: readonly MarketingArtifactReference[];
  readonly risks: readonly string[];
  readonly limitations: readonly string[];
  readonly contentQualityNotes: readonly string[];
  readonly reviewRequirements: readonly MarketingTeamReviewRequirement[];
  readonly escalationReasons: readonly string[];
  readonly reviewState: "READY" | "REVIEW_REQUIRED" | "BLOCKED";
  readonly attributionVersion: typeof LUNA_LYLA_VERSION;
  readonly executionAllowed: false;
}
export interface LunaLylaSpecialistHandoff {
  readonly handoffId: string;
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly lunaContribution: LunaContentCopyContribution;
  readonly sourceReferences: readonly MarketingArtifactReference[];
  readonly ariaStrategyReferences: readonly MarketingArtifactReference[];
  readonly claimReferences: readonly MarketingArtifactReference[];
  readonly dependencies: readonly string[];
  readonly assumptions: readonly LunaClaimInput[];
  readonly risks: readonly string[];
  readonly reviewState: LunaContentCopyContribution["reviewState"];
  readonly fromPersona: "LUNA";
  readonly toPersona: "LYLA";
  readonly executionAllowed: false;
}
export interface LylaCreativeStrategyInput {
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly assignment: SpecialistAssignment;
  readonly ariaContribution: AriaCampaignStrategyContribution;
  readonly lunaHandoff?: LunaLylaSpecialistHandoff;
  readonly productReferences: readonly MarketingArtifactReference[];
  readonly targetMarkets: readonly string[];
  readonly targetPlatforms: readonly string[];
  readonly assetReferences: readonly MarketingArtifactReference[];
  readonly brandConstraints: readonly string[];
  readonly creativeRequirements: readonly string[];
  readonly reviewRequirements: readonly MarketingTeamReviewRequirement[];
  readonly creativeObjective: string;
  readonly creativeAngle: string;
  readonly hookDirection: string;
  readonly visualConcept: string;
  readonly formatRecommendation: string;
  readonly structure: readonly string[];
  readonly ctaDirection: string;
  readonly creativeIntelligence: CreativeIntelligencePipelineResult;
}
export interface LylaCreativeStrategyContribution {
  readonly contributionId: string;
  readonly persona: "LYLA";
  readonly role: "CREATIVE_STRATEGY";
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly ariaReference: string;
  readonly lunaReference?: string;
  readonly sourceReferences: readonly MarketingArtifactReference[];
  readonly targetPlatforms: readonly string[];
  readonly creativeObjective: string;
  readonly creativeAngle: string;
  readonly hookDirection: string;
  readonly visualConcept: string;
  readonly formatRecommendation: string;
  readonly structure: readonly string[];
  readonly ctaDirection: string;
  readonly platformSuitability: CreativeIntelligencePipelineResult["platformSuitability"];
  readonly creativeIntelligenceReference: {
    readonly creativeIntelligenceId: string;
    readonly pipelineVersion: string;
  };
  readonly policyRisks: CreativeIntelligencePipelineResult["policyRisk"];
  readonly brandRisks: readonly string[];
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
  readonly recommendations: CreativeIntelligencePipelineResult["recommendations"];
  readonly reviewRequirements: readonly MarketingTeamReviewRequirement[];
  readonly escalationReasons: readonly string[];
  readonly reviewState: "READY" | "REVIEW_REQUIRED" | "BLOCKED";
  readonly attributionVersion: typeof LUNA_LYLA_VERSION;
  readonly executionAllowed: false;
}
export interface LunaLylaContributionAdapters {
  readonly luna: SpecialistContribution;
  readonly lyla: SpecialistContribution;
}
export class LunaLylaSpecialistError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "LunaLylaSpecialistError";
  }
}
