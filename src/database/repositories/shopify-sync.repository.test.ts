import { describe, expect, it } from "vitest";
import {
  ShopifyProductSyncRepository,
  ShopifyStoreRepository,
  ShopifySyncRunRepository,
} from "./shopify-sync.repository.js";
import type { ShopifyProductSyncRecord, ShopifyStoreSyncRecord } from "../../integrations/shopify/shopify-sync.types.js";
import type { ShopifyShopDomain } from "../../integrations/shopify/shopify.types.js";

const TEST_SHOP: ShopifyShopDomain = "sirehshope.myshopify.com";

describe("Shopify sync repositories", () => {
  it("upserts a store profile by shop domain", async () => {
    const stores = new Map<string, ShopifyStoreSyncRecord>();
    const repository = new ShopifyStoreRepository({
      upsert: (args) => {
        stores.set(args.where.shopDomain, args.create);
        return Promise.resolve(args.create);
      },
      findMany: (args) =>
        Promise.resolve(
          [...stores.values()].filter((store) => store.shopDomain === args.where.shopDomain),
        ),
      count: (args) =>
        Promise.resolve(
          [...stores.values()].filter((store) => store.shopDomain === args.where.shopDomain).length,
        ),
      deleteMany: (args) => {
        const deleted = stores.delete(args.where.shopDomain);
        return Promise.resolve({ count: deleted ? 1 : 0 });
      },
    });

    await repository.upsert(buildStore("First name"));
    await repository.upsert(buildStore("Updated name"));

    await expect(repository.getByShop(TEST_SHOP)).resolves.toMatchObject([
      { name: "Updated name" },
    ]);
  });

  it("keeps product upsert idempotent for the same Shopify product ID", async () => {
    const products = new Map<string, ShopifyProductSyncRecord>();
    const repository = new ShopifyProductSyncRepository({
      upsert: (args) => {
        const key = JSON.stringify(args.where);
        products.set(key, args.create);
        return Promise.resolve(args.create);
      },
      findMany: (args) =>
        Promise.resolve(
          [...products.values()].filter((product) => product.shopDomain === args.where.shopDomain),
        ),
      count: (args) =>
        Promise.resolve(
          [...products.values()].filter((product) => product.shopDomain === args.where.shopDomain).length,
        ),
      deleteMany: (args) => {
        const before = products.size;
        for (const [key, product] of products.entries()) {
          if (product.shopDomain === args.where.shopDomain) {
            products.delete(key);
          }
        }
        return Promise.resolve({ count: before - products.size });
      },
    });

    await repository.upsertMany([buildProduct("First title")]);
    await repository.upsertMany([buildProduct("Updated title")]);

    await expect(repository.countByShop(TEST_SHOP)).resolves.toBe(1);
    await expect(repository.getByShop(TEST_SHOP)).resolves.toMatchObject([
      { title: "Updated title" },
    ]);
  });

  it("persists sync run status transitions", async () => {
    const runs: {
      id: string;
      shopDomain: ShopifyShopDomain;
      status: "running" | "completed" | "partial" | "failed";
      startedAt: Date;
      productsCount: number;
      collectionsCount: number;
      inventoryCount: number;
      locationsCount: number;
      ordersCount: number;
      customersCount: number;
    }[] = [];
    const repository = new ShopifySyncRunRepository({
      create: (args) => {
        const run = {
          id: "run-1",
          shopDomain: args.data.shopDomain,
          status: args.data.status,
          startedAt: args.data.startedAt,
          productsCount: 0,
          collectionsCount: 0,
          inventoryCount: 0,
          locationsCount: 0,
          ordersCount: 0,
          customersCount: 0,
        };
        runs.push(run);
        return Promise.resolve(run);
      },
      update: (args) => {
        const index = runs.findIndex((run) => run.id === args.where.id);
        const existing = runs[index];
        if (existing === undefined) {
          return Promise.reject(new Error("Run not found."));
        }
        const updated = {
          ...existing,
          ...args.data,
        };
        runs[index] = updated;
        return Promise.resolve(updated);
      },
      findFirst: (args) => {
        const run = runs.find(
          (item) =>
            item.shopDomain === args.where.shopDomain &&
            (args.where.status === undefined || item.status === args.where.status),
        );
        return Promise.resolve(run ?? null);
      },
      findMany: (args) =>
        Promise.resolve(runs.filter((run) => run.shopDomain === args.where.shopDomain)),
    });

    const run = await repository.createRunning(TEST_SHOP);
    await repository.complete(run.id, {
      status: "completed",
      productsCount: 2,
    });

    await expect(repository.hasRunningSync(TEST_SHOP)).resolves.toBe(false);
    await expect(repository.getLatest(TEST_SHOP)).resolves.toMatchObject({
      status: "completed",
      productsCount: 2,
    });
  });
});

function buildStore(name: string): ShopifyStoreSyncRecord {
  return {
    shopDomain: TEST_SHOP,
    name,
    email: "owner@example.com",
    currency: "USD",
    syncedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function buildProduct(title: string): ShopifyProductSyncRecord {
  return {
    shopDomain: TEST_SHOP,
    shopifyProductId: "gid-product-1",
    title,
    handle: "test-product",
    status: "active",
    tags: "",
    syncedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}
