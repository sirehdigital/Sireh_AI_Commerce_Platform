import { describe, expect, it } from "vitest";

import { ApprovalVersionConflictError, DEFAULT_TENANT_CONTEXT, type ApprovalRecord, type TenantContext } from "../../application/index.js";
import { DuplicateApprovalRecordError, InMemoryApprovalRepository } from "./in-memory-approval.repository.js";
import { createDeterministicApprovalSeedRecords } from "./approval-seed.provider.js";

const OTHER_TENANT: TenantContext = { tenantId: "tenant-other", storeId: "store-other" };

const buildApproval = (id: string, version = 1, context: TenantContext = DEFAULT_TENANT_CONTEXT): ApprovalRecord => ({
  tenantId: context.tenantId,
  storeId: context.storeId,
  id,
  proposalId: `proposal-${id}`,
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
  version,
});

describe("InMemoryApprovalRepository", () => {
  it("initializes deterministic approval records in stable order", () => {
    const repository = new InMemoryApprovalRepository(createDeterministicApprovalSeedRecords());

    expect(repository.list(DEFAULT_TENANT_CONTEXT).map((approval) => approval.id)).toEqual([
      "approval-product-context",
      "approval-marketing-proposal",
      "approval-content-proposal",
      "approval-executive-plan",
    ]);
  });

  it("finds records by ID and returns undefined for unknown records", () => {
    const repository = new InMemoryApprovalRepository([buildApproval("approval-1")]);

    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "approval-1")?.id).toBe("approval-1");
    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "missing-approval")).toBeUndefined();
    expect(repository.findById(OTHER_TENANT, "approval-1")).toBeUndefined();
  });

  it("rejects duplicate approval IDs", () => {
    expect(
      () => new InMemoryApprovalRepository([buildApproval("approval-1"), buildApproval("approval-1")]),
    ).toThrow(DuplicateApprovalRecordError);
  });

  it("returns safe copies and does not expose mutable internal arrays", () => {
    const repository = new InMemoryApprovalRepository([
      buildApproval("approval-1"),
      buildApproval("approval-2"),
    ]);
    const list = repository.list(DEFAULT_TENANT_CONTEXT);
    const mutableList = list as readonly ApprovalRecord[] & { pop: () => ApprovalRecord | undefined };
    const first = repository.findById(DEFAULT_TENANT_CONTEXT, "approval-1");

    mutableList.pop();
    if (first !== undefined) {
      const mutableFirst = first as ApprovalRecord & { title: string };
      mutableFirst.title = "Unsafe title";
    }

    expect(repository.list(DEFAULT_TENANT_CONTEXT).map((approval) => approval.id)).toEqual(["approval-1", "approval-2"]);
    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "approval-1")?.title).toBe("Product Context");
  });

  it("saves records, increments persisted state, and keeps copies safe", () => {
    const repository = new InMemoryApprovalRepository([buildApproval("approval-1")]);
    const updated = repository.save(
      DEFAULT_TENANT_CONTEXT,
      {
        ...buildApproval("approval-1"),
        status: "approved",
        decidedBy: "human-reviewer",
        decidedAt: "2026-07-16T00:00:00.000Z",
        decisionReason: "Reviewed.",
        source: "human-decision",
        version: 2,
      },
      1,
    );

    expect(updated.version).toBe(2);
    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "approval-1")).toMatchObject({
      status: "approved",
      executionEnabled: false,
      requiresHumanApproval: true,
      version: 2,
    });
  });

  it("rejects stale expected versions and leaves internal state unchanged", () => {
    const repository = new InMemoryApprovalRepository([buildApproval("approval-1", 2)]);

    expect(() => repository.save(DEFAULT_TENANT_CONTEXT, { ...buildApproval("approval-1"), version: 3 }, 1)).toThrow(
      ApprovalVersionConflictError,
    );
    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "approval-1")?.version).toBe(2);
  });
});
