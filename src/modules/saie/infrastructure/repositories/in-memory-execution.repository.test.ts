import { describe, expect, it } from "vitest";

import { DEFAULT_TENANT_CONTEXT, type ExecutionRecord, type TenantContext } from "../../application/index.js";
import { createDeterministicExecutionSeedRecords } from "./execution-seed.provider.js";
import {
  DuplicateExecutionPreparationError,
  DuplicateExecutionRecordError,
  InMemoryExecutionRepository,
} from "./in-memory-execution.repository.js";

const buildExecution = (
  id: string,
  approvalId = "approval-product-context",
  context: TenantContext = DEFAULT_TENANT_CONTEXT,
): ExecutionRecord => ({
  tenantId: context.tenantId,
  storeId: context.storeId,
  id,
  workflowId: "shopify-product-orchestration",
  approvalId,
  proposalId: "proposal-product-context",
  title: "Product Context execution preparation",
  status: "prepared",
  mode: "preview",
  executionEnabled: false,
  approvalRequired: true,
  executableActions: [],
  source: "in-memory-prepared",
  createdAt: "2026-07-16T00:00:00.000Z",
  preparedBy: "human-reviewer",
  approvalVersion: 2,
  riskLevel: "LOW",
  correlationId: approvalId,
  sequence: 2,
});

describe("InMemoryExecutionRepository", () => {
  const OTHER_TENANT: TenantContext = { tenantId: "tenant-other", storeId: "store-other" };

  it("initializes deterministic seed records in stable order", () => {
    const repository = new InMemoryExecutionRepository(createDeterministicExecutionSeedRecords());

    expect(repository.list(DEFAULT_TENANT_CONTEXT).map((record) => record.id)).toEqual([
      "execution-preview-shopify-product-orchestration",
    ]);
  });

  it("finds execution records by ID and approval ID", () => {
    const repository = new InMemoryExecutionRepository([buildExecution("execution-live-1")]);

    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "execution-live-1")?.id).toBe("execution-live-1");
    expect(repository.findByApprovalId(DEFAULT_TENANT_CONTEXT, "approval-product-context")?.id).toBe("execution-live-1");
    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "missing-execution")).toBeUndefined();
    expect(repository.findById(OTHER_TENANT, "execution-live-1")).toBeUndefined();
  });

  it("appends prepared records after seeded records", () => {
    const repository = new InMemoryExecutionRepository(createDeterministicExecutionSeedRecords());

    repository.append(DEFAULT_TENANT_CONTEXT, buildExecution("execution-live-1"));

    expect(repository.list(DEFAULT_TENANT_CONTEXT).map((record) => record.id)).toEqual([
      "execution-preview-shopify-product-orchestration",
      "execution-live-1",
    ]);
  });

  it("rejects duplicate execution IDs and keeps state unchanged", () => {
    const repository = new InMemoryExecutionRepository([buildExecution("execution-live-1")]);

    expect(() => repository.append(DEFAULT_TENANT_CONTEXT, buildExecution("execution-live-1", "approval-other"))).toThrow(
      DuplicateExecutionRecordError,
    );
    expect(repository.list(DEFAULT_TENANT_CONTEXT)).toHaveLength(1);
  });

  it("rejects duplicate approval preparation and keeps state unchanged", () => {
    const repository = new InMemoryExecutionRepository([buildExecution("execution-live-1")]);

    expect(() => repository.append(DEFAULT_TENANT_CONTEXT, buildExecution("execution-live-2"))).toThrow(
      DuplicateExecutionPreparationError,
    );
    expect(repository.list(DEFAULT_TENANT_CONTEXT).map((record) => record.id)).toEqual(["execution-live-1"]);
  });

  it("returns safe copies and exposes no update or delete capability", () => {
    const repository = new InMemoryExecutionRepository([buildExecution("execution-live-1")]);
    const record = repository.findById(DEFAULT_TENANT_CONTEXT, "execution-live-1");

    if (record !== undefined) {
      (record.executableActions as unknown as string[]).push("publish-product");
    }

    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "execution-live-1")?.executableActions).toEqual([]);
    expect("update" in repository).toBe(false);
    expect("delete" in repository).toBe(false);
  });
});
