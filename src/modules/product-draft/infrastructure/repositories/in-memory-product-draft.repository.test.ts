import { describe, expect, it } from "vitest";

import type { ProductDraft } from "../../domain/models/product-draft.model.js";
import { ProductDraftRepositoryError } from "../../domain/repositories/product-draft.repository.js";
import { InMemoryProductDraftRepository } from "./in-memory-product-draft.repository.js";

type ProductDraftWithMutableTags = Omit<ProductDraft, "tags"> & {
  readonly tags: string[];
};

const buildDraft = (overrides: Partial<ProductDraft> = {}): ProductDraft => ({
  id: "draft-001",
  status: "draft",
  version: 1,
  source: {
    sourceType: "manual",
    sourceId: "manual-source-001",
    supplierId: "supplier-001",
    supplierProductId: "supplier-product-001",
    importedAt: "2026-07-18T08:00:00.000Z",
  },
  title: "Test Product",
  description: "Test description",
  vendor: "Test Vendor",
  productType: "Test Type",
  tags: ["Beauty", "Device"],
  targetMarkets: ["US", "MY"],
  images: [
    {
      id: "image-001",
      sourceUrl: "https://images.test/product.jpg",
      altText: "Product",
      position: 1,
      selected: true,
      primary: true,
    },
  ],
  variants: [
    {
      id: "variant-001",
      sourceVariantId: "source-variant-001",
      title: "Default",
      sku: "SKU-001",
      barcode: "0123456789012",
      options: [
        {
          name: "Color",
          value: "Black",
        },
      ],
      supplierPrice: {
        amount: 12.5,
        currency: "USD",
      },
      sellingPrice: {
        amount: 29.99,
        currency: "USD",
      },
      compareAtPrice: {
        amount: 39.99,
        currency: "USD",
      },
      inventoryQuantity: 5,
      available: true,
      weightGrams: 350,
      imageId: "image-001",
    },
  ],
  shipping: {
    minimumDeliveryDays: 3,
    maximumDeliveryDays: 7,
    shipsFromCountry: "US",
    shipsToCountries: ["US", "MY"],
  },
  seo: {
    title: "SEO Title",
    description: "SEO Description",
    handle: "test-product",
  },
  branding: {
    brandName: "Brand",
    productName: "Product",
    collectionName: "Collection",
    positioning: "Positioning",
    targetAudience: ["Skincare"],
    valueProposition: "Value",
  },
  riskAssessment: {
    level: "low",
    score: 10,
    reasons: ["Safe"],
    restrictedClaims: ["Medical claim"],
    assessedAt: "2026-07-18T08:00:00.000Z",
  },
  ai: {
    analyzed: true,
    branded: true,
    copyGenerated: true,
    pricingRecommended: false,
    riskAssessed: true,
    lastProcessedAt: "2026-07-18T08:00:00.000Z",
    modelReference: "safe-model-reference",
  },
  approval: {
    approvalRequired: true,
    approvalId: "approval-001",
    requestedAt: "2026-07-18T08:05:00.000Z",
  },
  publication: {
    marketplace: "future-marketplace",
    storeId: "future-store",
  },
  createdAt: "2026-07-18T08:30:00.000Z",
  updatedAt: "2026-07-18T08:30:00.000Z",
  ...overrides,
});

const expectRepositoryErrorCode = async (
  operation: () => Promise<unknown>,
  expectedCode: ProductDraftRepositoryError["code"],
): Promise<void> => {
  try {
    await operation();
    throw new Error("Expected ProductDraftRepositoryError.");
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ProductDraftRepositoryError);

    if (error instanceof ProductDraftRepositoryError) {
      expect(error.code).toBe(expectedCode);
    }
  }
};

describe("InMemoryProductDraftRepository", () => {
  it("saves a new Product Draft", async () => {
    const repository = new InMemoryProductDraftRepository();
    const draft = buildDraft();

    await repository.save(draft);

    await expect(repository.findById(draft.id)).resolves.toMatchObject({ id: draft.id });
  });

  it("returns a created save result", async () => {
    const repository = new InMemoryProductDraftRepository();
    const result = await repository.save(buildDraft());

    expect(result).toMatchObject({
      created: true,
      updated: false,
    });
  });

  it("finds by ID", async () => {
    const repository = new InMemoryProductDraftRepository();
    const draft = buildDraft();

    await repository.save(draft);

    await expect(repository.findById(draft.id)).resolves.toMatchObject({ title: "Test Product" });
  });

  it("returns null for an unknown ID", async () => {
    const repository = new InMemoryProductDraftRepository();

    await expect(repository.findById("missing-draft")).resolves.toBeNull();
  });

  it("checks existence by ID", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft());

    await expect(repository.existsById("draft-001")).resolves.toBe(true);
    await expect(repository.existsById("missing-draft")).resolves.toBe(false);
  });

  it("finds by idempotency key", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft(), { idempotencyKey: " request-key-001 " });

    await expect(repository.findByIdempotencyKey("request-key-001")).resolves.toMatchObject({ id: "draft-001" });
  });

  it("does not index blank idempotency keys", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft(), { idempotencyKey: " " });

    await expect(repository.findByIdempotencyKey(" ")).resolves.toBeNull();
  });

  it("rejects duplicate idempotency keys across different IDs", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft(), { idempotencyKey: "request-key-001" });

    await expectRepositoryErrorCode(
      () =>
        repository.save(buildDraft({ id: "draft-002", source: { ...buildDraft().source, sourceId: "manual-source-002" } }), {
          idempotencyKey: "request-key-001",
        }),
      "DUPLICATE_IDEMPOTENCY_KEY",
    );
  });

  it("finds by source reference", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft());

    await expect(repository.findBySourceReference("manual", " MANUAL-SOURCE-001 ")).resolves.toMatchObject({
      id: "draft-001",
    });
  });

  it("rejects duplicate source references across different IDs", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft());

    await expectRepositoryErrorCode(
      () => repository.save(buildDraft({ id: "draft-002" })),
      "DUPLICATE_SOURCE_REFERENCE",
    );
  });

  it("allows deterministic replay of an equivalent aggregate", async () => {
    const repository = new InMemoryProductDraftRepository();
    const draft = buildDraft();

    await repository.save(draft);
    const result = await repository.save(buildDraft());

    expect(result).toMatchObject({
      created: false,
      updated: false,
    });
  });

  it("rejects same-version conflicting content", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft());

    await expectRepositoryErrorCode(
      () => repository.save(buildDraft({ title: "Conflicting title" })),
      "VERSION_CONFLICT",
    );
  });

  it("rejects stale version updates", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft({ version: 2 }));

    await expectRepositoryErrorCode(() => repository.save(buildDraft({ version: 1 })), "VERSION_CONFLICT");
  });

  it("accepts a higher-version update", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft());
    await repository.save(buildDraft({ title: "Updated title", version: 2 }));

    await expect(repository.findById("draft-001")).resolves.toMatchObject({
      title: "Updated title",
      version: 2,
    });
  });

  it("returns an updated save result", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft());
    const result = await repository.save(buildDraft({ title: "Updated title", version: 2 }));

    expect(result).toMatchObject({
      created: false,
      updated: true,
    });
  });

  it("preserves Date values in cloned extension data", async () => {
    const repository = new InMemoryProductDraftRepository();
    const dateValue = new Date("2026-07-18T08:30:00.000Z");
    const draftWithDate = {
      ...buildDraft(),
      localDate: dateValue,
    };

    await repository.save(draftWithDate);

    const found = await repository.findById("draft-001");

    expect(found).toMatchObject({ id: "draft-001" });
    expect(dateValue).toBeInstanceOf(Date);
  });

  it("protects stored state from mutation after save", async () => {
    const repository = new InMemoryProductDraftRepository();
    const draft: ProductDraftWithMutableTags = {
      ...buildDraft(),
      tags: ["Beauty", "Device"],
    };

    await repository.save(draft);
    draft.tags.push("Unsafe mutation");

    await expect(repository.findById("draft-001")).resolves.toMatchObject({
      tags: ["Beauty", "Device"],
    });
  });

  it("protects stored state from mutation after read", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft());
    const found = await repository.findById("draft-001");

    if (found !== null) {
      Object.defineProperty(found, "tags", {
        value: ["Unsafe mutation"],
      });
    }

    await expect(repository.findById("draft-001")).resolves.toMatchObject({
      tags: ["Beauty", "Device"],
    });
  });

  it("lists drafts in stable newest-first order", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft({ id: "draft-001", createdAt: "2026-07-18T08:00:00.000Z" }));
    await repository.save(
      buildDraft({
        id: "draft-002",
        source: { ...buildDraft().source, sourceId: "manual-source-002" },
        createdAt: "2026-07-18T09:00:00.000Z",
      }),
    );

    await expect(repository.list()).resolves.toMatchObject({
      items: [{ id: "draft-002" }, { id: "draft-001" }],
    });
  });

  it("filters by status", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft({ id: "draft-001", status: "draft" }));
    await repository.save(
      buildDraft({
        id: "draft-002",
        status: "approved",
        source: { ...buildDraft().source, sourceId: "manual-source-002" },
      }),
    );

    await expect(repository.list({ status: "approved" })).resolves.toMatchObject({
      items: [{ id: "draft-002" }],
      total: 1,
    });
  });

  it("filters by source type", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft({ id: "draft-001", source: { ...buildDraft().source, sourceType: "manual" } }));
    await repository.save(
      buildDraft({
        id: "draft-002",
        source: { ...buildDraft().source, sourceType: "ai", sourceId: "ai-source-001" },
      }),
    );

    await expect(repository.list({ sourceType: "ai" })).resolves.toMatchObject({
      items: [{ id: "draft-002" }],
      total: 1,
    });
  });

  it("filters by created date range", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft({ id: "draft-001", createdAt: "2026-07-17T08:00:00.000Z" }));
    await repository.save(
      buildDraft({
        id: "draft-002",
        source: { ...buildDraft().source, sourceId: "manual-source-002" },
        createdAt: "2026-07-18T08:00:00.000Z",
      }),
    );

    await expect(repository.list({ createdFrom: "2026-07-18T00:00:00.000Z" })).resolves.toMatchObject({
      items: [{ id: "draft-002" }],
      total: 1,
    });
  });

  it("enforces list limit bounds", async () => {
    const repository = new InMemoryProductDraftRepository();

    await expectRepositoryErrorCode(() => repository.list({ limit: 101 }), "INVALID_QUERY");
    await expectRepositoryErrorCode(() => repository.list({ limit: 0 }), "INVALID_QUERY");
  });

  it("returns deterministic pagination metadata", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft({ id: "draft-001", createdAt: "2026-07-18T08:00:00.000Z" }));
    await repository.save(
      buildDraft({
        id: "draft-002",
        source: { ...buildDraft().source, sourceId: "manual-source-002" },
        createdAt: "2026-07-18T09:00:00.000Z",
      }),
    );

    await expect(repository.list({ limit: 1, offset: 0 })).resolves.toMatchObject({
      items: [{ id: "draft-002" }],
      total: 2,
      limit: 1,
      offset: 0,
      hasNextPage: true,
      nextOffset: 1,
    });
  });

  it("does not expose internal storage structures", async () => {
    const repository = new InMemoryProductDraftRepository();

    await repository.save(buildDraft());
    const firstResult = await repository.list();
    const secondResult = await repository.list();

    expect(firstResult.items).not.toBe(secondResult.items);
    expect(firstResult.items[0]).not.toBe(secondResult.items[0]);
    expect(secondResult).toMatchObject({
      items: [{ id: "draft-001" }],
      total: 1,
    });
  });
});
