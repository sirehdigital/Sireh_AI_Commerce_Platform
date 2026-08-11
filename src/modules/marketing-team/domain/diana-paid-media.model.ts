import type { CampaignStrategyPipelineResult } from "../../ai-campaign-strategy/index.js";
import type { AriaCampaignStrategyContribution } from "./maya-aria-specialist.model.js";
import type { LylaCreativeStrategyContribution } from "./luna-lyla-specialist.model.js";
import type {
  FounderMarketingObjectiveIntake,
  SpecialistAssignment,
  SpecialistContribution,
} from "./miss-hermes-director.model.js";
import type {
  MarketingArtifactReference,
  MarketingTeamReviewRequirement,
} from "./marketing-team.model.js";

export const DIANA_PAID_MEDIA_VERSION = "MARKETING-TEAM-01E";
export type PaidMediaChannel = "META" | "TIKTOK" | "OTHER_SUPPORTED_CHANNEL";
export type PaidMediaDataState = "KNOWN" | "SUPPORTED_BY_EVIDENCE" | "ASSUMED" | "NOT_AVAILABLE";
export type PaidMediaAllocationSource =
  | "EXISTING_CANONICAL_ALLOCATION"
  | "DIANA_ADVISORY_RECOMMENDATION";

export interface DianaBudgetConstraints {
  readonly founderEnvelope?: number;
  readonly currency?: string;
  readonly approvedSpend?: number;
  readonly proposedTotal?: number;
  readonly materiallyChangesEconomics: boolean;
}

export interface DianaPaidMediaInput {
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly assignment: SpecialistAssignment;
  readonly founderObjective: FounderMarketingObjectiveIntake;
  readonly sourceReferences: readonly MarketingArtifactReference[];
  readonly targetMarkets: readonly string[];
  readonly targetChannels: readonly PaidMediaChannel[];
  readonly ariaContribution: AriaCampaignStrategyContribution;
  readonly lylaContribution: LylaCreativeStrategyContribution;
  readonly mayaEvidenceReferences: readonly MarketingArtifactReference[];
  readonly campaignConstraints: readonly string[];
  readonly budgetConstraints: DianaBudgetConstraints;
  readonly currencyContext?: string;
  readonly scheduleContext: string;
  readonly trackingPrerequisites: readonly string[];
  readonly measurementPrerequisites: readonly string[];
  readonly evidenceReferences: readonly MarketingArtifactReference[];
  readonly platformAvailability: Readonly<Record<PaidMediaChannel, PaidMediaDataState>>;
  readonly reviewRequirements: readonly MarketingTeamReviewRequirement[];
}

export interface DianaPaidMediaContribution {
  readonly contributionId: string;
  readonly persona: "DIANA";
  readonly role: "PAID_MEDIA";
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly sourceReferences: readonly MarketingArtifactReference[];
  readonly ariaContributionReference: string;
  readonly lylaContributionReference: string;
  readonly mayaEvidenceReferences: readonly MarketingArtifactReference[];
  readonly canonicalStrategyReference: {
    readonly campaignStrategyId: string;
    readonly pipelineVersion: string;
  };
  readonly campaignObjectiveInterpretation: string;
  readonly channelPlan: readonly {
    readonly channel: PaidMediaChannel;
    readonly canonicalChannel?: string;
    readonly allocationPercentage?: number;
    readonly allocationAmount?: number;
    readonly dataState: PaidMediaDataState;
    readonly allocationSource: PaidMediaAllocationSource;
    readonly rationale: string;
  }[];
  readonly budgetAllocationInterpretation: {
    readonly source: PaidMediaAllocationSource;
    readonly canonicalAllocation: CampaignStrategyPipelineResult["budgetAllocation"];
    readonly founderEnvelope?: number;
    readonly advisoryTotal?: number;
    readonly budgetChangeAuthorized: false;
  };
  readonly audienceApproach: readonly string[];
  readonly placementRecommendations: readonly string[];
  readonly creativeRoleRecommendations: CampaignStrategyPipelineResult["creativeAllocation"];
  readonly testingStrategy: readonly string[];
  readonly scalingConditions: readonly string[];
  readonly stopReviewConditions: readonly string[];
  readonly trackingPrerequisites: readonly string[];
  readonly measurementPrerequisites: readonly string[];
  readonly assumptions: readonly string[];
  readonly evidence: readonly MarketingArtifactReference[];
  readonly missingDataIndicators: readonly string[];
  readonly risks: readonly string[];
  readonly limitations: readonly string[];
  readonly alternatives: readonly string[];
  readonly founderDecisionsRequired: readonly string[];
  readonly reviewRequirements: readonly MarketingTeamReviewRequirement[];
  readonly reviewState: "READY" | "REVIEW_REQUIRED" | "BLOCKED";
  readonly escalationReasons: readonly string[];
  readonly attributionVersion: typeof DIANA_PAID_MEDIA_VERSION;
  readonly executionAllowed: false;
}

export interface DianaMiraHandoff {
  readonly handoffId: string;
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly dianaContribution: DianaPaidMediaContribution;
  readonly ariaContributionReference: string;
  readonly lylaContributionReference: string;
  readonly evidenceReferences: readonly MarketingArtifactReference[];
  readonly canonicalAllocationReference: DianaPaidMediaContribution["canonicalStrategyReference"];
  readonly risks: readonly string[];
  readonly assumptions: readonly string[];
  readonly founderBudgetDecisions: readonly string[];
  readonly missingDataIndicators: readonly string[];
  readonly reviewRequirement: "MIRA";
  readonly fromPersona: "DIANA";
  readonly toPersona: "MIRA";
  readonly executionAllowed: false;
}

export interface DianaContributionAdapter {
  readonly diana: SpecialistContribution;
}

export class DianaPaidMediaError extends Error {
  public constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DianaPaidMediaError";
  }
}
