import { describe, expect, it } from "vitest";

import {
  InMemoryApprovalRepository,
  InMemoryAuditRepository,
  InMemoryExecutionRepository,
  InMemoryWorkflowRepository,
  createDeterministicWorkflowSeedRecords,
} from "../../infrastructure/index.js";
import { DEFAULT_TENANT_CONTEXT } from "../tenant/index.js";
import type { ApprovalRecord, AuditRepository } from "../repositories/index.js";
import { AuditRecorderService } from "../services/audit-recorder.service.js";
import {
  ExecutionPreparationService,
  ExecutionRecordingError,
} from "../services/execution-preparation.service.js";
import { PrepareExecutionApplicationCommand } from "./execution.commands.js";

const approvedApproval: ApprovalRecord = {
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: "approval-product-context",
  proposalId: "proposal-product-context",
  workflowId: "shopify-product-orchestration",
  title: "Product Context",
  status: "approved",
  riskLevel: "LOW",
  requestedBy: "Product Agent",
  createdAt: "Preview approval 01",
  requestedAt: "Preview approval 01",
  decidedAt: "2026-07-16T00:00:00.000Z",
  decidedBy: "human-reviewer",
  requiresHumanApproval: true,
  executionEnabled: false,
  source: "human-decision",
  version: 2,
};

describe("PrepareExecutionApplicationCommand audit integration", () => {
  it("successful preparation creates one execution.prepared audit event", () => {
    const auditRepository = new InMemoryAuditRepository();
    const executionRepository = new InMemoryExecutionRepository();
    const command = new PrepareExecutionApplicationCommand(
      new ExecutionPreparationService(
        new InMemoryApprovalRepository([approvedApproval]),
        executionRepository,
        new InMemoryWorkflowRepository(createDeterministicWorkflowSeedRecords()),
        new AuditRecorderService(
          auditRepository,
          () => "audit-execution-prepared",
          () => "2026-07-16T00:00:00.000Z",
        ),
        () => "execution-live-1",
        () => "2026-07-16T00:00:00.000Z",
      ),
    );

    const execution = command.execute({
      tenant: DEFAULT_TENANT_CONTEXT,
      approvalId: "approval-product-context",
      preparedBy: "human-reviewer",
    });

    expect(execution.executionEnabled).toBe(false);
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(1);
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)[0]).toMatchObject({
      id: "audit-execution-prepared",
      eventType: "execution.prepared",
      entityType: "execution",
      entityId: "execution-live-1",
      details: {
        executionId: "execution-live-1",
        approvalId: "approval-product-context",
        workflowId: "shopify-product-orchestration",
        mode: "preview",
        executionEnabled: false,
      },
    });
    expect(JSON.stringify(auditRepository.list(DEFAULT_TENANT_CONTEXT))).not.toMatch(
      /execution\.started|execution\.completed|product\.published/iu,
    );
  });

  it("failed preparation creates no successful execution audit event", () => {
    const auditRepository = new InMemoryAuditRepository();
    const command = new PrepareExecutionApplicationCommand(
      new ExecutionPreparationService(
        new InMemoryApprovalRepository([{ ...approvedApproval, status: "pending", version: 1 }]),
        new InMemoryExecutionRepository(),
        new InMemoryWorkflowRepository(createDeterministicWorkflowSeedRecords()),
        new AuditRecorderService(auditRepository),
      ),
    );

    expect(() =>
      command.execute({ tenant: DEFAULT_TENANT_CONTEXT, approvalId: "approval-product-context", preparedBy: "human-reviewer" }),
    ).toThrow();
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(0);
  });

  it("reports audit append failure instead of silently claiming full success", () => {
    const failingAuditRepository: AuditRepository = {
      list: () => [],
      findById: () => undefined,
      append: () => {
        throw new Error("Audit append failed.");
      },
    };
    const command = new PrepareExecutionApplicationCommand(
      new ExecutionPreparationService(
        new InMemoryApprovalRepository([approvedApproval]),
        new InMemoryExecutionRepository(),
        new InMemoryWorkflowRepository(createDeterministicWorkflowSeedRecords()),
        new AuditRecorderService(failingAuditRepository),
      ),
    );

    expect(() =>
      command.execute({ tenant: DEFAULT_TENANT_CONTEXT, approvalId: "approval-product-context", preparedBy: "human-reviewer" }),
    ).toThrow(ExecutionRecordingError);
  });
});
