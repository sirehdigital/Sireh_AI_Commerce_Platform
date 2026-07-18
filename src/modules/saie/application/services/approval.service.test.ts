import { describe, expect, it } from "vitest";

import { ApplicationNotFoundError, ApprovalVersionConflictError, DEFAULT_TENANT_CONTEXT } from "../index.js";
import { InMemoryApprovalRepository } from "../../infrastructure/repositories/index.js";
import type { ApprovalRecord } from "../repositories/index.js";
import { ApprovalService, InvalidApprovalTransitionError } from "./approval.service.js";

const buildApproval = (status: ApprovalRecord["status"] = "pending", version = 1): ApprovalRecord => ({
  tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
  storeId: DEFAULT_TENANT_CONTEXT.storeId,
  id: "approval-product-context",
  proposalId: "proposal-product-context",
  workflowId: "shopify-product-orchestration",
  title: "Product Context",
  status,
  riskLevel: "LOW",
  requestedBy: "Product Agent",
  createdAt: "Preview approval 01",
  requestedAt: "Preview approval 01",
  ...(status === "pending"
    ? {}
    : {
        decidedAt: "2026-07-16T00:00:00.000Z",
        decidedBy: "human-reviewer",
        decisionReason: "Already decided.",
      }),
  requiresHumanApproval: true,
  executionEnabled: false,
  source: status === "pending" ? "deterministic-preview" : "human-decision",
  version,
});

const createService = (approval: ApprovalRecord = buildApproval()): ApprovalService =>
  new ApprovalService(
    new InMemoryApprovalRepository([approval]),
    () => new Date("2026-07-16T00:00:00.000Z"),
  );

describe("ApprovalService", () => {
  it("approves a pending approval without enabling execution", () => {
    const approved = createService().approve({
      tenant: DEFAULT_TENANT_CONTEXT,
      approvalId: "approval-product-context",
      decidedBy: "human-reviewer",
      reason: "Reviewed and approved.",
      expectedVersion: 1,
    });

    expect(approved).toMatchObject({
      status: "approved",
      decidedBy: "human-reviewer",
      decisionReason: "Reviewed and approved.",
      executionEnabled: false,
      requiresHumanApproval: true,
      version: 2,
    });
  });

  it("rejects a pending approval and stores the required reason", () => {
    const rejected = createService().reject({
      tenant: DEFAULT_TENANT_CONTEXT,
      approvalId: "approval-product-context",
      decidedBy: "human-reviewer",
      reason: "Supplier risk requires revision.",
      expectedVersion: 1,
    });

    expect(rejected).toMatchObject({
      status: "rejected",
      decisionReason: "Supplier risk requires revision.",
      executionEnabled: false,
      version: 2,
    });
  });

  it("returns not found for unknown approvals", () => {
    expect(() =>
      createService().approve({
        tenant: DEFAULT_TENANT_CONTEXT,
        approvalId: "missing-approval",
        decidedBy: "human-reviewer",
      }),
    ).toThrow(ApplicationNotFoundError);
  });

  it("rejects repeated or conflicting decisions", () => {
    expect(() =>
      createService(buildApproval("approved", 2)).approve({
        tenant: DEFAULT_TENANT_CONTEXT,
        approvalId: "approval-product-context",
        decidedBy: "human-reviewer",
      }),
    ).toThrow(InvalidApprovalTransitionError);
    expect(() =>
      createService(buildApproval("approved", 2)).reject({
        tenant: DEFAULT_TENANT_CONTEXT,
        approvalId: "approval-product-context",
        decidedBy: "human-reviewer",
        reason: "Changed mind.",
      }),
    ).toThrow(InvalidApprovalTransitionError);
    expect(() =>
      createService(buildApproval("rejected", 2)).approve({
        tenant: DEFAULT_TENANT_CONTEXT,
        approvalId: "approval-product-context",
        decidedBy: "human-reviewer",
      }),
    ).toThrow(InvalidApprovalTransitionError);
    expect(() =>
      createService(buildApproval("rejected", 2)).reject({
        tenant: DEFAULT_TENANT_CONTEXT,
        approvalId: "approval-product-context",
        decidedBy: "human-reviewer",
        reason: "Again.",
      }),
    ).toThrow(InvalidApprovalTransitionError);
  });

  it("rejects stale expected versions", () => {
    expect(() =>
      createService(buildApproval("pending", 2)).approve({
        tenant: DEFAULT_TENANT_CONTEXT,
        approvalId: "approval-product-context",
        decidedBy: "human-reviewer",
        expectedVersion: 1,
      }),
    ).toThrow(ApprovalVersionConflictError);
  });
});
