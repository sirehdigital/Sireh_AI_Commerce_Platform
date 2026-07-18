import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { ApplicationNotFoundError } from "../errors/index.js";
import {
  NoopSaieLogger,
  ProcessLocalMetricsRegistry,
  type SaieLogger,
} from "../observability/index.js";
import type {
  ApprovalRepository,
  ExecutionRecord,
  ExecutionRepository,
  WorkflowRepository,
} from "../repositories/index.js";
import type { TenantContext } from "../tenant/index.js";
import type { AuditRecorderService } from "./audit-recorder.service.js";

export type ExecutionIdGenerator = () => string;
export type ExecutionClock = () => string;

export interface PrepareExecutionInput {
  readonly tenant: TenantContext;
  readonly approvalId: string;
  readonly preparedBy: string;
  readonly correlationId?: string;
}

export class ExecutionPreparationNotAllowedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ExecutionPreparationNotAllowedError";
  }
}

export class ExecutionRecordingError extends Error {
  public constructor(message = "Execution preparation could not be recorded.") {
    super(message);
    this.name = "ExecutionRecordingError";
  }
}

export class ExecutionPreparationService {
  public constructor(
    private readonly approvalRepository: ApprovalRepository,
    private readonly executionRepository: ExecutionRepository,
    private readonly workflowRepository: WorkflowRepository,
    private readonly auditRecorder: AuditRecorderService,
    private readonly createExecutionId: ExecutionIdGenerator = randomUUID,
    private readonly now: ExecutionClock = () => new Date().toISOString(),
    private readonly observability: {
      readonly logger?: SaieLogger;
      readonly metrics?: ProcessLocalMetricsRegistry;
      readonly durationNow?: () => number;
    } = {},
  ) {}

  public prepareExecution(input: PrepareExecutionInput): ExecutionRecord {
    const logger = this.observability.logger ?? new NoopSaieLogger();
    const metrics = this.observability.metrics;
    const durationNow = this.observability.durationNow ?? (() => performance.now());
    const startedAt = durationNow();
    const preparedBy = input.preparedBy.trim();

    logger.info({
      eventName: "saie.execution.preparation.attempted",
      message: "Execution preparation attempted.",
      correlationId: input.correlationId,
      operation: "execution.prepare",
      entityType: "approval",
      entityId: input.approvalId,
    });

    try {
      if (preparedBy.length === 0) {
        throw new ExecutionPreparationNotAllowedError("Execution preparation requires an actor.");
      }

      const approval = this.approvalRepository.findById(input.tenant, input.approvalId);

      if (approval === undefined) {
        throw new ApplicationNotFoundError("Approval", input.approvalId);
      }

      if (approval.status !== "approved") {
        throw new ExecutionPreparationNotAllowedError(
          `Execution preparation requires approved approval status; current status is ${approval.status}.`,
        );
      }

      if (approval.requiresHumanApproval !== true || approval.executionEnabled !== false) {
        throw new ExecutionPreparationNotAllowedError(
          "Execution preparation requires human approval and disabled execution.",
        );
      }

      if (this.executionRepository.findByApprovalId(input.tenant, approval.id) !== undefined) {
        throw new ExecutionPreparationNotAllowedError(
          `Execution record for approval ${approval.id} already exists.`,
        );
      }

      if (
        approval.workflowId !== undefined &&
        this.workflowRepository.findById(input.tenant, approval.workflowId) === undefined
      ) {
        throw new ApplicationNotFoundError("Workflow", approval.workflowId);
      }

    const sequence = this.executionRepository.list(input.tenant).length + 1;
    const execution = this.executionRepository.append(input.tenant, {
      tenantId: input.tenant.tenantId,
      storeId: input.tenant.storeId,
      ...(input.tenant.shopDomain === undefined ? {} : { shopDomain: input.tenant.shopDomain }),
      id: this.createExecutionId(),
      workflowId: approval.workflowId ?? "workflow-unassigned",
      approvalId: approval.id,
      proposalId: approval.proposalId,
      title: `${approval.title} execution preparation`,
      status: "prepared",
      mode: "preview",
      source: "in-memory-prepared",
      createdAt: this.now(),
      preparedBy,
      executionEnabled: false,
      approvalRequired: true,
      executableActions: [],
      approvalVersion: approval.version,
      riskLevel: approval.riskLevel,
      correlationId: input.correlationId ?? approval.id,
      sequence,
    });

      this.auditRecorder.recordExecutionPrepared({
        tenant: input.tenant,
        executionId: execution.id,
        approvalId: approval.id,
        proposalId: approval.proposalId,
        preparedBy,
        approvalVersion: approval.version,
        mode: execution.mode,
        executionEnabled: execution.executionEnabled,
        ...(approval.workflowId === undefined ? {} : { workflowId: approval.workflowId }),
        ...(execution.correlationId === undefined ? {} : { correlationId: execution.correlationId }),
      });
      metrics?.incrementCounter("saie_execution_preparations_total", {
        outcome: "success",
        reasonCategory: "none",
      });
      logger.info({
        eventName: "saie.execution.preparation.completed",
        message: "Execution preparation completed.",
        correlationId: input.correlationId,
        operation: "execution.prepare",
        entityType: "execution",
        entityId: execution.id,
        durationMs: durationNow() - startedAt,
        outcome: "success",
        metadata: { executionEnabled: false },
      });

      return execution;
    } catch (error) {
      const reasonCategory = this.executionFailureCategory(error);
      metrics?.incrementCounter("saie_execution_preparation_failures_total", {
        outcome: reasonCategory === "blocked" ? "blocked" : "failure",
        reasonCategory,
      });
      logger.warn({
        eventName: "saie.execution.preparation.failed",
        message: "Execution preparation failed.",
        correlationId: input.correlationId,
        operation: "execution.prepare",
        entityType: "approval",
        entityId: input.approvalId,
        durationMs: durationNow() - startedAt,
        outcome: reasonCategory === "blocked" ? "blocked" : "failure",
        metadata: { reasonCategory, errorName: error instanceof Error ? error.name : "UnknownError" },
      });
      if (error instanceof ExecutionRecordingError) {
        throw error;
      }
      if (error instanceof Error && error.message === "Audit append failed.") {
        throw new ExecutionRecordingError(error.message);
      }
      throw error;
    }
  }

  private executionFailureCategory(error: unknown): string {
    if (error instanceof ExecutionPreparationNotAllowedError) {
      return "blocked";
    }

    if (error instanceof ApplicationNotFoundError) {
      return "not-found";
    }

    if (error instanceof ExecutionRecordingError) {
      return "audit";
    }

    return "internal";
  }
}
