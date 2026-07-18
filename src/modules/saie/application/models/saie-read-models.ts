import type { DashboardViewModel } from "../../presentation/index.js";
import type { SAIEAgentType, SAIEWorkflowStatus } from "../../types/index.js";

export type DashboardReadModel = DashboardViewModel;

export type SaieHealthStatus = "healthy" | "degraded";
export type SaieOrchestratorStatus = "available" | "not_checked";

export interface HealthReadModel {
  readonly status: SaieHealthStatus;
  readonly version: "0.2.0-beta";
  readonly environment: "development" | "production" | "test";
  readonly orchestrator: SaieOrchestratorStatus;
  readonly executionEnabled: false;
  readonly approvalRequired: true;
  readonly timestamp: string;
  readonly observability?: {
    readonly logging: "process-local";
    readonly metrics: "process-local";
    readonly correlationIds: true;
    readonly persistentTelemetry: false;
  };
  readonly tenancy?: {
    readonly tenantContextSupported: true;
    readonly tenantIsolationMode: "process-local";
    readonly authenticatedTenantResolution: false;
    readonly defaultContextEnabled: true;
  };
}

export interface WorkflowStepReadModel {
  readonly id: string;
  readonly name: string;
  readonly agentType: SAIEAgentType;
  readonly dependsOn: readonly string[];
}

export interface WorkflowReadModel {
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: SAIEWorkflowStatus;
  readonly steps: readonly WorkflowStepReadModel[];
  readonly source: "deterministic-preview";
  readonly approvalRequired: true;
  readonly executionEnabled: false;
}

export type ApprovalPreviewStatus = "pending" | "approved" | "rejected";
export type ApprovalRiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ApprovalRecordSource = "deterministic-preview" | "human-decision";

export interface ApprovalReadModel {
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly id: string;
  readonly proposalId: string;
  readonly workflowId?: string;
  readonly title: string;
  readonly status: ApprovalPreviewStatus;
  readonly riskLevel: ApprovalRiskLevel;
  readonly requestedBy: string;
  readonly createdAt: string;
  readonly requestedAt: string;
  readonly decidedAt?: string;
  readonly decidedBy?: string;
  readonly decisionReason?: string;
  readonly requiresHumanApproval: true;
  readonly executionEnabled: false;
  readonly source: ApprovalRecordSource;
  readonly version: number;
}

export type AuditRecordSource = "deterministic-preview" | "in-memory-live";
export type AuditEventType =
  | "approval.approved"
  | "approval.rejected"
  | "execution.prepared"
  | "preview.agent-activity";
export type AuditEntityType = "approval" | "execution" | "agent-activity";
export type AuditDetails = Readonly<Record<string, string | number | boolean | null>>;

export interface AuditReadModel {
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly id: string;
  readonly eventType: AuditEventType;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly summary: string;
  readonly details: AuditDetails;
  readonly source: AuditRecordSource;
  readonly sequence: number;
  readonly correlationId?: string;
  readonly activityType?: string;
  readonly status?: "READY_FOR_REVIEW" | "NEEDS_INPUT" | "BLOCKED";
  readonly recordedAt?: string;
  readonly evidence?: string;
}

export type ExecutionStatus = "DISABLED" | "prepared" | "blocked";
export type ExecutionRecordSource = "deterministic-preview" | "in-memory-prepared";

export interface ExecutionReadModel {
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly id: string;
  readonly workflowId: string;
  readonly approvalId?: string;
  readonly proposalId?: string;
  readonly title: string;
  readonly status: ExecutionStatus;
  readonly mode: "preview";
  readonly executionEnabled: false;
  readonly approvalRequired: true;
  readonly executableActions: readonly [];
  readonly source: ExecutionRecordSource;
  readonly createdAt?: string;
  readonly preparedBy?: string;
  readonly approvalVersion?: number;
  readonly riskLevel?: ApprovalRiskLevel;
  readonly blockReason?: string;
  readonly correlationId?: string;
  readonly sequence?: number;
}
