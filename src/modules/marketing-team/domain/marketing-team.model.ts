import type { CampaignStrategyPipelineResult } from "../../ai-campaign-strategy/index.js";
import type { MarketingExecutionRequest } from "../../marketing-execution/index.js";

export const MARKETING_TEAM_VERSION = "MARKETING-TEAM-01A";

export const MARKETING_TEAM_AGENT_IDS = [
  "MISS_HERMES",
  "MAYA",
  "ARIA",
  "LUNA",
  "LYLA",
  "DIANA",
  "SUZI",
  "MIRA",
] as const;
export type MarketingTeamAgentId = (typeof MARKETING_TEAM_AGENT_IDS)[number];

export const MARKETING_TEAM_ROLES = [
  "AI_MARKETING_DIRECTOR",
  "MARKET_INTELLIGENCE",
  "CAMPAIGN_STRATEGY",
  "CONTENT_COPY",
  "CREATIVE_STRATEGY",
  "PAID_MEDIA",
  "MARKETING_PERFORMANCE_ANALYST",
  "BRAND_QUALITY_COMPLIANCE",
] as const;
export type MarketingTeamRole = (typeof MARKETING_TEAM_ROLES)[number];
export type MarketingTeamSystemLayer = "CODEX_SACP_SAIE";

export const MARKETING_TEAM_CAPABILITIES = [
  "ANALYSE",
  "RECOMMEND",
  "PREPARE",
  "REVIEW",
  "ESCALATE",
] as const;
export type MarketingTeamCapability = (typeof MARKETING_TEAM_CAPABILITIES)[number];

export type MarketingTeamRunStatus =
  "PLANNED" | "IN_PROGRESS" | "REVIEW_REQUIRED" | "READY_FOR_FOUNDER" | "BLOCKED" | "CANCELLED";
export type MarketingTeamReviewRequirement = "NONE" | "PEER" | "MIRA" | "MISS_HERMES" | "FOUNDER";

export interface MarketingTeamAgentDefinition {
  readonly id: MarketingTeamAgentId;
  readonly personaName: MarketingTeamAgentId;
  readonly role: MarketingTeamRole;
  readonly systemLayer: MarketingTeamSystemLayer;
  readonly mission: string;
  readonly allowedInputs: readonly string[];
  readonly allowedOutputs: readonly string[];
  readonly responsibilities: readonly string[];
  readonly prohibitedActions: readonly string[];
  readonly escalationConditions: readonly string[];
  readonly reviewRequirements: readonly MarketingTeamReviewRequirement[];
  readonly capabilities: readonly MarketingTeamCapability[];
  readonly productionExecutionAllowed: false;
}

export interface MarketingArtifactReference {
  readonly artifactId: string;
  readonly artifactType: string;
  readonly version: string;
}

export interface MarketingWorkProductAttribution {
  readonly agent: MarketingTeamAgentId;
  readonly source: MarketingArtifactReference;
  readonly version: string;
  readonly teamRunId: string;
  readonly evidence: readonly MarketingArtifactReference[];
  readonly dependencies: readonly MarketingArtifactReference[];
}

export interface MarketingTeamRun {
  readonly teamRunId: string;
  readonly sourceReference: MarketingArtifactReference;
  readonly campaignStrategy: CampaignStrategyPipelineResult;
  readonly assignedAgent: MarketingTeamAgentId;
  readonly requestedCapability: MarketingTeamCapability;
  readonly inputArtifacts: readonly MarketingArtifactReference[];
  readonly outputArtifacts: readonly MarketingArtifactReference[];
  readonly dependencies: readonly string[];
  readonly status: MarketingTeamRunStatus;
  readonly reviewRequirement: MarketingTeamReviewRequirement;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly attribution: MarketingWorkProductAttribution;
  readonly proposalOnly: true;
  readonly executionAllowed: false;
}

export interface FounderApprovalPacket {
  readonly packetId: string;
  readonly teamRunId: string;
  readonly campaignStrategy: CampaignStrategyPipelineResult;
  readonly proposedExecutionRequest?: MarketingExecutionRequest;
  readonly summary: string;
  readonly recommendations: CampaignStrategyPipelineResult["recommendations"];
  readonly risks: CampaignStrategyPipelineResult["strategicRisks"];
  readonly reviewRequirement: "FOUNDER";
  readonly preparedBy: MarketingTeamAgentId;
  readonly attribution: MarketingWorkProductAttribution;
  readonly decisionOptions: readonly ["APPROVE", "REJECT", "REQUEST_CHANGES"];
  readonly approvalDecisionRecorded: false;
  readonly executionAllowed: false;
}

export interface HermesHandoffEnvelope {
  readonly handoffId: string;
  readonly teamRunId: string;
  readonly founderApprovalPacketId: string;
  readonly executionRequest: MarketingExecutionRequest;
  readonly preparedBy: MarketingTeamAgentId;
  readonly contractVersion: typeof MARKETING_TEAM_VERSION;
  readonly externalExecutionAllowed: false;
}

export interface HermesHandoffAcknowledgement {
  readonly handoffId: string;
  readonly acknowledged: boolean;
  readonly acknowledgedAt: string;
  readonly acknowledgedBy: "HERMES" | "MISS_HERMES";
  readonly executionStarted: false;
}

export interface HermesExecutionReceiptExpectation {
  readonly handoffId: string;
  readonly requiredFields: readonly [
    "externalExecutionId",
    "status",
    "startedAt",
    "completedAt",
    "auditReference",
  ];
  readonly producedByMarketingTeam: false;
}

export interface MarketingTeamAuditEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly teamRunId: string;
  readonly eventType:
    "RUN_CREATED" | "STATUS_CHANGED" | "FOUNDER_PACKET_PREPARED" | "HERMES_HANDOFF_PREPARED";
  readonly actor: MarketingTeamAgentId;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly details: Readonly<Record<string, string | number | boolean>>;
}

export interface CreateMarketingTeamRunInput {
  readonly teamRunId: string;
  readonly sourceReference: MarketingArtifactReference;
  readonly campaignStrategy: CampaignStrategyPipelineResult;
  readonly assignedAgent: MarketingTeamAgentId;
  readonly requestedCapability: MarketingTeamCapability;
  readonly inputArtifacts: readonly MarketingArtifactReference[];
  readonly dependencies?: readonly string[];
  readonly reviewRequirement: MarketingTeamReviewRequirement;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly evidence: readonly MarketingArtifactReference[];
  readonly createdAt: string;
}

export class MarketingTeamGovernanceError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MarketingTeamGovernanceError";
  }
}
