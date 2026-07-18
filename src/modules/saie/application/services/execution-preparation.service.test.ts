import { describe, expect, it } from "vitest";

import {
  InMemoryApprovalRepository,
  InMemoryAuditRepository,
  InMemoryExecutionRepository,
  InMemoryWorkflowRepository,
  createDeterministicWorkflowSeedRecords,
} from "../../infrastructure/index.js";
import { DEFAULT_TENANT_CONTEXT } from "../tenant/index.js";
import type { ApprovalRecord } from "../repositories/index.js";
import { AuditRecorderService } from "./audit-recorder.service.js";
import {
  ExecutionPreparationNotAllowedError,
  ExecutionPreparationService,
} from "./execution-preparation.service.js";

const buildApproval = (status: ApprovalRecord["status"]): ApprovalRecord => ({
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: `approval-${status}`,
  proposalId: "proposal-product-context",
  workflowId: "shopify-product-orchestration",
  title: "Product Context",
  status,
  riskLevel: "LOW",
  requestedBy: "Product Agent",
  createdAt: "Preview approval 01",
  requestedAt: "Preview approval 01",
  requiresHumanApproval: true,
  executionEnabled: false,
  source: status === "pending" ? "deterministic-preview" : "human-decision",
  version: status === "pending" ? 1 : 2,
  ...(status === "pending"
    ? {}
    : {
        decidedAt: "2026-07-16T00:00:00.000Z",
        decidedBy: "human-reviewer",
      }),
});

const createService = (approvals: readonly ApprovalRecord[]) => {
  const auditRepository = new InMemoryAuditRepository();
  const executionRepository = new InMemoryExecutionRepository();
  const approvalRepository = new InMemoryApprovalRepository(approvals);
  const workflowRepository = new InMemoryWorkflowRepository(createDeterministicWorkflowSeedRecords());
  const service = new ExecutionPreparationService(
    approvalRepository,
    executionRepository,
    workflowRepository,
    new AuditRecorderService(
      auditRepository,
      () => `audit-${auditRepository.list(DEFAULT_TENANT_CONTEXT).length + 1}`,
      () => "2026-07-16T00:00:00.000Z",
    ),
    () => "execution-live-1",
    () => "2026-07-16T00:00:00.000Z",
  );

  return { approvalRepository, auditRepository, executionRepository, workflowRepository, service };
};

describe("ExecutionPreparationService", () => {
  it("prepares one preview-only execution record for an approved approval", () => {
    const { approvalRepository, auditRepository, executionRepository, workflowRepository, service } =
      createService([buildApproval("approved")]);

    const execution = service.prepareExecution({
      tenant: DEFAULT_TENANT_CONTEXT,
      approvalId: "approval-approved",
      preparedBy: "human-reviewer",
    });

    expect(execution).toMatchObject({
      id: "execution-live-1",
      approvalId: "approval-approved",
      proposalId: "proposal-product-context",
      workflowId: "shopify-product-orchestration",
      status: "prepared",
      mode: "preview",
      executionEnabled: false,
      approvalRequired: true,
      executableActions: [],
      source: "in-memory-prepared",
      approvalVersion: 2,
      riskLevel: "LOW",
    });
    expect(approvalRepository.findById(DEFAULT_TENANT_CONTEXT, "approval-approved")?.status).toBe("approved");
    expect(workflowRepository.findById(DEFAULT_TENANT_CONTEXT, "shopify-product-orchestration")?.status).toBe("draft");
    expect(executionRepository.findByApprovalId(DEFAULT_TENANT_CONTEXT, "approval-approved")?.id).toBe("execution-live-1");
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)[0]).toMatchObject({
      eventType: "execution.prepared",
      entityId: "execution-live-1",
    });
  });

  it("rejects pending, rejected, unknown, missing actor, and duplicate preparation", () => {
    const pending = createService([buildApproval("pending")]);
    expect(() =>
      pending.service.prepareExecution({ tenant: DEFAULT_TENANT_CONTEXT, approvalId: "approval-pending", preparedBy: "human-reviewer" }),
    ).toThrow(ExecutionPreparationNotAllowedError);
    expect(pending.executionRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(0);
    expect(pending.auditRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(0);

    const rejected = createService([buildApproval("rejected")]);
    expect(() =>
      rejected.service.prepareExecution({ tenant: DEFAULT_TENANT_CONTEXT, approvalId: "approval-rejected", preparedBy: "human-reviewer" }),
    ).toThrow(ExecutionPreparationNotAllowedError);
    expect(rejected.auditRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(0);

    const unknown = createService([]);
    expect(() =>
      unknown.service.prepareExecution({ tenant: DEFAULT_TENANT_CONTEXT, approvalId: "missing-approval", preparedBy: "human-reviewer" }),
    ).toThrow("Approval was not found.");

    const missingActor = createService([buildApproval("approved")]);
    expect(() =>
      missingActor.service.prepareExecution({ tenant: DEFAULT_TENANT_CONTEXT, approvalId: "approval-approved", preparedBy: " " }),
    ).toThrow(ExecutionPreparationNotAllowedError);

    const duplicate = createService([buildApproval("approved")]);
    duplicate.service.prepareExecution({ tenant: DEFAULT_TENANT_CONTEXT, approvalId: "approval-approved", preparedBy: "human-reviewer" });
    expect(() =>
      duplicate.service.prepareExecution({ tenant: DEFAULT_TENANT_CONTEXT, approvalId: "approval-approved", preparedBy: "human-reviewer" }),
    ).toThrow(ExecutionPreparationNotAllowedError);
    expect(duplicate.auditRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(1);
  });
});
