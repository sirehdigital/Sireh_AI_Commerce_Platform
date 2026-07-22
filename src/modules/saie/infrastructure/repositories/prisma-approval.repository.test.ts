import { describe, expect, it } from "vitest";

import type { ApprovalRecord } from "../../application/index.js";
import { ApprovalVersionConflictError } from "../../application/index.js";
import { PrismaApprovalRepository } from "./prisma-approval.repository.js";

type ApprovalDelegate = ConstructorParameters<typeof PrismaApprovalRepository>[0];
type StoredApproval = Exclude<Awaited<ReturnType<ApprovalDelegate["findUnique"]>>, null>;

const tenant = { tenantId: "tenant-default", storeId: "store-default" };
const otherTenant = { tenantId: "tenant-other", storeId: "store-other" };
const now = "2026-07-22T10:35:00.000Z";

const createDelegate = (records = new Map<string, StoredApproval>()): ApprovalDelegate => ({
  findUnique: (args: unknown) =>
    Promise.resolve(records.get((args as { readonly where: { readonly id: string } }).where.id) ?? null),
  findFirst: (args: unknown) =>
    Promise.resolve([...records.values()].find((record) => matchesWhere(record, (args as { readonly where: Readonly<Record<string, unknown>> }).where)) ?? null),
  findMany: (args: unknown) =>
    Promise.resolve([...records.values()].filter((record) => matchesWhere(record, (args as { readonly where: Readonly<Record<string, unknown>> }).where))),
  create: (args: unknown) => {
    const input = args as { readonly data: StoredApproval };
    records.set(input.data.id, input.data);
    return Promise.resolve(input.data);
  },
  update: (args: unknown) => {
    const input = args as { readonly where: { readonly id: string }; readonly data: Partial<StoredApproval> };
    const existing = records.get(input.where.id);
    if (existing === undefined) {
      return Promise.reject(new Error("Approval not found."));
    }
    const updated = { ...existing, ...input.data };
    records.set(updated.id, updated);
    return Promise.resolve(updated);
  },
});

const matchesWhere = (record: StoredApproval, where: Readonly<Record<string, unknown>>): boolean =>
  Object.entries(where).every(([key, value]) => record[key as keyof StoredApproval] === value);

const buildApproval = (overrides: Partial<ApprovalRecord> = {}): ApprovalRecord => ({
  tenantId: "tenant-default",
  storeId: "store-default",
  id: "approval-1",
  proposalId: "draft-1",
  title: "Approve imported product draft",
  status: "pending",
  riskLevel: "LOW",
  requestedBy: "merchant-api",
  createdAt: now,
  requestedAt: now,
  requiresHumanApproval: true,
  executionEnabled: false,
  source: "deterministic-preview",
  version: 1,
  ...overrides,
});

describe("PrismaApprovalRepository", () => {
  it("persists pending approvals across repository recreation", async () => {
    const records = new Map<string, StoredApproval>();
    await new PrismaApprovalRepository(createDelegate(records)).save(tenant, buildApproval());

    const restarted = new PrismaApprovalRepository(createDelegate(records));

    await expect(restarted.findById(tenant, "approval-1")).resolves.toMatchObject({
      id: "approval-1",
      status: "pending",
      requiresHumanApproval: true,
      executionEnabled: false,
    });
  });

  it("blocks cross-tenant approval reads", async () => {
    const records = new Map<string, StoredApproval>();
    await new PrismaApprovalRepository(createDelegate(records)).save(tenant, buildApproval());

    await expect(new PrismaApprovalRepository(createDelegate(records)).findById(otherTenant, "approval-1")).resolves.toBeUndefined();
  });

  it("enforces expected-version updates", async () => {
    const repository = new PrismaApprovalRepository(createDelegate());
    await repository.save(tenant, buildApproval({ version: 2 }));

    await expect(repository.save(tenant, buildApproval({ status: "approved", version: 3 }), 1)).rejects.toBeInstanceOf(
      ApprovalVersionConflictError,
    );
  });
});
