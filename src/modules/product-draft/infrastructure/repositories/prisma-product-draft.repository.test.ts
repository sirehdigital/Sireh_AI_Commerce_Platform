import { describe, expect, it } from "vitest";

import type { ProductDraft } from "../../domain/models/product-draft.model.js";
import { ProductDraftRepositoryError } from "../../domain/repositories/product-draft.repository.js";
import { PrismaProductDraftRepository } from "./prisma-product-draft.repository.js";

type ProductDraftDelegate = ConstructorParameters<typeof PrismaProductDraftRepository>[0];
type StoredDraft = Exclude<Awaited<ReturnType<ProductDraftDelegate["findUnique"]>>, null>;

const tenant = { tenantId: "tenant-default", storeId: "store-default" };
const otherTenant = { tenantId: "tenant-other", storeId: "store-other" };
const now = "2026-07-22T10:30:00.000Z";

const createDelegate = (records = new Map<string, StoredDraft>()): ProductDraftDelegate => ({
  findUnique: (args: unknown) =>
    Promise.resolve(records.get((args as { readonly where: { readonly id: string } }).where.id) ?? null),
  findFirst: (args: unknown) =>
    Promise.resolve([...records.values()].find((record) => matchesWhere(record, (args as { readonly where: Readonly<Record<string, unknown>> }).where)) ?? null),
  create: (args: unknown) => {
    const stored = (args as { readonly data: StoredDraft }).data;
    records.set(stored.id, stored);
    return Promise.resolve(stored);
  },
  update: (args: unknown) => {
    const input = args as { readonly where: { readonly id: string }; readonly data: Partial<StoredDraft> };
    const existing = records.get(input.where.id);
    if (existing === undefined) {
      return Promise.reject(new Error("Draft not found."));
    }
    const updated = { ...existing, ...input.data, updatedAt: input.data.updatedAt ?? existing.updatedAt } as StoredDraft;
    records.set(updated.id, updated);
    return Promise.resolve(updated);
  },
  count: (args: unknown) =>
    Promise.resolve([...records.values()].filter((record) => matchesWhere(record, (args as { readonly where: Readonly<Record<string, unknown>> }).where)).length),
  findMany: (args: unknown) => {
    const input = args as { readonly where: Readonly<Record<string, unknown>>; readonly skip?: number; readonly take?: number };
    const skip = input.skip ?? 0;
    const take = input.take ?? 50;
    const matches = [...records.values()]
      .filter((record) => matchesWhere(record, input.where))
      .sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime());
    return Promise.resolve(matches.slice(skip, skip + take));
  },
});

const matchesWhere = (record: StoredDraft, where: Readonly<Record<string, unknown>>): boolean =>
  Object.entries(where).every(([key, value]) => {
    if (key === "NOT" && typeof value === "object" && value !== null && "id" in value) {
      return record.id !== (value as { readonly id: string }).id;
    }

    if (typeof value === "object" && value !== null && ("gte" in value || "lte" in value)) {
      const dateValue = record[key as keyof StoredDraft];
      if (!(dateValue instanceof Date)) {
        return false;
      }
      const range = value as { readonly gte?: Date; readonly lte?: Date };
      return (range.gte === undefined || dateValue >= range.gte) && (range.lte === undefined || dateValue <= range.lte);
    }

    return record[key as keyof StoredDraft] === value;
  });

const buildDraft = (overrides: Partial<ProductDraft> = {}): ProductDraft => ({
  id: "draft-1",
  status: "draft",
  version: 1,
  source: {
    sourceType: "import",
    sourceId: "generic:external-1",
    supplierProductId: "external-1",
    importedAt: now,
  },
  title: "Lumora Botanical Lotion",
  description: "Premium botanical body lotion.",
  productType: "Body Care",
  tags: ["beauty"],
  targetMarkets: ["US"],
  images: [
    {
      sourceUrl: "https://images.test/lotion.jpg",
      position: 1,
      selected: true,
      primary: true,
    },
  ],
  variants: [
    {
      id: "draft-1:variant:1",
      title: "Default Title",
      sku: "LUMORA-1",
      options: [{ name: "Title", value: "Default Title" }],
      supplierPrice: { amount: 8, currency: "USD" },
      sellingPrice: { amount: 24, currency: "USD" },
      compareAtPrice: { amount: 32, currency: "USD" },
      inventoryQuantity: 20,
      available: true,
    },
  ],
  riskAssessment: {
    level: "low",
    reasons: [],
    restrictedClaims: [],
    assessedAt: now,
  },
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe("PrismaProductDraftRepository", () => {
  it("persists and retrieves drafts across repository recreation", async () => {
    const records = new Map<string, StoredDraft>();
    const repository = new PrismaProductDraftRepository(createDelegate(records), tenant);

    await repository.save(buildDraft(), { idempotencyKey: "generic:external-1" });
    const restarted = new PrismaProductDraftRepository(createDelegate(records), tenant);

    await expect(restarted.findById("draft-1")).resolves.toMatchObject({
      id: "draft-1",
      status: "draft",
      title: "Lumora Botanical Lotion",
    });
    await expect(restarted.findByIdempotencyKey("generic:external-1")).resolves.toMatchObject({ id: "draft-1" });
    await expect(restarted.findBySourceReference("import", "generic:external-1")).resolves.toMatchObject({ id: "draft-1" });
  });

  it("enforces tenant and store isolation", async () => {
    const records = new Map<string, StoredDraft>();
    await new PrismaProductDraftRepository(createDelegate(records), tenant).save(buildDraft(), {
      idempotencyKey: "generic:external-1",
    });

    const isolatedRepository = new PrismaProductDraftRepository(createDelegate(records), otherTenant);

    await expect(isolatedRepository.findById("draft-1")).resolves.toBeNull();
    await expect(isolatedRepository.findByIdempotencyKey("generic:external-1")).resolves.toBeNull();
  });

  it("rejects duplicate source references inside the same tenant store", async () => {
    const repository = new PrismaProductDraftRepository(createDelegate(), tenant);
    await repository.save(buildDraft({ id: "draft-1" }));

    await expect(repository.save(buildDraft({ id: "draft-2" }))).rejects.toMatchObject({
      code: "DUPLICATE_SOURCE_REFERENCE",
    } satisfies Partial<ProductDraftRepositoryError>);
  });
});
