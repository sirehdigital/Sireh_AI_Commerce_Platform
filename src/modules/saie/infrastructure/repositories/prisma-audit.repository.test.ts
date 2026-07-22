import { describe, expect, it } from "vitest";

import type { AuditRecord } from "../../application/index.js";
import { PrismaAuditRepository } from "./prisma-audit.repository.js";

type AuditDelegate = ConstructorParameters<typeof PrismaAuditRepository>[0];
type StoredAudit = Exclude<Awaited<ReturnType<AuditDelegate["findUnique"]>>, null>;

const tenant = { tenantId: "tenant-default", storeId: "store-default" };
const otherTenant = { tenantId: "tenant-other", storeId: "store-other" };
const now = "2026-07-22T10:40:00.000Z";

const createDelegate = (records = new Map<string, StoredAudit>()): AuditDelegate => ({
  findUnique: (args: unknown) =>
    Promise.resolve(records.get((args as { readonly where: { readonly id: string } }).where.id) ?? null),
  findFirst: (args: unknown) =>
    Promise.resolve([...records.values()].find((record) => matchesWhere(record, (args as { readonly where: Readonly<Record<string, unknown>> }).where)) ?? null),
  findMany: (args: unknown) =>
    Promise.resolve([...records.values()].filter((record) => matchesWhere(record, (args as { readonly where: Readonly<Record<string, unknown>> }).where))),
  create: (args: unknown) => {
    const input = args as { readonly data: StoredAudit };
    records.set(input.data.id, input.data);
    return Promise.resolve(input.data);
  },
});

const matchesWhere = (record: StoredAudit, where: Readonly<Record<string, unknown>>): boolean =>
  Object.entries(where).every(([key, value]) => record[key as keyof StoredAudit] === value);

const buildAudit = (overrides: Partial<AuditRecord> = {}): AuditRecord => ({
  tenantId: "tenant-default",
  storeId: "store-default",
  id: "audit-1",
  eventType: "preview.agent-activity",
  entityType: "agent-activity",
  entityId: "product-import:1",
  actor: "product-import-pipeline",
  occurredAt: now,
  summary: "Product import completed.",
  details: {
    importId: "product-import:1",
    token: "secret-token",
    finalPipelineStatus: "PENDING_APPROVAL",
  },
  source: "deterministic-preview",
  sequence: 1,
  correlationId: "corr-1",
  activityType: "product-import.pipeline",
  status: "READY_FOR_REVIEW",
  recordedAt: now,
  ...overrides,
});

describe("PrismaAuditRepository", () => {
  it("persists audit records across repository recreation", async () => {
    const records = new Map<string, StoredAudit>();
    await new PrismaAuditRepository(createDelegate(records)).append(tenant, buildAudit());

    const restarted = new PrismaAuditRepository(createDelegate(records));

    await expect(restarted.findById(tenant, "audit-1")).resolves.toMatchObject({
      id: "audit-1",
      entityId: "product-import:1",
      status: "READY_FOR_REVIEW",
    });
    await expect(restarted.list(tenant)).resolves.toHaveLength(1);
  });

  it("redacts sensitive audit detail fields before persistence", async () => {
    const records = new Map<string, StoredAudit>();
    await new PrismaAuditRepository(createDelegate(records)).append(tenant, buildAudit());

    const stored = records.get("audit-1");

    expect(stored?.details).toMatchObject({ token: "[REDACTED]" });
    await expect(new PrismaAuditRepository(createDelegate(records)).findById(tenant, "audit-1")).resolves.toMatchObject({
      details: { token: "[REDACTED]" },
    });
  });

  it("blocks cross-tenant audit reads", async () => {
    const records = new Map<string, StoredAudit>();
    await new PrismaAuditRepository(createDelegate(records)).append(tenant, buildAudit());

    await expect(new PrismaAuditRepository(createDelegate(records)).findById(otherTenant, "audit-1")).resolves.toBeUndefined();
  });
});
