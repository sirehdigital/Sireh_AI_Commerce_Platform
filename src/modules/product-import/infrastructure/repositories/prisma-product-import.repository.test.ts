import { describe, expect, it } from "vitest";

import type { ProductImportRecord } from "../../domain/models/product-import.model.js";
import { PrismaProductImportRepository } from "./prisma-product-import.repository.js";

type ProductImportTestDelegate = ConstructorParameters<typeof PrismaProductImportRepository>[0];
type CreateData = Parameters<ProductImportTestDelegate["create"]>[0]["data"];
type StoredRecord = Exclude<Awaited<ReturnType<ProductImportTestDelegate["findUnique"]>>, null>;

const toStoredRecord = (data: CreateData): StoredRecord => ({
  ...data,
  completedAt: data.completedAt ?? null,
});

const createDelegate = (records = new Map<string, StoredRecord>()) => ({
  create: (args: { readonly data: CreateData }) => {
    const stored = toStoredRecord(args.data);
    records.set(stored.importId, stored);
    return Promise.resolve(stored);
  },
  update: (args: { readonly where: { readonly importId: string }; readonly data: Partial<CreateData> }) => {
    const existing = records.get(args.where.importId);
    if (existing === undefined) {
      return Promise.reject(new Error("Record not found."));
    }
    const updated: StoredRecord = {
      ...existing,
      ...args.data,
      updatedAt: args.data.updatedAt ?? new Date("2026-07-22T10:00:00.000Z"),
      completedAt: args.data.completedAt ?? existing.completedAt,
    };
    records.set(updated.importId, updated);
    return Promise.resolve(updated);
  },
  findUnique: (args: { readonly where: { readonly importId: string } }) =>
    Promise.resolve(records.get(args.where.importId) ?? null),
  findFirst: (args: { readonly where: Readonly<Record<string, unknown>> }) => {
    const matches = [...records.values()].filter((record) =>
      Object.entries(args.where).every(([key, value]) => record[key as keyof StoredRecord] === value),
    );
    return Promise.resolve(matches.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null);
  },
  findMany: (args: { readonly where: Readonly<Record<string, unknown>>; readonly take?: number; readonly skip?: number }) => {
    const skip = args.skip ?? 0;
    const take = args.take ?? 50;
    const matches = [...records.values()]
      .filter((record) => Object.entries(args.where).every(([key, value]) => record[key as keyof StoredRecord] === value))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    return Promise.resolve(matches.slice(skip, skip + take));
  },
  count: (args: { readonly where: Readonly<Record<string, unknown>> }) =>
    Promise.resolve(
      [...records.values()].filter((record) =>
        Object.entries(args.where).every(([key, value]) => record[key as keyof StoredRecord] === value),
      ).length,
    ),
});

const buildRecord = (overrides: Partial<ProductImportRecord> = {}): ProductImportRecord => ({
  importId: "product-import:1",
  tenantId: "tenant-default",
  storeId: "store-default",
  sourcePlatform: "generic",
  externalProductId: "external-1",
  sourceUrl: "https://supplier.test/products/external-1",
  supplierName: "Supplier",
  status: "PENDING_APPROVAL",
  pipelineStatus: "PENDING_APPROVAL",
  idempotencyKey: "generic:external-1",
  idempotencyBehavior: "CREATED",
  duplicate: false,
  forced: false,
  productDraftId: "draft-1",
  approvalId: "approval-1",
  auditReference: "audit-1",
  warnings: [],
  payload: {
    externalProductId: "external-1",
    sourcePlatform: "generic",
    title: "Lumora Product",
    images: [{ url: "https://images.test/product.jpg" }],
    variants: [{ sku: "SKU-1", supplierPrice: 8 }],
    currency: "USD",
    shippingDestinations: ["US"],
    tags: ["beauty"],
  },
  resultSnapshot: {
    importId: "product-import:1",
    source: { platform: "generic", externalProductId: "external-1" },
    idempotencyKey: "generic:external-1",
    idempotencyBehavior: "CREATED",
    approvalStatus: "PENDING_APPROVAL",
    approvalId: "approval-1",
    warnings: [],
    auditReference: "audit-1",
    finalPipelineStatus: "PENDING_APPROVAL",
    duplicate: false,
  },
  createdAt: "2026-07-22T09:00:00.000Z",
  updatedAt: "2026-07-22T09:00:00.000Z",
  completedAt: "2026-07-22T09:00:00.000Z",
  ...overrides,
});

describe("PrismaProductImportRepository", () => {
  it("creates and retrieves a product import record by ID", async () => {
    const repository = new PrismaProductImportRepository(createDelegate());

    await repository.create(buildRecord());

    await expect(repository.findById("product-import:1")).resolves.toMatchObject({
      importId: "product-import:1",
      productDraftId: "draft-1",
      approvalId: "approval-1",
    });
  });

  it("persists idempotency lookup across repository instances", async () => {
    const records = new Map<string, StoredRecord>();
    await new PrismaProductImportRepository(createDelegate(records)).create(buildRecord());

    const restartedRepository = new PrismaProductImportRepository(createDelegate(records));

    await expect(restartedRepository.findByIdentity({
      tenantId: "tenant-default",
      storeId: "store-default",
      sourcePlatform: "generic",
      externalProductId: "external-1",
    })).resolves.toMatchObject({
      importId: "product-import:1",
      duplicate: false,
    });
    await expect(restartedRepository.findByIdempotencyKey("generic:external-1")).resolves.toMatchObject({
      importId: "product-import:1",
    });
  });

  it("updates status, failure, draft, approval, and audit linkage", async () => {
    const repository = new PrismaProductImportRepository(createDelegate());
    await repository.create(buildRecord({ status: "PROCESSING", pipelineStatus: "ANALYZED" }));

    const updated = await repository.update("product-import:1", {
      status: "FAILED",
      pipelineStatus: "FAILED",
      failureStage: "ANALYZED",
      failureCode: "CONTROLLED_FAILURE",
      failureMessage: "Controlled failure.",
      productDraftId: "draft-failed",
      approvalId: "approval-failed",
      auditReference: "audit-failed",
      completedAt: "2026-07-22T09:10:00.000Z",
    });

    expect(updated).toMatchObject({
      status: "FAILED",
      failureCode: "CONTROLLED_FAILURE",
      productDraftId: "draft-failed",
      approvalId: "approval-failed",
      auditReference: "audit-failed",
    });
  });

  it("preserves forced re-import history and supports pagination and status filtering", async () => {
    const repository = new PrismaProductImportRepository(createDelegate());
    await repository.create(buildRecord({ importId: "product-import:1", createdAt: "2026-07-22T09:00:00.000Z" }));
    await repository.create(buildRecord({
      importId: "product-import:2",
      createdAt: "2026-07-22T09:05:00.000Z",
      idempotencyBehavior: "FORCED_REIMPORT",
      forced: true,
      parentImportId: "product-import:1",
    }));
    await repository.create(buildRecord({
      importId: "product-import:3",
      externalProductId: "external-2",
      idempotencyKey: "generic:external-2",
      status: "FAILED",
      pipelineStatus: "FAILED",
      createdAt: "2026-07-22T09:10:00.000Z",
    }));

    await expect(repository.list({ status: "PENDING_APPROVAL", limit: 1, offset: 0 })).resolves.toMatchObject({
      total: 2,
      hasNextPage: true,
      nextOffset: 1,
      items: [{ importId: "product-import:2", parentImportId: "product-import:1" }],
    });
    await expect(repository.list({ status: "FAILED" })).resolves.toMatchObject({
      total: 1,
      items: [{ importId: "product-import:3" }],
    });
  });

  it("isolates source identity lookups by tenant and store", async () => {
    const repository = new PrismaProductImportRepository(createDelegate());
    await repository.create(buildRecord({ importId: "tenant-a-import", tenantId: "tenant-a", storeId: "store-a" }));
    await repository.create(buildRecord({ importId: "tenant-b-import", tenantId: "tenant-b", storeId: "store-b" }));

    await expect(repository.findRecordByIdentity({
      tenantId: "tenant-b",
      storeId: "store-b",
      sourcePlatform: "generic",
      externalProductId: "external-1",
    })).resolves.toMatchObject({
      importId: "tenant-b-import",
    });
  });
});
