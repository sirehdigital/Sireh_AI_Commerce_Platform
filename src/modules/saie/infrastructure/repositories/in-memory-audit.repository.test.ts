import { describe, expect, it } from "vitest";

import { DEFAULT_TENANT_CONTEXT, type AuditRecord, type TenantContext } from "../../application/index.js";
import { DuplicateAuditRecordError, InMemoryAuditRepository } from "./in-memory-audit.repository.js";
import { createDeterministicAuditSeedRecords } from "./audit-seed.provider.js";

const OTHER_TENANT: TenantContext = { tenantId: "tenant-other", storeId: "store-other" };

const buildAudit = (id: string, sequence = 1, context: TenantContext = DEFAULT_TENANT_CONTEXT): AuditRecord => ({
  tenantId: context.tenantId,
  storeId: context.storeId,
  id,
  eventType: "approval.approved",
  entityType: "approval",
  entityId: "approval-product-context",
  actor: "human-reviewer",
  occurredAt: "2026-07-16T00:00:00.000Z",
  summary: "Approval approval-product-context was approved.",
  details: {
    approvalId: "approval-product-context",
    approvalVersion: 2,
    executionEnabled: false,
  },
  source: "in-memory-live",
  sequence,
});

describe("InMemoryAuditRepository", () => {
  it("initializes deterministic seed records in stable order", () => {
    const repository = new InMemoryAuditRepository(createDeterministicAuditSeedRecords());

    expect(repository.list(DEFAULT_TENANT_CONTEXT).map((record) => record.id)).toEqual([
      "audit-product-agent-01",
      "audit-marketing-agent-02",
      "audit-content-agent-03",
      "audit-executive-orchestrator-04",
    ]);
  });

  it("finds records by ID and returns undefined for unknown records", () => {
    const repository = new InMemoryAuditRepository([buildAudit("audit-1")]);

    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "audit-1")?.id).toBe("audit-1");
    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "missing-audit")).toBeUndefined();
    expect(repository.findById(OTHER_TENANT, "audit-1")).toBeUndefined();
  });

  it("appends live records after seeded records", () => {
    const repository = new InMemoryAuditRepository(createDeterministicAuditSeedRecords());

    repository.append(DEFAULT_TENANT_CONTEXT, buildAudit("audit-live-1", 5));

    expect(repository.list(DEFAULT_TENANT_CONTEXT).map((record) => record.id)).toEqual([
      "audit-product-agent-01",
      "audit-marketing-agent-02",
      "audit-content-agent-03",
      "audit-executive-orchestrator-04",
      "audit-live-1",
    ]);
  });

  it("rejects duplicate IDs and keeps internal state unchanged", () => {
    const repository = new InMemoryAuditRepository([buildAudit("audit-1")]);

    expect(() => repository.append(DEFAULT_TENANT_CONTEXT, buildAudit("audit-1"))).toThrow(DuplicateAuditRecordError);
    expect(repository.list(DEFAULT_TENANT_CONTEXT).map((record) => record.id)).toEqual(["audit-1"]);
  });

  it("returns safe copies and protects nested details from accidental mutation", () => {
    const repository = new InMemoryAuditRepository([buildAudit("audit-1")]);
    const record = repository.findById(DEFAULT_TENANT_CONTEXT, "audit-1");

    if (record !== undefined) {
      const mutableDetails = record.details as Record<string, string | number | boolean | null>;
      mutableDetails.approvalVersion = 999;
    }

    expect(repository.findById(DEFAULT_TENANT_CONTEXT, "audit-1")?.details.approvalVersion).toBe(2);
  });

  it("does not expose update or delete capabilities", () => {
    const repository = new InMemoryAuditRepository();

    expect("update" in repository).toBe(false);
    expect("delete" in repository).toBe(false);
  });
});
