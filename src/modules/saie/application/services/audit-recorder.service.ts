import { randomUUID } from "node:crypto";

import {
  NoopSaieLogger,
  ProcessLocalMetricsRegistry,
  type SaieLogger,
} from "../observability/index.js";
import type { AuditRecord, AuditRepository } from "../repositories/index.js";
import type { TenantContext } from "../tenant/index.js";

export type AuditIdGenerator = () => string;
export type AuditClock = () => string;

export interface RecordApprovalDecisionInput {
  readonly tenant: TenantContext;
  readonly approvalId: string;
  readonly proposalId?: string;
  readonly workflowId?: string;
  readonly decision: "approved" | "rejected";
  readonly actor: string;
  readonly reason?: string;
  readonly approvalVersion: number;
  readonly correlationId?: string;
}

export interface RecordExecutionPreparedInput {
  readonly tenant: TenantContext;
  readonly executionId: string;
  readonly approvalId: string;
  readonly proposalId?: string;
  readonly workflowId?: string;
  readonly preparedBy: string;
  readonly approvalVersion: number;
  readonly mode: "preview";
  readonly executionEnabled: false;
  readonly correlationId?: string;
}

export class UnsupportedAuditEventError extends Error {
  public constructor(decision: string) {
    super(`Unsupported audit decision: ${decision}.`);
    this.name = "UnsupportedAuditEventError";
  }
}

export class AuditRecorderService {
  public constructor(
    private readonly auditRepository: AuditRepository,
    private readonly createAuditId: AuditIdGenerator = randomUUID,
    private readonly now: AuditClock = () => new Date().toISOString(),
    private readonly observability: {
      readonly logger?: SaieLogger;
      readonly metrics?: ProcessLocalMetricsRegistry;
    } = {},
  ) {}

  public recordApprovalDecision(input: RecordApprovalDecisionInput): AuditRecord {
    if (input.decision !== "approved" && input.decision !== "rejected") {
      throw new UnsupportedAuditEventError(input.decision);
    }

    const eventType = input.decision === "approved" ? "approval.approved" : "approval.rejected";
    const summary =
      input.decision === "approved"
        ? `Approval ${input.approvalId} was approved.`
        : `Approval ${input.approvalId} was rejected.`;

    return this.appendAuditRecord({
      id: this.createAuditId(),
      tenantId: input.tenant.tenantId,
      storeId: input.tenant.storeId,
      ...(input.tenant.shopDomain === undefined ? {} : { shopDomain: input.tenant.shopDomain }),
      eventType,
      entityType: "approval",
      entityId: input.approvalId,
      actor: input.actor,
      occurredAt: this.now(),
      summary,
      details: {
        approvalId: input.approvalId,
        proposalId: input.proposalId ?? null,
        workflowId: input.workflowId ?? null,
        decision: input.decision,
        reason: input.reason ?? null,
        approvalVersion: input.approvalVersion,
        executionEnabled: false,
      },
      source: "in-memory-live",
      correlationId: input.correlationId ?? input.approvalId,
      sequence: this.auditRepository.list(input.tenant).length + 1,
    });
  }

  public recordExecutionPrepared(input: RecordExecutionPreparedInput): AuditRecord {
    return this.appendAuditRecord({
      id: this.createAuditId(),
      tenantId: input.tenant.tenantId,
      storeId: input.tenant.storeId,
      ...(input.tenant.shopDomain === undefined ? {} : { shopDomain: input.tenant.shopDomain }),
      eventType: "execution.prepared",
      entityType: "execution",
      entityId: input.executionId,
      actor: input.preparedBy,
      occurredAt: this.now(),
      summary: `Execution ${input.executionId} was prepared for review.`,
      details: {
        executionId: input.executionId,
        approvalId: input.approvalId,
        proposalId: input.proposalId ?? null,
        workflowId: input.workflowId ?? null,
        preparedBy: input.preparedBy,
        approvalVersion: input.approvalVersion,
        mode: input.mode,
        executionEnabled: input.executionEnabled,
      },
      source: "in-memory-live",
      correlationId: input.correlationId ?? input.executionId,
      sequence: this.auditRepository.list(input.tenant).length + 1,
    });
  }

  private appendAuditRecord(record: AuditRecord): AuditRecord {
    const logger = this.observability.logger ?? new NoopSaieLogger();
    const metrics = this.observability.metrics;

    try {
      const appended = this.auditRepository.append(record, record);
      metrics?.incrementCounter("saie_audit_events_appended_total", {
        eventType: record.eventType,
        outcome: "success",
      });
      logger.info({
        eventName: "saie.audit.append.completed",
        message: "Audit event appended.",
        correlationId: record.correlationId,
        operation: "audit.append",
        entityType: record.entityType,
        entityId: record.entityId,
        outcome: "success",
        metadata: { eventType: record.eventType },
      });

      return appended;
    } catch (error) {
      metrics?.incrementCounter("saie_audit_append_failures_total", {
        eventType: record.eventType,
        outcome: "failure",
      });
      logger.error({
        eventName: "saie.audit.append.failed",
        message: "Audit event append failed.",
        correlationId: record.correlationId,
        operation: "audit.append",
        entityType: record.entityType,
        entityId: record.entityId,
        outcome: "failure",
        metadata: {
          eventType: record.eventType,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
      });
      throw error;
    }
  }
}

export class AuditRecordingError extends Error {
  public constructor(message = "Audit event could not be recorded.") {
    super(message);
    this.name = "AuditRecordingError";
  }
}
