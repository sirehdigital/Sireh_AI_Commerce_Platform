import type { CampaignStrategyPipelineResult } from "../../ai-campaign-strategy/index.js";
import type {
  FounderMarketingObjectiveIntake,
  SpecialistAssignment,
  SpecialistContribution,
} from "./miss-hermes-director.model.js";
import type { MarketingArtifactReference } from "./marketing-team.model.js";

export const MAYA_ARIA_VERSION = "MARKETING-TEAM-01C";
export const EVIDENCE_QUALITY_LEVELS = ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"] as const;
export type EvidenceQualityLevel = (typeof EVIDENCE_QUALITY_LEVELS)[number];
export type EvidenceFreshness = "CURRENT" | "AGING" | "STALE" | "UNKNOWN";
export type EvidenceProvenance = "PRIMARY" | "INTERNAL" | "APPROVED_EXTERNAL" | "UNKNOWN";
export type IntelligenceStatementKind =
  "OBSERVED_FACT" | "CALCULATED_SIGNAL" | "ASSUMPTION" | "INFERENCE";

export interface MarketEvidenceItem extends MarketingArtifactReference {
  readonly claimKey: string;
  readonly statement: string;
  readonly value: string;
  readonly kind: IntelligenceStatementKind;
  readonly provenance: EvidenceProvenance;
  readonly observedAt?: string;
  readonly dimensions: readonly string[];
  readonly privacySensitive?: boolean;
}

export interface MayaMarketIntelligenceInput {
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly assignment: SpecialistAssignment;
  readonly objectiveReference: MarketingArtifactReference;
  readonly productReference: MarketingArtifactReference;
  readonly targetMarkets: readonly string[];
  readonly intendedChannels: readonly string[];
  readonly commerceContext?: MarketingArtifactReference;
  readonly evidence: readonly MarketEvidenceItem[];
  readonly requestedDimensions: readonly string[];
  readonly freshnessThresholdDays: number;
  readonly constraints: readonly string[];
  readonly evaluatedAt: string;
}

export interface EvidenceQualityAssessment {
  readonly level: EvidenceQualityLevel;
  readonly sourceAvailable: boolean;
  readonly provenanceAdequate: boolean;
  readonly freshness: EvidenceFreshness;
  readonly consistent: boolean;
  readonly complete: boolean;
  readonly relevant: boolean;
  readonly reasons: readonly string[];
}

export interface MayaMarketIntelligenceContribution {
  readonly contributionId: string;
  readonly persona: "MAYA";
  readonly role: "MARKET_INTELLIGENCE";
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly sourceReferences: readonly MarketingArtifactReference[];
  readonly marketScope: readonly string[];
  readonly productContext: MarketingArtifactReference;
  readonly audienceObservations: readonly string[];
  readonly marketObservations: readonly string[];
  readonly demandOpportunitySignals: readonly string[];
  readonly commerceSignals: readonly string[];
  readonly observedFacts: readonly string[];
  readonly calculatedSignals: readonly string[];
  readonly assumptions: readonly string[];
  readonly inferences: readonly string[];
  readonly recommendations: readonly string[];
  readonly risks: readonly string[];
  readonly evidence: readonly MarketEvidenceItem[];
  readonly evidenceQuality: EvidenceQualityAssessment;
  readonly limitations: readonly string[];
  readonly confidence: EvidenceQualityLevel;
  readonly escalationReasons: readonly string[];
  readonly reviewState: "READY" | "REVIEW_REQUIRED" | "BLOCKED";
  readonly attributionVersion: typeof MAYA_ARIA_VERSION;
  readonly executionAllowed: false;
}

export interface MayaAriaSpecialistHandoff {
  readonly handoffId: string;
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly mayaContribution: MayaMarketIntelligenceContribution;
  readonly sourceReferences: readonly MarketingArtifactReference[];
  readonly evidenceQuality: EvidenceQualityAssessment;
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly reviewState: MayaMarketIntelligenceContribution["reviewState"];
  readonly fromPersona: "MAYA";
  readonly toPersona: "ARIA";
  readonly executionAllowed: false;
}

export interface AriaCampaignStrategyInput {
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly assignment: SpecialistAssignment;
  readonly founderObjective: FounderMarketingObjectiveIntake;
  readonly sourceReferences: readonly MarketingArtifactReference[];
  readonly mayaHandoff?: MayaAriaSpecialistHandoff;
  readonly campaignConstraints: readonly string[];
  readonly marketConstraints: readonly string[];
  readonly channelConstraints: readonly string[];
  readonly campaignStrategy: CampaignStrategyPipelineResult;
}

export interface AriaCampaignStrategyContribution {
  readonly contributionId: string;
  readonly persona: "ARIA";
  readonly role: "CAMPAIGN_STRATEGY";
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly sourceReferences: readonly MarketingArtifactReference[];
  readonly mayaEvidenceReferences: readonly MarketingArtifactReference[];
  readonly canonicalCampaignStrategy: CampaignStrategyPipelineResult;
  readonly strategicSummary: string;
  readonly objective: CampaignStrategyPipelineResult["objective"];
  readonly funnelInterpretation: string;
  readonly audienceMarketInterpretation: string;
  readonly channelInterpretation: string;
  readonly allocationInterpretation: string;
  readonly strategicRecommendations: CampaignStrategyPipelineResult["recommendations"];
  readonly risks: CampaignStrategyPipelineResult["strategicRisks"];
  readonly assumptions: readonly string[];
  readonly tradeoffs: readonly string[];
  readonly readiness: CampaignStrategyPipelineResult["readinessStatus"];
  readonly requiresHumanReview: boolean;
  readonly confidence: EvidenceQualityLevel;
  readonly evidenceNotes: readonly string[];
  readonly escalationReasons: readonly string[];
  readonly reviewState: "READY" | "REVIEW_REQUIRED" | "BLOCKED";
  readonly attributionVersion: typeof MAYA_ARIA_VERSION;
  readonly executionAllowed: false;
}

export interface MayaAriaContributionAdapters {
  readonly maya: SpecialistContribution;
  readonly aria: SpecialistContribution;
}

export class MayaAriaSpecialistError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MayaAriaSpecialistError";
  }
}
