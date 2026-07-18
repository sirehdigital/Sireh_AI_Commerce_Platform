import { describe, expect, it } from "vitest";

import { InMemoryApprovalRepository, InMemoryAuditRepository } from "../../infrastructure/index.js";
import { DEFAULT_TENANT_CONTEXT } from "../tenant/index.js";
import type { ApprovalRecord, AuditRepository } from "../repositories/index.js";
import { ApprovalService } from "../services/approval.service.js";
import { AuditRecorderService, AuditRecordingError } from "../services/audit-recorder.service.js";
import {
  ApproveApprovalApplicationCommand,
  RejectApprovalApplicationCommand,
} from "./approval.commands.js";

const buildApproval = (): ApprovalRecord => ({
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: "approval-product-context",
  proposalId: "proposal-product-context",
  workflowId: "shopify-product-orchestration",
  title: "Product Context",
  status: "pending",
  riskLevel: "LOW",
  requestedBy: "Product Agent",
  createdAt: "Preview approval 01",
  requestedAt: "Preview approval 01",
  requiresHumanApproval: true,
  executionEnabled: false,
  source: "deterministic-preview",
  version: 1,
});

describe("Approval command audit integration", () => {
  it("successful approve adds exactly one matching audit event", () => {
    const auditRepository = new InMemoryAuditRepository();
    const approval = new ApproveApprovalApplicationCommand(
      new ApprovalService(new InMemoryApprovalRepository([buildApproval()])),
      new AuditRecorderService(
        auditRepository,
        () => "audit-live-approve",
        () => "2026-07-16T00:00:00.000Z",
      ),
    ).execute({
      tenant: DEFAULT_TENANT_CONTEXT,
      approvalId: "approval-product-context",
      decidedBy: "human-reviewer",
      reason: "Reviewed.",
      expectedVersion: 1,
    });

    expect(approval.executionEnabled).toBe(false);
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(1);
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)[0]).toMatchObject({
      id: "audit-live-approve",
      eventType: "approval.approved",
      entityId: "approval-product-context",
      details: {
        decision: "approved",
        approvalVersion: approval.version,
      },
    });
  });

  it("successful reject adds exactly one matching audit event", () => {
    const auditRepository = new InMemoryAuditRepository();
    new RejectApprovalApplicationCommand(
      new ApprovalService(new InMemoryApprovalRepository([buildApproval()])),
      new AuditRecorderService(
        auditRepository,
        () => "audit-live-reject",
        () => "2026-07-16T00:00:00.000Z",
      ),
    ).execute({
      tenant: DEFAULT_TENANT_CONTEXT,
      approvalId: "approval-product-context",
      decidedBy: "human-reviewer",
      reason: "Supplier risk.",
      expectedVersion: 1,
    });

    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(1);
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)[0]).toMatchObject({
      eventType: "approval.rejected",
      details: {
        reason: "Supplier risk.",
      },
    });
  });

  it("failed decisions do not add successful audit events", () => {
    const auditRepository = new InMemoryAuditRepository();
    const command = new ApproveApprovalApplicationCommand(
      new ApprovalService(new InMemoryApprovalRepository([buildApproval()])),
      new AuditRecorderService(auditRepository),
    );

    expect(() =>
      command.execute({
        tenant: DEFAULT_TENANT_CONTEXT,
        approvalId: "missing-approval",
        decidedBy: "human-reviewer",
      }),
    ).toThrow();
    expect(auditRepository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(0);
  });

  it("reports audit append failure instead of silently reporting full success", () => {
    const failingAuditRepository: AuditRepository = {
      list: () => [],
      findById: () => undefined,
      append: () => {
        throw new Error("Audit append failed.");
      },
    };
    const command = new ApproveApprovalApplicationCommand(
      new ApprovalService(new InMemoryApprovalRepository([buildApproval()])),
      new AuditRecorderService(failingAuditRepository),
    );

    expect(() =>
      command.execute({
        tenant: DEFAULT_TENANT_CONTEXT,
        approvalId: "approval-product-context",
        decidedBy: "human-reviewer",
        expectedVersion: 1,
      }),
    ).toThrow(AuditRecordingError);
  });
});
