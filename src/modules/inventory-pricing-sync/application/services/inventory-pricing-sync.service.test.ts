import { describe, expect, it } from "vitest";

import type { ShopifySessionRepository } from "../../../../database/repositories/shopify-session.repository.js";
import type { ShopifySession } from "../../../../integrations/shopify/shopify.types.js";
import { AppError } from "../../../../shared/errors/app-error.js";
import type { InventoryPricingSyncInput } from "../../domain/models/inventory-pricing-sync.model.js";
import { InventoryPricingSyncService } from "./inventory-pricing-sync.service.js";

const NOW = new Date("2026-07-18T11:00:00.000Z");
const SHOP = "sirehshope.myshopify.com";
const PRODUCT_ID = "gid://shopify/Product/1001";
const VARIANT_ID = "gid://shopify/ProductVariant/2001";
const INVENTORY_ITEM_ID = "gid://shopify/InventoryItem/3001";
const LOCATION_ID = "gid://shopify/Location/4001";

class FakeShopifySessionRepository implements ShopifySessionRepository {
  public session: ShopifySession | undefined = buildSession();

  public saveSession(session: ShopifySession): Promise<ShopifySession> {
    return Promise.resolve(session);
  }

  public getSession(): Promise<ShopifySession | undefined> {
    return Promise.resolve(this.session);
  }

  public deleteSession(): Promise<void> {
    return Promise.resolve();
  }

  public hasSession(): Promise<boolean> {
    return Promise.resolve(this.session !== undefined);
  }
}

class FakeShopifyClient {
  public readonly calls: { readonly query: string; readonly variables: Readonly<Record<string, unknown>> }[] = [];
  public error: Error | undefined;
  public priceUserErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[] = [];
  public inventoryUserErrors: readonly { readonly field: readonly string[] | null; readonly message: string }[] = [];

  public graphql<TData>(query: string, variables: Readonly<Record<string, unknown>>): Promise<TData> {
    this.calls.push({ query, variables });

    if (this.error !== undefined) {
      throw this.error;
    }

    if (query.includes("VariantInventoryForSync")) {
      return Promise.resolve({
        productVariant: {
          id: VARIANT_ID,
          inventoryItem: {
            id: INVENTORY_ITEM_ID,
            inventoryLevels: {
              nodes: [{ id: "gid://shopify/InventoryLevel/5001", location: { id: LOCATION_ID } }],
            },
          },
        },
      } as TData);
    }

    if (query.includes("UpdateVariantPriceForSync")) {
      return Promise.resolve({
        productVariantsBulkUpdate: {
          product: { id: PRODUCT_ID },
          productVariants: [{ id: VARIANT_ID, price: "30.00" }],
          userErrors: this.priceUserErrors,
        },
      } as TData);
    }

    return Promise.resolve({
      inventorySetQuantities: {
        inventoryAdjustmentGroup: { id: "gid://shopify/InventoryAdjustmentGroup/6001" },
        userErrors: this.inventoryUserErrors,
      },
    } as TData);
  }
}

const buildSession = (): ShopifySession => ({
  shop: SHOP,
  accessToken: "test-token",
  scope: ["write_products", "write_inventory"],
  apiVersion: "2026-01",
  installedAt: new Date("2026-07-18T09:00:00.000Z"),
  updatedAt: new Date("2026-07-18T09:30:00.000Z"),
});

const buildInput = (overrides: Partial<InventoryPricingSyncInput> = {}): InventoryPricingSyncInput => ({
  shop: SHOP,
  shopifyProductId: PRODUCT_ID,
  shopifyVariantId: VARIANT_ID,
  supplierPrice: 12,
  shippingCost: 3,
  currentInventoryQuantity: 14,
  targetMarginPercentage: 50,
  currency: "USD",
  ...overrides,
});

const createService = (
  repository = new FakeShopifySessionRepository(),
  client = new FakeShopifyClient(),
): { readonly service: InventoryPricingSyncService; readonly repository: FakeShopifySessionRepository; readonly client: FakeShopifyClient } => ({
  service: new InventoryPricingSyncService(repository, () => client, () => NOW),
  repository,
  client,
});

const priceVariables = (client: FakeShopifyClient): Readonly<Record<string, unknown>> => {
  const call = client.calls.find((entry) => entry.query.includes("UpdateVariantPriceForSync"));

  if (call === undefined) {
    throw new Error("Expected price update call.");
  }

  return call.variables;
};

const inventoryVariables = (client: FakeShopifyClient): Readonly<Record<string, unknown>> => {
  const call = client.calls.find((entry) => entry.query.includes("SetInventoryQuantityForSync"));

  if (call === undefined) {
    throw new Error("Expected inventory update call.");
  }

  return call.variables;
};

describe("InventoryPricingSyncService", () => {
  it("updates Shopify variant price and inventory quantity", async () => {
    const { service, client } = createService();

    await expect(service.sync(buildInput())).resolves.toMatchObject({
      shop: SHOP,
      productId: PRODUCT_ID,
      variantId: VARIANT_ID,
      price: { amount: 30, currency: "USD" },
      quantity: 14,
      status: "SYNCED",
    });

    expect(client.calls).toHaveLength(3);
    expect(priceVariables(client)).toMatchObject({
      productId: PRODUCT_ID,
      variants: [{ id: VARIANT_ID, price: "30.00" }],
    });
    expect(inventoryVariables(client)).toMatchObject({
      input: {
        name: "available",
        reason: "correction",
        quantities: [{ inventoryItemId: INVENTORY_ITEM_ID, locationId: LOCATION_ID, quantity: 14 }],
      },
    });
  });

  it("calculates selling price from target margin", async () => {
    const { service } = createService();

    const result = await service.sync(
      buildInput({
        supplierPrice: 10.015,
        shippingCost: 4.005,
        targetMarginPercentage: 30,
      }),
    );

    expect(result.pricing.totalCost.amount).toBe(14.03);
    expect(result.price.amount).toBe(20.04);
    expect(result.pricing.estimatedProfit.amount).toBe(6.01);
    expect(result.pricing.profitMarginPercentage).toBe(29.99);
  });

  it("uses fixed selling price when supplied", async () => {
    const { service, client } = createService();

    const result = await service.sync(
      buildInput({
        targetMarginPercentage: 80,
        fixedSellingPrice: 44.444,
      }),
    );

    expect(result.price.amount).toBe(44.44);
    expect(priceVariables(client)).toMatchObject({
      variants: [{ id: VARIANT_ID, price: "44.44" }],
    });
  });

  it("rejects invalid financial data", async () => {
    const { service, client } = createService();
    const invalidInputs: readonly InventoryPricingSyncInput[] = [
      buildInput({ supplierPrice: -1 }),
      buildInput({ shippingCost: Number.NaN }),
      buildInput({ targetMarginPercentage: 100 }),
      buildInput({ fixedSellingPrice: 10 }),
    ];

    for (const invalidInput of invalidInputs) {
      await expect(service.sync(invalidInput)).rejects.toBeInstanceOf(AppError);
    }

    expect(client.calls).toEqual([]);
  });

  it("rejects invalid inventory quantity", async () => {
    const { service, client } = createService();

    await expect(service.sync(buildInput({ currentInventoryQuantity: 1.5 }))).rejects.toMatchObject({
      code: "INVENTORY_QUANTITY_INVALID",
      statusCode: 400,
    });
    expect(client.calls).toEqual([]);
  });

  it("rejects missing Shopify sessions before calling Shopify", async () => {
    const { service, repository, client } = createService();
    repository.session = undefined;

    await expect(service.sync(buildInput())).rejects.toMatchObject({
      code: "SHOPIFY_SESSION_MISSING",
      statusCode: 401,
    });
    expect(client.calls).toEqual([]);
  });

  it("translates Shopify API and validation errors safely", async () => {
    const apiFailure = createService();
    apiFailure.client.error = AppError.unauthorized("Shopify Admin API token is invalid.", undefined, "UNAUTHORIZED");

    await expect(apiFailure.service.sync(buildInput())).rejects.toMatchObject({
      code: "SHOPIFY_SYNC_FAILED",
      statusCode: 500,
    });

    const validationFailure = createService();
    validationFailure.client.priceUserErrors = [{ field: ["variants", "0", "price"], message: "Invalid price." }];

    await expect(validationFailure.service.sync(buildInput())).rejects.toMatchObject({
      code: "SHOPIFY_SYNC_VALIDATION_FAILED",
      statusCode: 400,
    });
  });

  it("does not mutate input data", async () => {
    const { service } = createService();
    const input = buildInput({
      supplierPrice: 12.345,
      shippingCost: 2.115,
    });
    const snapshot = JSON.stringify(input);

    await service.sync(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
