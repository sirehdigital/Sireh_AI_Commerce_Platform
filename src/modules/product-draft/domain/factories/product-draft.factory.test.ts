import { describe, expect, it } from "vitest";

import type { CreateProductDraftDto } from "../../application/dto/create-product-draft.dto.js";
import { ProductDraftFactory, ProductDraftValidationError } from "./product-draft.factory.js";

const DRAFT_ID = "product-draft-001";
const NOW = "2026-07-18T08:30:00.000Z";
const REQUESTED_AT = "2026-07-18T08:00:00.000Z";

const createDraft = (input: CreateProductDraftDto = createValidInput()) =>
  ProductDraftFactory.create(input, {
    idGenerator: () => DRAFT_ID,
    clock: () => NOW,
  });

const createValidInput = (overrides: Partial<CreateProductDraftDto> = {}): CreateProductDraftDto => ({
  sourceType: "manual",
  sourceReference: {
    sourceId: "manual-entry-001",
    sourceName: "Manual Entry",
    importedAt: REQUESTED_AT,
  },
  supplier: {
    supplierId: "supplier-001",
    supplierName: "Supplier One",
    supplierProductId: "supplier-product-001",
    marketplace: "supplier-marketplace",
  },
  externalCorrelationId: "external-correlation-001",
  title: " Test Product ",
  description: " Test description ",
  vendor: " Test Vendor ",
  productType: " Test Type ",
  tags: [" Beauty ", "beauty", "Device"],
  targetMarkets: [" US ", "us", "MY"],
  images: [
    {
      url: " https://images.test/product-a.jpg ",
      altText: " Product A ",
      position: 2,
    },
    {
      url: "https://images.test/product-a.jpg",
      altText: "Duplicate",
      position: 1,
    },
  ],
  variants: [
    {
      sourceVariantId: "source-variant-001",
      title: " Default Variant ",
      sku: " SKU-001 ",
      price: {
        amount: 29.99,
        currency: "USD",
      },
      compareAtPrice: {
        amount: 39.99,
        currency: "USD",
      },
      cost: {
        amount: 12.5,
        currency: "USD",
      },
      barcode: " 0123456789012 ",
      inventoryQuantity: 5,
      optionValues: [
        {
          name: " Color ",
          value: " Black ",
        },
      ],
      weight: 350,
      weightUnit: "g",
      taxable: true,
      requiresShipping: true,
    },
  ],
  shippingEstimate: {
    minimumDeliveryDays: 3,
    maximumDeliveryDays: 7,
    shipsFromCountry: " US ",
    shipsToCountries: [" US ", "us", "MY"],
  },
  seo: {
    title: " SEO Title ",
    description: " SEO Description ",
    handle: " test-product ",
  },
  branding: {
    brandName: " Brand ",
    productName: " Product ",
    collectionName: " Collection ",
    positioning: " Positioning ",
    targetAudience: [" Skincare ", "skincare"],
    valueProposition: " Value ",
  },
  riskAssessment: {
    level: "low",
    score: 10,
    reasons: [" Safe "],
    restrictedClaims: [" Medical claim "],
    assessedAt: REQUESTED_AT,
  },
  ai: {
    analyzed: true,
    branded: true,
    copyGenerated: true,
    pricingRecommended: false,
    riskAssessed: true,
    lastProcessedAt: REQUESTED_AT,
    modelReference: "safe-model-reference",
  },
  request: {
    requestedBy: "operator-001",
    requestedAt: REQUESTED_AT,
    correlationId: "correlation-001",
    idempotencyKey: "idempotency-001",
  },
  ...overrides,
});

const expectValidationCodes = (input: CreateProductDraftDto, expectedCodes: readonly string[]): void => {
  try {
    createDraft(input);
    throw new Error("Expected ProductDraftValidationError.");
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ProductDraftValidationError);

    if (error instanceof ProductDraftValidationError) {
      expect(error.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([...expectedCodes]));
    }
  }
};

const requireFirstVariant = (input: CreateProductDraftDto) => {
  const variant = input.variants[0];

  if (variant === undefined) {
    throw new Error("Expected base variant.");
  }

  return variant;
};

describe("ProductDraftFactory", () => {
  it("creates a valid Product Draft", () => {
    const draft = createDraft();

    expect(draft).toMatchObject({
      id: DRAFT_ID,
      source: {
        sourceType: "manual",
        sourceId: "manual-entry-001",
        supplierId: "supplier-001",
        supplierProductId: "supplier-product-001",
        importedAt: REQUESTED_AT,
      },
      title: "Test Product",
      description: "Test description",
      vendor: "Test Vendor",
      productType: "Test Type",
    });
    expect(draft.images).toHaveLength(1);
    expect(draft.variants).toHaveLength(1);
  });

  it("uses the injected ID generator", () => {
    const draft = ProductDraftFactory.create(createValidInput(), {
      idGenerator: () => "generated-draft-id",
      clock: () => NOW,
    });

    expect(draft.id).toBe("generated-draft-id");
    expect(draft.variants[0]?.id).toBe("generated-draft-id:variant:1");
  });

  it("uses the injected clock", () => {
    const draft = createDraft();

    expect(draft.createdAt).toBe(NOW);
    expect(draft.updatedAt).toBe(NOW);
  });

  it("sets initial status and version correctly", () => {
    const draft = createDraft();

    expect(draft.status).toBe("draft");
    expect(draft.version).toBe(1);
    expect(draft.publication).toBeUndefined();
    expect(draft.approval).toBeUndefined();
    expect(draft.archivedAt).toBeUndefined();
  });

  it("trims core text fields", () => {
    const draft = createDraft();

    expect(draft.title).toBe("Test Product");
    expect(draft.description).toBe("Test description");
    expect(draft.vendor).toBe("Test Vendor");
  });

  it("deduplicates tags case-insensitively", () => {
    const draft = createDraft();

    expect(draft.tags).toEqual(["Beauty", "Device"]);
  });

  it("deduplicates target markets case-insensitively", () => {
    const draft = createDraft();

    expect(draft.targetMarkets).toEqual(["US", "MY"]);
  });

  it("rejects an empty title", () => {
    expectValidationCodes(createValidInput({ title: " " }), ["TITLE_REQUIRED"]);
  });

  it("rejects an empty description", () => {
    expectValidationCodes(createValidInput({ description: " " }), ["DESCRIPTION_REQUIRED"]);
  });

  it("rejects missing variants", () => {
    expectValidationCodes(createValidInput({ variants: [] }), ["VARIANTS_REQUIRED"]);
  });

  it("rejects duplicate SKUs case-insensitively", () => {
    const baseInput = createValidInput();
    const variant = requireFirstVariant(baseInput);
    const duplicateSkuInput = createValidInput({
      variants: [
        variant,
        {
          ...variant,
          sku: "sku-001",
        },
      ],
    });

    expectValidationCodes(duplicateSkuInput, ["VARIANT_SKU_DUPLICATE"]);
  });

  it("rejects negative inventory", () => {
    const baseInput = createValidInput();
    const variant = requireFirstVariant(baseInput);

    expectValidationCodes(
      createValidInput({
        variants: [{ ...variant, inventoryQuantity: -1 }],
      }),
      ["INVENTORY_QUANTITY_INVALID"],
    );
  });

  it("rejects invalid money currency", () => {
    const baseInput = createValidInput();
    const variant = requireFirstVariant(baseInput);

    expectValidationCodes(
      createValidInput({
        variants: [
          {
            ...variant,
            price: {
              amount: 29.99,
              currency: "usd",
            },
          },
        ],
      }),
      ["PRICE_CURRENCY_INVALID"],
    );
  });

  it("rejects negative money amount", () => {
    const baseInput = createValidInput();
    const variant = requireFirstVariant(baseInput);

    expectValidationCodes(
      createValidInput({
        variants: [
          {
            ...variant,
            price: {
              amount: -1,
              currency: "USD",
            },
          },
        ],
      }),
      ["PRICE_AMOUNT_INVALID"],
    );
  });

  it("rejects compare-at price below selling price", () => {
    const baseInput = createValidInput();
    const variant = requireFirstVariant(baseInput);

    expectValidationCodes(
      createValidInput({
        variants: [
          {
            ...variant,
            compareAtPrice: {
              amount: 10,
              currency: "USD",
            },
          },
        ],
      }),
      ["COMPARE_AT_PRICE_BELOW_PRICE"],
    );
  });

  it("rejects insecure image URLs", () => {
    expectValidationCodes(
      createValidInput({
        images: [
          {
            url: "http://images.test/product.jpg",
            position: 1,
          },
        ],
      }),
      ["IMAGE_URL_INSECURE"],
    );
  });

  it("rejects invalid image position", () => {
    expectValidationCodes(
      createValidInput({
        images: [
          {
            url: "https://images.test/product.jpg",
            position: 0,
          },
        ],
      }),
      ["IMAGE_POSITION_INVALID"],
    );
  });

  it("rejects empty requestedBy", () => {
    expectValidationCodes(
      createValidInput({
        request: {
          requestedBy: " ",
          requestedAt: REQUESTED_AT,
        },
      }),
      ["REQUESTED_BY_REQUIRED"],
    );
  });

  it("collects multiple validation issues", () => {
    expectValidationCodes(
      createValidInput({
        title: " ",
        description: " ",
        variants: [],
        images: [
          {
            url: "http://images.test/product.jpg",
            position: 0,
          },
        ],
      }),
      ["TITLE_REQUIRED", "DESCRIPTION_REQUIRED", "VARIANTS_REQUIRED", "IMAGE_URL_INSECURE", "IMAGE_POSITION_INVALID"],
    );
  });

  it("does not mutate the input DTO", () => {
    const input = createValidInput();
    const originalTags = [...input.tags];
    const originalTargetMarkets = [...input.targetMarkets];
    const originalImageCount = input.images.length;

    createDraft(input);

    expect(input.tags).toEqual(originalTags);
    expect(input.targetMarkets).toEqual(originalTargetMarkets);
    expect(input.images).toHaveLength(originalImageCount);
    expect(input.title).toBe(" Test Product ");
  });
});
