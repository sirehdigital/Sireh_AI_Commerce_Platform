import { describe, expect, it } from "vitest";

import { AutoDsIntegrationService } from "./application/services/autods-integration.service.js";
import { AutoDsModule } from "./autods.module.js";
import type {
  AutoDsAuthenticationResult,
  AutoDsClient,
  AutoDsClientHealth,
  AutoDsProductCollectionResult,
} from "./domain/clients/autods.client.js";
import { AutoDsProductNotFoundError, AutoDsValidationError } from "./domain/errors/autods.errors.js";
import type { AutoDsProduct } from "./domain/models/autods-product.model.js";
import { InMemoryAutoDsRepository } from "./infrastructure/repositories/in-memory-autods.repository.js";
import type { AutoDsProductDto } from "./application/dtos/autods-product.dto.js";

const FIRST_TIMESTAMP = "2026-07-18T01:00:00.000Z";
const SECOND_TIMESTAMP = "2026-07-18T02:00:00.000Z";
const THIRD_TIMESTAMP = "2026-07-18T03:00:00.000Z";

class DeterministicAutoDsClient implements AutoDsClient {
  private readonly productsByAutoDsProductId = new Map<string, AutoDsProductDto>();
  private readonly healthResult: AutoDsClientHealth = {
    available: true,
    checkedAt: "2026-07-18T00:00:00.000Z",
    message: "deterministic-test-client",
  };

  public constructor(products: readonly AutoDsProductDto[] = []) {
    for (const product of products) {
      this.productsByAutoDsProductId.set(this.normalizeAutoDsProductId(product.autoDsProductId), product);
    }
  }

  public authenticate(): Promise<AutoDsAuthenticationResult> {
    return Promise.resolve({
      authenticated: true,
      authenticatedAt: "2026-07-18T00:00:00.000Z",
    });
  }

  public getProduct(autoDsProductId: string): Promise<AutoDsProductDto | undefined> {
    return Promise.resolve(this.productsByAutoDsProductId.get(this.normalizeAutoDsProductId(autoDsProductId)));
  }

  public searchProducts(): Promise<AutoDsProductCollectionResult> {
    return Promise.resolve({
      products: [...this.productsByAutoDsProductId.values()],
    });
  }

  public listProducts(): Promise<AutoDsProductCollectionResult> {
    return Promise.resolve({
      products: [...this.productsByAutoDsProductId.values()],
    });
  }

  public health(): Promise<AutoDsClientHealth> {
    return Promise.resolve(this.healthResult);
  }

  private normalizeAutoDsProductId(autoDsProductId: string): string {
    return autoDsProductId.trim().toLowerCase();
  }
}

const createClock = (timestamps: readonly string[]): (() => string) => {
  let index = 0;

  return (): string => {
    const fallbackTimestamp = timestamps[timestamps.length - 1];
    const timestamp = timestamps[index] ?? fallbackTimestamp;

    if (timestamp === undefined) {
      throw new Error("Test clock requires at least one timestamp.");
    }

    index += 1;

    return timestamp;
  };
};

interface ProductFixtureOptions {
  readonly autoDsProductId?: string;
  readonly supplierProductId?: string;
  readonly title?: string;
  readonly brand?: string;
  readonly tags?: readonly string[];
  readonly supplierPriceAmount?: number;
  readonly minimumDeliveryDays?: number;
  readonly maximumDeliveryDays?: number;
  readonly supplierId?: string;
  readonly createdAt?: string;
}

const buildProductDto = (options: ProductFixtureOptions = {}): AutoDsProductDto => {
  const autoDsProductId = options.autoDsProductId ?? "AUTODS-PRODUCT-001";
  const supplierProductId = options.supplierProductId ?? "SUPPLIER-PRODUCT-001";

  return {
    autoDsProductId,
    title: options.title ?? "Deterministic AutoDS Test Product",
    description: "Stable DTO fixture for AutoDS foundation tests.",
    brand: options.brand ?? "Sireh Test Brand",
    category: "Beauty Tools",
    productType: "Device",
    tags: options.tags ?? [" Beauty ", "beauty", "Device"],
    status: "active",
    supplier: {
      supplierId: options.supplierId ?? "supplier-001",
      supplierName: "Deterministic Supplier",
      supplierProductId,
      supplierProductUrl: `https://supplier.test/products/${supplierProductId}`,
      marketplace: "supplier-marketplace",
      countryCode: "US",
    },
    images: [
      {
        id: "image-001",
        url: `https://images.test/${autoDsProductId}.jpg`,
        altText: "Deterministic product image",
        position: 0,
      },
    ],
    variants: [
      {
        id: "variant-001",
        supplierVariantId: "supplier-variant-001",
        sku: "SKU-001",
        title: "Default Variant",
        options: [
          {
            name: "Color",
            value: "White",
          },
        ],
        supplierPrice: {
          amount: options.supplierPriceAmount ?? 12.5,
          currency: "USD",
        },
        recommendedRetailPrice: {
          amount: 29.99,
          currency: "USD",
        },
        available: true,
        inventoryQuantity: 12,
        imageUrl: `https://images.test/${autoDsProductId}-variant.jpg`,
        barcode: "0123456789012",
        weightGrams: 350,
      },
    ],
    shippingEstimates: [
      {
        destinationCountryCode: "US",
        methodName: "Standard",
        cost: {
          amount: 4.99,
          currency: "USD",
        },
        minimumDeliveryDays: options.minimumDeliveryDays ?? 3,
        maximumDeliveryDays: options.maximumDeliveryDays ?? 7,
        trackingAvailable: true,
      },
    ],
    synchronization: {
      status: "pending",
      failureReason: "Not synchronized in foundation tests.",
    },
    ...(options.createdAt === undefined ? {} : { createdAt: options.createdAt }),
  };
};

const composeService = (
  products: readonly AutoDsProductDto[] = [],
  timestamps: readonly string[] = [FIRST_TIMESTAMP],
): AutoDsIntegrationService =>
  AutoDsModule.create({
    client: new DeterministicAutoDsClient(products),
    now: createClock(timestamps),
  });

const requireDefined = <Value>(value: Value | undefined, message: string): Value => {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
};

describe("AutoDsModule composition", () => {
  it("creates an AutoDS integration service with an isolated default repository", async () => {
    const firstService = composeService([], [FIRST_TIMESTAMP]);
    const secondService = composeService([], [FIRST_TIMESTAMP]);

    expect(firstService).toBeInstanceOf(AutoDsIntegrationService);
    expect(secondService).toBeInstanceOf(AutoDsIntegrationService);

    await firstService.importProduct({ product: buildProductDto() });

    expect(await firstService.productExists("autods-product-001")).toBe(true);
    expect(await secondService.productExists("autods-product-001")).toBe(false);
  });

  it("imports a new product and supports normalized lookup after composition", async () => {
    const service = composeService([], [FIRST_TIMESTAMP]);
    const result = await service.importProduct({ product: buildProductDto() });

    expect(result).toEqual({
      productId: "autods:AUTODS-PRODUCT-001",
      autoDsProductId: "AUTODS-PRODUCT-001",
      imported: true,
      created: true,
      updated: false,
      importedAt: FIRST_TIMESTAMP,
    });

    const storedProduct = await service.requireProduct({ autoDsProductId: " autods-product-001 " });

    expect(storedProduct.id).toBe("autods:AUTODS-PRODUCT-001");
    expect(storedProduct.importedAt).toBe(FIRST_TIMESTAMP);
    expect(storedProduct.tags).toEqual(["Beauty", "Device"]);
  });

  it("replaces an existing product while preserving identity and unrelated products", async () => {
    const service = composeService([], [FIRST_TIMESTAMP, SECOND_TIMESTAMP, THIRD_TIMESTAMP]);

    await service.importProduct({
      product: buildProductDto({
        createdAt: "2026-07-17T12:00:00.000Z",
      }),
    });
    await service.importProduct({
      product: buildProductDto({
        autoDsProductId: "AUTODS-PRODUCT-002",
        supplierProductId: "SUPPLIER-PRODUCT-002",
        title: "Unrelated Product",
      }),
    });

    const replacementResult = await service.importProduct({
      product: buildProductDto({
        autoDsProductId: " autods-product-001 ",
        title: "Replacement Product Title",
        brand: "Replacement Brand",
        tags: ["Updated", "updated", "Launch"],
      }),
    });
    const replacedProduct = await service.requireProduct({ autoDsProductId: "AUTODS-PRODUCT-001" });
    const unrelatedProduct = await service.requireProduct({ autoDsProductId: "AUTODS-PRODUCT-002" });

    expect(replacementResult.created).toBe(false);
    expect(replacementResult.updated).toBe(true);
    expect(replacedProduct.id).toBe("autods:AUTODS-PRODUCT-001");
    expect(replacedProduct.createdAt).toBe("2026-07-17T12:00:00.000Z");
    expect(replacedProduct.updatedAt).toBe(THIRD_TIMESTAMP);
    expect(replacedProduct.importedAt).toBe(THIRD_TIMESTAMP);
    expect(replacedProduct.title).toBe("Replacement Product Title");
    expect(replacedProduct.brand).toBe("Replacement Brand");
    expect(replacedProduct.tags).toEqual(["Updated", "Launch"]);
    expect(unrelatedProduct.title).toBe("Unrelated Product");
  });

  it("fetches through the client and imports through the shared import flow", async () => {
    const fetchedProduct = buildProductDto({
      autoDsProductId: "FETCHED-PRODUCT-001",
      supplierProductId: "SUPPLIER-FETCHED-001",
    });
    const service = composeService([fetchedProduct], [FIRST_TIMESTAMP]);

    const result = await service.fetchAndImportProduct(" fetched-product-001 ");
    const storedProduct = await service.requireProduct({ autoDsProductId: "FETCHED-PRODUCT-001" });

    expect(result).toMatchObject({
      productId: "autods:FETCHED-PRODUCT-001",
      autoDsProductId: "FETCHED-PRODUCT-001",
      imported: true,
      created: true,
      updated: false,
      importedAt: FIRST_TIMESTAMP,
    });
    expect(storedProduct.title).toBe(fetchedProduct.title);
  });

  it("supports deterministic lookup priority and typed not-found errors", async () => {
    const service = composeService([], [FIRST_TIMESTAMP, SECOND_TIMESTAMP]);

    await service.importProduct({
      product: buildProductDto({
        autoDsProductId: "AUTODS-LOOKUP-001",
        supplierProductId: "SUPPLIER-LOOKUP-001",
        title: "AutoDS Priority Product",
      }),
    });
    await service.importProduct({
      product: buildProductDto({
        autoDsProductId: "AUTODS-LOOKUP-002",
        supplierProductId: "SUPPLIER-LOOKUP-002",
        title: "Supplier Lookup Product",
      }),
    });

    await expect(service.findProduct({})).rejects.toBeInstanceOf(AutoDsValidationError);
    await expect(service.requireProduct({ autoDsProductId: "missing-product" })).rejects.toBeInstanceOf(
      AutoDsProductNotFoundError,
    );

    await expect(service.findProduct({ autoDsProductId: "AUTODS-LOOKUP-001" })).resolves.toMatchObject({
      title: "AutoDS Priority Product",
    });
    await expect(service.findProduct({ supplierProductId: "SUPPLIER-LOOKUP-002" })).resolves.toMatchObject({
      title: "Supplier Lookup Product",
    });
    await expect(
      service.findProduct({
        autoDsProductId: "AUTODS-LOOKUP-001",
        supplierProductId: "SUPPLIER-LOOKUP-002",
      }),
    ).resolves.toMatchObject({
      title: "AutoDS Priority Product",
    });
  });

  it("lists products in repository order and does not expose stored mutable state", async () => {
    const service = composeService([], [FIRST_TIMESTAMP, SECOND_TIMESTAMP]);

    await service.importProduct({
      product: buildProductDto({
        autoDsProductId: "PRODUCT-B",
        supplierProductId: "SUPPLIER-B",
      }),
    });
    await service.importProduct({
      product: buildProductDto({
        autoDsProductId: "PRODUCT-A",
        supplierProductId: "SUPPLIER-A",
      }),
    });

    const products = await service.listProducts();
    const firstProduct = requireDefined(products[0], "Expected the first listed AutoDS product.");
    const firstImage = requireDefined(firstProduct.images[0], "Expected the first listed AutoDS product image.");
    const firstVariant = requireDefined(firstProduct.variants[0], "Expected the first listed AutoDS variant.");
    const firstShippingEstimate = requireDefined(
      firstProduct.shippingEstimates[0],
      "Expected the first listed AutoDS shipping estimate.",
    );
    const callerSideChangedProduct: AutoDsProduct = {
      ...firstProduct,
      tags: [...firstProduct.tags, "Caller Change"],
      supplier: {
        ...firstProduct.supplier,
        supplierName: "Caller Changed Supplier",
      },
      images: [
        {
          ...firstImage,
          url: "https://images.test/caller-change.jpg",
        },
      ],
      variants: [
        {
          ...firstVariant,
          supplierPrice: {
            amount: 0,
            currency: "USD",
          },
          options: [
            {
              name: "Caller",
              value: "Change",
            },
          ],
        },
      ],
      shippingEstimates: [
        {
          ...firstShippingEstimate,
          methodName: "Caller Changed Shipping",
        },
      ],
      synchronization: {
        ...firstProduct.synchronization,
        failureReason: "Caller changed synchronization",
      },
    };
    const productsAfterCallerSideChange = await service.listProducts();
    const firstProductAfterCallerSideChange = requireDefined(
      productsAfterCallerSideChange[0],
      "Expected the first AutoDS product after caller-side change.",
    );
    const firstImageAfterCallerSideChange = requireDefined(
      firstProductAfterCallerSideChange.images[0],
      "Expected the first AutoDS product image after caller-side change.",
    );
    const firstVariantAfterCallerSideChange = requireDefined(
      firstProductAfterCallerSideChange.variants[0],
      "Expected the first AutoDS variant after caller-side change.",
    );
    const firstShippingEstimateAfterCallerSideChange = requireDefined(
      firstProductAfterCallerSideChange.shippingEstimates[0],
      "Expected the first AutoDS shipping estimate after caller-side change.",
    );

    expect(products.map((product) => product.autoDsProductId)).toEqual(["PRODUCT-A", "PRODUCT-B"]);
    expect(callerSideChangedProduct.tags).toContain("Caller Change");
    expect(firstProductAfterCallerSideChange.tags).not.toContain("Caller Change");
    expect(firstProductAfterCallerSideChange.supplier.supplierName).toBe("Deterministic Supplier");
    expect(firstImageAfterCallerSideChange.url).toBe("https://images.test/PRODUCT-A.jpg");
    expect(firstVariantAfterCallerSideChange.supplierPrice.amount).toBe(12.5);
    expect(firstVariantAfterCallerSideChange.options).toEqual([{ name: "Color", value: "White" }]);
    expect(firstShippingEstimateAfterCallerSideChange.methodName).toBe("Standard");
    expect(firstProductAfterCallerSideChange.synchronization.failureReason).toBe(
      "Not synchronized in foundation tests.",
    );
  });

  it("checks product existence with normalized identifiers", async () => {
    const service = composeService([], [FIRST_TIMESTAMP]);

    expect(await service.productExists("AUTODS-PRODUCT-001")).toBe(false);

    await service.importProduct({ product: buildProductDto() });

    expect(await service.productExists(" autods-product-001 ")).toBe(true);
  });

  it("deletes only the matching product and keeps deletion idempotent", async () => {
    const service = composeService([], [FIRST_TIMESTAMP, SECOND_TIMESTAMP]);

    await service.importProduct({ product: buildProductDto() });
    await service.importProduct({
      product: buildProductDto({
        autoDsProductId: "AUTODS-PRODUCT-002",
        supplierProductId: "SUPPLIER-PRODUCT-002",
      }),
    });

    await service.deleteProduct(" autods-product-001 ");
    await service.deleteProduct("AUTODS-PRODUCT-001");

    expect(await service.productExists("AUTODS-PRODUCT-001")).toBe(false);
    expect(await service.productExists("AUTODS-PRODUCT-002")).toBe(true);
  });

  it("rejects invalid imports without storing partial products", async () => {
    const invalidProducts: readonly AutoDsProductDto[] = [
      buildProductDto({ autoDsProductId: " " }),
      buildProductDto({ title: " " }),
      buildProductDto({ supplierPriceAmount: -1 }),
      buildProductDto({ minimumDeliveryDays: 8, maximumDeliveryDays: 2 }),
      buildProductDto({ supplierId: " " }),
    ];

    for (const invalidProduct of invalidProducts) {
      const service = composeService([], [FIRST_TIMESTAMP]);

      await expect(service.importProduct({ product: invalidProduct })).rejects.toBeInstanceOf(AutoDsValidationError);
      await expect(service.listProducts()).resolves.toEqual([]);
    }
  });

  it("throws a typed not-found error when the client has no matching product", async () => {
    const service = composeService([], [FIRST_TIMESTAMP]);

    await expect(service.fetchAndImportProduct("missing-product")).rejects.toBeInstanceOf(
      AutoDsProductNotFoundError,
    );
    await expect(service.listProducts()).resolves.toEqual([]);
  });

  it("delegates health to the supplied client without transformation", async () => {
    const service = composeService();

    await expect(service.health()).resolves.toEqual({
      available: true,
      checkedAt: "2026-07-18T00:00:00.000Z",
      message: "deterministic-test-client",
    });
  });

  it("uses an injected repository instance when supplied", async () => {
    const repository = new InMemoryAutoDsRepository();
    const service = AutoDsModule.create({
      client: new DeterministicAutoDsClient(),
      repository,
      now: createClock([FIRST_TIMESTAMP]),
    });

    await service.importProduct({ product: buildProductDto() });

    await expect(repository.findByAutoDsProductId("autods-product-001")).resolves.toMatchObject({
      title: "Deterministic AutoDS Test Product",
    });
    expect(await repository.exists("AUTODS-PRODUCT-001")).toBe(true);
  });
});
