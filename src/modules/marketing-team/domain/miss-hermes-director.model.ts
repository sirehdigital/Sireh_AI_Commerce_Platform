import type {
  FounderApprovalPacket,
  MarketingArtifactReference,
  MarketingTeamAgentId,
  MarketingTeamCapability,
  MarketingTeamReviewRequirement,
  MarketingWorkProductAttribution,
} from "./marketing-team.model.js";

export const MISS_HERMES_DIRECTOR_VERSION = "MARKETING-TEAM-01B";

export const MARKETING_OBJECTIVE_OUTPUTS = [
  "MARKET_RESEARCH",
  "CAMPAIGN_PLAN",
  "CONTENT",
  "CREATIVE",
  "PAID_MEDIA_PLAN",
  "PERFORMANCE_REVIEW",
] as const;
export type MarketingObjectiveOutput = (typeof MARKETING_OBJECTIVE_OUTPUTS)[number];

export type MissHermesReadinessState =
  "NEEDS_INFORMATION" | "IN_PROGRESS" | "NEEDS_REVIEW" | "READY_FOR_FOUNDER" | "BLOCKED";

export interface FounderMarketingObjectiveIntake {
  readonly objectiveId: string;
  readonly objective: string;
  readonly sourceReference: MarketingArtifactReference;
  readonly targetMarkets: readonly string[];
  readonly channels: readonly string[];
  readonly budgetConstraints: readonly string[];
  readonly campaignConstraints: readonly string[];
  readonly requestedOutputs: readonly MarketingObjectiveOutput[];
  readonly timingContext: string;
  readonly riskRequirements: readonly string[];
  readonly reviewRequirements: readonly MarketingTeamReviewRequirement[];
  readonly receivedAt: string;
  readonly receivedBy: "MISS_HERMES";
}

export type CreateFounderMarketingObjectiveInput = Omit<
  FounderMarketingObjectiveIntake,
  "receivedBy"
>;

export interface SpecialistAssignment {
  readonly assignmentId: string;
  readonly assignedPersona: MarketingTeamAgentId;
  readonly requestedCapability: MarketingTeamCapability;
  readonly inputReferences: readonly MarketingArtifactReference[];
  readonly expectedOutput: MarketingObjectiveOutput | "FOUNDER_DECISION_BRIEF";
  readonly dependencies: readonly string[];
  readonly reviewRequirement: MarketingTeamReviewRequirement;
  readonly reviewState: "PLANNED";
  readonly decisionRationale: string;
  readonly escalationCondition: string;
  readonly executionAllowed: false;
}

export interface MissHermesDelegationPlan {
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly objective: FounderMarketingObjectiveIntake;
  readonly assignments: readonly SpecialistAssignment[];
  readonly sequencingRule: "DEPENDENCY_ORDER_THEN_PERSONA_ORDER";
  readonly attributedTo: "MISS_HERMES";
  readonly role: "AI_MARKETING_DIRECTOR";
  readonly systemLayer: "CODEX_SACP_SAIE";
  readonly productionExecutionAllowed: false;
}

export interface SpecialistContribution {
  readonly contributionId: string;
  readonly persona: MarketingTeamAgentId;
  readonly summary: string;
  readonly recommendation: string;
  readonly assumptions: readonly string[];
  readonly risks: readonly string[];
  readonly confidence: "LOW" | "MEDIUM" | "HIGH";
  readonly evidence: readonly MarketingArtifactReference[];
  readonly dependencies: readonly MarketingArtifactReference[];
  readonly reviewState: "NOT_REQUIRED" | "PENDING" | "PASSED" | "BLOCKED";
}

export interface RecommendationConflict {
  readonly conflictId: string;
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly attributedTo: "MISS_HERMES";
  readonly positions: readonly {
    readonly persona: MarketingTeamAgentId;
    readonly recommendation: string;
    readonly evidence: readonly MarketingArtifactReference[];
  }[];
  readonly tradeoffs: readonly string[];
  readonly preferredOption?: string;
  readonly rationale: string;
  readonly dependencyReferences: readonly MarketingArtifactReference[];
  readonly reviewState: "FOUNDER_REVIEW_REQUIRED" | "ADVISORY_PREFERENCE_RECORDED";
  readonly founderEscalationRequired: boolean;
}

export interface MissHermesReadinessEvaluation {
  readonly state: MissHermesReadinessState;
  readonly reasons: readonly string[];
  readonly founderEscalationRequired: boolean;
  readonly executed: false;
}

export interface MissHermesFounderDecisionBrief {
  readonly briefId: string;
  readonly teamRunId: string;
  readonly correlationId: string;
  readonly objective: FounderMarketingObjectiveIntake;
  readonly executiveSummary: string;
  readonly specialistContributions: readonly SpecialistContribution[];
  readonly recommendedStrategy: string;
  readonly alternatives: readonly string[];
  readonly conflicts: readonly RecommendationConflict[];
  readonly assumptions: readonly string[];
  readonly risks: readonly string[];
  readonly miraStatus: "NOT_REQUIRED" | "PENDING" | "PASSED" | "BLOCKED";
  readonly approvalRequirements: readonly string[];
  readonly founderDecisionsRequired: readonly string[];
  readonly readiness: MissHermesReadinessEvaluation;
  readonly attribution: MarketingWorkProductAttribution;
  readonly decisionOptions: FounderApprovalPacket["decisionOptions"];
  readonly approvalDecisionRecorded: false;
  readonly approvedByMissHermes: false;
  readonly executionAllowed: false;
}

export class MissHermesDirectorError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MissHermesDirectorError";
  }
}
