import { performance } from "node:perf_hooks";

import { AuditRecordingError, type AuditRecorderService } from "../services/audit-recorder.service.js";
import type { ApprovalRecord } from "../repositories/index.js";
import {
  NoopSaieLogger,
  ProcessLocalMetricsRegistry,
  type SaieLogger,
} from "../observability/index.js";
import type {
  ApprovalService,
  ApproveApprovalInput,
  RejectApprovalInput,
} from "../services/approval.service.js";

export interface ApproveApprovalCommand {
  readonly execute: (input: ApproveApprovalInput) => ApprovalRecord;
}

export class ApproveApprovalApplicationCommand implements ApproveApprovalCommand {
  public constructor(
    private readonly approvalService: ApprovalService,
    private readonly auditRecorder?: AuditRecorderService,
    private readonly observability: {
      readonly logger?: SaieLogger;
      readonly metrics?: ProcessLocalMetricsRegistry;
      readonly now?: () => number;
    } = {},
  ) {}

  public execute(input: ApproveApprovalInput): ApprovalRecord {
    const logger = this.observability.logger ?? new NoopSaieLogger();
    const metrics = this.observability.metrics;
    const now = this.observability.now ?? (() => performance.now());
    const startedAt = now();

    logger.info({
      eventName: "saie.approval.decision.attempted",
      message: "Approval decision attempted.",
      correlationId: input.correlationId,
      operation: "approval.approve",
      entityType: "approval",
      entityId: input.approvalId,
      metadata: { decision: "approved", tenantId: input.tenant.tenantId, storeId: input.tenant.storeId },
    });

    try {
      const approval = this.approvalService.approve(input);
      this.recordDecision(approval, "approved", input);
      metrics?.incrementCounter("saie_approval_decisions_total", { decision: "approved", outcome: "success" });
      logger.info({
        eventName: "saie.approval.decision.completed",
        message: "Approval decision completed.",
        correlationId: input.correlationId,
        operation: "approval.approve",
        entityType: "approval",
        entityId: approval.id,
        durationMs: now() - startedAt,
        outcome: "success",
        metadata: { decision: "approved", tenantId: input.tenant.tenantId, storeId: input.tenant.storeId },
      });

      return approval;
    } catch (error) {
      metrics?.incrementCounter("saie_approval_conflicts_total", {
        decision: "approved",
        outcome: "conflict",
      });
      logger.warn({
        eventName: "saie.approval.decision.failed",
        message: "Approval decision failed.",
        correlationId: input.correlationId,
        operation: "approval.approve",
        entityType: "approval",
        entityId: input.approvalId,
        durationMs: now() - startedAt,
        outcome: "conflict",
        metadata: {
          decision: "approved",
          tenantId: input.tenant.tenantId,
          storeId: input.tenant.storeId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
      });
      throw error;
    }
  }

  private recordDecision(approval: ApprovalRecord, decision: "approved", input: ApproveApprovalInput): void {
    try {
      this.auditRecorder?.recordApprovalDecision({
        tenant: input.tenant,
        approvalId: approval.id,
        proposalId: approval.proposalId,
        decision,
        actor: approval.decidedBy ?? "unknown-human-reviewer",
        approvalVersion: approval.version,
        ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
        ...(approval.workflowId === undefined ? {} : { workflowId: approval.workflowId }),
        ...(approval.decisionReason === undefined ? {} : { reason: approval.decisionReason }),
      });
    } catch (error) {
      throw new AuditRecordingError(
        error instanceof Error ? error.message : "Approval audit event could not be recorded.",
      );
    }
  }
}

export interface RejectApprovalCommand {
  readonly execute: (input: RejectApprovalInput) => ApprovalRecord;
}

export class RejectApprovalApplicationCommand implements RejectApprovalCommand {
  public constructor(
    private readonly approvalService: ApprovalService,
    private readonly auditRecorder?: AuditRecorderService,
    private readonly observability: {
      readonly logger?: SaieLogger;
      readonly metrics?: ProcessLocalMetricsRegistry;
      readonly now?: () => number;
    } = {},
  ) {}

  public execute(input: RejectApprovalInput): ApprovalRecord {
    const logger = this.observability.logger ?? new NoopSaieLogger();
    const metrics = this.observability.metrics;
    const now = this.observability.now ?? (() => performance.now());
    const startedAt = now();

    logger.info({
      eventName: "saie.approval.decision.attempted",
      message: "Approval decision attempted.",
      correlationId: input.correlationId,
      operation: "approval.reject",
      entityType: "approval",
      entityId: input.approvalId,
      metadata: { decision: "rejected", tenantId: input.tenant.tenantId, storeId: input.tenant.storeId },
    });

    try {
      const approval = this.approvalService.reject(input);
      this.recordDecision(approval, "rejected", input);
      metrics?.incrementCounter("saie_approval_decisions_total", { decision: "rejected", outcome: "success" });
      logger.info({
        eventName: "saie.approval.decision.completed",
        message: "Approval decision completed.",
        correlationId: input.correlationId,
        operation: "approval.reject",
        entityType: "approval",
        entityId: approval.id,
        durationMs: now() - startedAt,
        outcome: "success",
        metadata: { decision: "rejected", tenantId: input.tenant.tenantId, storeId: input.tenant.storeId },
      });

      return approval;
    } catch (error) {
      metrics?.incrementCounter("saie_approval_conflicts_total", {
        decision: "rejected",
        outcome: "conflict",
      });
      logger.warn({
        eventName: "saie.approval.decision.failed",
        message: "Approval decision failed.",
        correlationId: input.correlationId,
        operation: "approval.reject",
        entityType: "approval",
        entityId: input.approvalId,
        durationMs: now() - startedAt,
        outcome: "conflict",
        metadata: {
          decision: "rejected",
          tenantId: input.tenant.tenantId,
          storeId: input.tenant.storeId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
      });
      throw error;
    }
  }

  private recordDecision(approval: ApprovalRecord, decision: "rejected", input: RejectApprovalInput): void {
    try {
      this.auditRecorder?.recordApprovalDecision({
        tenant: input.tenant,
        approvalId: approval.id,
        proposalId: approval.proposalId,
        decision,
        actor: approval.decidedBy ?? "unknown-human-reviewer",
        approvalVersion: approval.version,
        ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
        ...(approval.workflowId === undefined ? {} : { workflowId: approval.workflowId }),
        ...(approval.decisionReason === undefined ? {} : { reason: approval.decisionReason }),
      });
    } catch (error) {
      throw new AuditRecordingError(
        error instanceof Error ? error.message : "Approval audit event could not be recorded.",
      );
    }
  }
}
