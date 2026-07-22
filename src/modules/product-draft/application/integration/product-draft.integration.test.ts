import { describe, expect, it } from "vitest";

import type { CreateProductDraftDto } from "../dto/create-product-draft.dto.js";
import {
  CreateProductDraftApplicationError,
  CreateProductDraftService,
} from "../services/create-product-draft.service.js";
import { InMemoryProductDraftRepository } from "../../infrastructure/repositories/in-memory-product-draft.repository.js";

const REQUESTED_AT = "2026-07-18T08:00:00.000Z";
const CREATED_AT = "2026-07-18T08:30:00.000Z";

const createProductDraftInput = (overrides: Partial<CreateProductDraftDto> = {}): CreateProductDraftDto => ({
  sourceType: "autods",
  sourceReference: {
    sourceId: "autods-product-001",
    sourceName: "AutoDS",
    importedAt: REQUESTED_AT,
  },
  supplier: {
    supplierId: "supplier-001",
    supplierName: "Supplier One",
    supplierProductId: "supplier-product-001",
    marketplace: "supplier-marketplace",
  },
  externalCorrelationId: "external-correlation-001",
  title: "Portable LED Mirror",
  description: "Compact LED mirror prepared for Product Draft validation.",
  vendor: "Sireh Test Vendor",
  productType: "Beauty Accessory",
  tags: ["Beauty", "Mirror"],
  targetMarkets: ["US", "MY"],
  images: [
    {
      url: "https://images.test/portable-led-mirror.jpg",
      altText: "Portable LED mirror",
      position: 1,
    },
  ],
  variants: [
    {
      sourceVariantId: "source-variant-001",
      title: "Default",
      sku: "LED-MIRROR-001",
      price: {
        amount: 39.99,
        currency: "USD",
      },
      cost: {
        amount: 16.5,
        currency: "USD",
      },
      inventoryQuantity: 12,
      optionValues: [
        {
          name: "Color",
          value: "White",
        },
      ],
      weight: 450,
      weightUnit: "g",
      taxable: true,
      requiresShipping: true,
    },
  ],
  request: {
    requestedBy: "operator-001",
    requestedAt: REQUESTED_AT,
    correlationId: "correlation-001",
    idempotencyKey: "product-draft-request-001",
  },
  ...overrides,
});

const createService = () => {
  const repository = new InMemoryProductDraftRepository();
  const service = new CreateProductDraftService({
    repository,
    idGenerator: () => "product-draft-1",
    clock: () => CREATED_AT,
  });

  return {
    repository,
    service,
  };
};

describe("Product Draft creation integration", () => {
  it("successfully creates a Product Draft", async () => {
    const { repository, service } = createService();

    const result = await service.execute(createProductDraftInput());
    const storedDrafts = await repository.list();

    expect(result).toMatchObject({
      status: "CREATED",
      created: true,
      idempotentReplay: false,
      idempotencyKey: "product-draft-request-001",
      correlationId: "correlation-001",
      draft: {
        id: "product-draft-1",
        status: "draft",
        version: 1,
        title: "Portable LED Mirror",
        source: {
          sourceType: "autods",
          sourceId: "autods-product-001",
          supplierId: "supplier-001",
          supplierProductId: "supplier-product-001",
        },
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    });
    expect(storedDrafts).toMatchObject({
      total: 1,
      items: [{ id: "product-draft-1" }],
    });
  });

  it("re-submits the same request with the same idempotency key as a replay without a duplicate draft", async () => {
    const { repository, service } = createService();
    const input = createProductDraftInput();

    const createdResult = await service.execute(input);
    const replayResult = await service.execute(input);
    const storedDrafts = await repository.list();

    expect(replayResult).toMatchObject({
      status: "IDEMPOTENT_REPLAY",
      created: false,
      idempotentReplay: true,
      draft: {
        id: createdResult.draft.id,
      },
    });
    expect(storedDrafts).toMatchObject({
      total: 1,
      items: [{ id: createdResult.draft.id }],
    });
  });

  it("rejects another request using the same source reference but a different idempotency key", async () => {
    const { repository, service } = createService();

    await service.execute(createProductDraftInput());

    await expect(
      service.execute(
        createProductDraftInput({
          request: {
            requestedBy: "operator-002",
            requestedAt: REQUESTED_AT,
            correlationId: "correlation-002",
            idempotencyKey: "product-draft-request-002",
          },
        }),
      ),
    ).rejects.toMatchObject({
      code: "DUPLICATE_SOURCE_REFERENCE",
    } satisfies Partial<CreateProductDraftApplicationError>);

    await expect(repository.list()).resolves.toMatchObject({
      total: 1,
      items: [{ id: "product-draft-1" }],
    });
  });
});
