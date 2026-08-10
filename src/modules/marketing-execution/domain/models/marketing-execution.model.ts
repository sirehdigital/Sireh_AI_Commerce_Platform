import type { MarketingChannelType } from "../../../marketing/domain/index.js";

export const MARKETING_EXECUTION_VERSION = "SACP-04.05A";

export const MARKETING_EXECUTION_SOURCE_TYPES = ["CONTENT", "CREATIVE", "CAMPAIGN_STRATEGY", "MANUAL"] as const;
export type MarketingExecutionSourceType = (typeof MARKETING_EXECUTION_SOURCE_TYPES)[number];

export const MARKETING_EXECUTION_ACTION_TYPES = [
  "PUBLISH_CONTENT",
  "SCHEDULE_CONTENT",
  "UPDATE_CONTENT",
  "PAUSE_CONTENT",
  "RESUME_CONTENT",
  "REMOVE_CONTENT",
] as const;
export type MarketingExecutionActionType = (typeof MARKETING_EXECUTION_ACTION_TYPES)[number];

export type MarketingExecutionTarget = MarketingChannelType | "OTHER";

export const MARKETING_EXECUTION_APPROVAL_STATES = ["NOT_REQUIRED", "REQUIRED", "APPROVED", "REJECTED"] as const;
export type MarketingExecutionApprovalState = (typeof MARKETING_EXECUTION_APPROVAL_STATES)[number];

export const MARKETING_EXECUTION_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "READY", "BLOCKED", "CANCELLED"] as const;
export type MarketingExecutionStatus = (typeof MARKETING_EXECUTION_STATUSES)[number];

export const MARKETING_EXECUTION_READINESS_STATES = ["READY", "WAITING_FOR_APPROVAL", "BLOCKED", "INVALID"] as const;
export type MarketingExecutionReadinessState = (typeof MARKETING_EXECUTION_READINESS_STATES)[number];

export interface MarketingExecutionSourceReference {
  readonly sourceType: MarketingExecutionSourceType;
  readonly sourceId: string;
}

export interface MarketingExecutionPayloadReference {
  readonly payloadId: string;
  readonly summary: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface MarketingExecutionActorContext {
  readonly requestedBy: string;
}

export interface MarketingExecutionValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export interface MarketingExecutionReadiness {
  readonly state: MarketingExecutionReadinessState;
  readonly executable: false;
  readonly reason: string;
  readonly issues: readonly MarketingExecutionValidationIssue[];
}

export interface MarketingExecutionRequest {
  readonly executionRequestId: string;
  readonly sourceReference: MarketingExecutionSourceReference;
  readonly sourceType: MarketingExecutionSourceType;
  readonly actionType: MarketingExecutionActionType;
  readonly targetPlatform: MarketingExecutionTarget;
  readonly targetChannel: MarketingExecutionTarget;
  readonly payloadReference: MarketingExecutionPayloadReference;
  readonly requestedBy: string;
  readonly actor: MarketingExecutionActorContext;
  readonly approvalRequirement: MarketingExecutionApprovalState;
  readonly approvalId?: string;
  readonly executionStatus: MarketingExecutionStatus;
  readonly readiness: MarketingExecutionReadiness;
  readonly advisoryOnly: true;
  readonly executionEnabled: false;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata: {
    readonly version: typeof MARKETING_EXECUTION_VERSION;
    readonly identityRule: "marketing-execution:<source-type>:<source-id>:<action>:<platform>:<channel>";
    readonly externalExecutionBoundary: "CONTRACT_ONLY_NO_PLATFORM_ADAPTER";
  };
}
