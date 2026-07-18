import { describe, expect, it } from "vitest";

import { InMemoryAuditRepository } from "../../infrastructure/index.js";
import { DEFAULT_TENANT_CONTEXT } from "../tenant/index.js";
import { AuditRecorderService, UnsupportedAuditEventError } from "./audit-recorder.service.js";

describe("AuditRecorderService", () => {
  it("records approved approval decisions as live audit events", () => {
    const repository = new InMemoryAuditRepository();
    const recorder = new AuditRecorderService(
      repository,
      () => "audit-live-1",
      () => "2026-07-16T00:00:00.000Z",
    );

    const record = recorder.recordApprovalDecision({
      tenant: DEFAULT_TENANT_CONTEXT,
      approvalId: "approval-product-context",
      proposalId: "proposal-product-context",
      workflowId: "shopify-product-orchestration",
      decision: "approved",
      actor: "human-reviewer",
      reason: "Reviewed.",
      approvalVersion: 2,
    });

    expect(record).toMatchObject({
      id: "audit-live-1",
      eventType: "approval.approved",
      entityType: "approval",
      entityId: "approval-product-context",
      actor: "human-reviewer",
      occurredAt: "2026-07-16T00:00:00.000Z",
      source: "in-memory-live",
      correlationId: "approval-product-context",
      sequence: 1,
      details: {
        approvalId: "approval-product-context",
        proposalId: "proposal-product-context",
        workflowId: "shopify-product-orchestration",
        decision: "approved",
        reason: "Reviewed.",
        approvalVersion: 2,
        executionEnabled: false,
      },
    });
  });

  it("records rejected approval decisions as live audit events", () => {
    const recorder = new AuditRecorderService(
      new InMemoryAuditRepository(),
      () => "audit-live-2",
      () => "2026-07-16T00:00:00.000Z",
    );

    expect(
      recorder.recordApprovalDecision({
        tenant: DEFAULT_TENANT_CONTEXT,
        approvalId: "approval-product-context",
        decision: "rejected",
        actor: "human-reviewer",
        reason: "Supplier risk.",
        approvalVersion: 2,
      }),
    ).toMatchObject({
      eventType: "approval.rejected",
      summary: "Approval approval-product-context was rejected.",
      source: "in-memory-live",
    });
  });

  it("rejects unsupported decisions", () => {
    const recorder = new AuditRecorderService(new InMemoryAuditRepository());

    expect(() =>
      recorder.recordApprovalDecision({
        tenant: DEFAULT_TENANT_CONTEXT,
        approvalId: "approval-product-context",
        decision: "withdrawn" as "approved",
        actor: "human-reviewer",
        approvalVersion: 2,
      }),
    ).toThrow(UnsupportedAuditEventError);
  });

  it("records prepared executions as live audit events without executable activity", () => {
    const recorder = new AuditRecorderService(
      new InMemoryAuditRepository(),
      () => "audit-execution-prepared",
      () => "2026-07-16T00:00:00.000Z",
    );

    expect(
      recorder.recordExecutionPrepared({
        tenant: DEFAULT_TENANT_CONTEXT,
        executionId: "execution-live-product-context",
        approvalId: "approval-product-context",
        proposalId: "proposal-product-context",
        workflowId: "shopify-product-orchestration",
        preparedBy: "internal-review-coordinator",
        approvalVersion: 2,
        mode: "preview",
        executionEnabled: false,
      }),
    ).toMatchObject({
      id: "audit-execution-prepared",
      eventType: "execution.prepared",
      entityType: "execution",
      entityId: "execution-live-product-context",
      source: "in-memory-live",
      details: {
        mode: "preview",
        executionEnabled: false,
      },
    });
  });
});
