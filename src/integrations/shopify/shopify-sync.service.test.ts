import { describe, expect, it } from "vitest";
import {
  ShopifyCollectionSyncRepository,
  ShopifyCustomerSyncRepository,
  ShopifyInventorySyncRepository,
  ShopifyLocationSyncRepository,
  ShopifyOrderSyncRepository,
  ShopifyProductSyncRepository,
  ShopifyStoreRepository,
  ShopifySyncRunRepository,
} from "../../database/repositories/shopify-sync.repository.js";
import type { ShopifySessionRepository } from "../../database/repositories/shopify-session.repository.js";
import { AppError } from "../../shared/errors/app-error.js";
import { ShopifyConnectionValidationService } from "./shopify-connection-validation.service.js";
import { shopifyConfig } from "./shopify.config.js";
import { ShopifySyncService } from "./shopify-sync.service.js";
import type { ShopifyShopDomain } from "./shopify.types.js";
import type {
  ShopifyCollectionSyncRecord,
  ShopifyCustomerSyncRecord,
  ShopifyInventorySyncRecord,
  ShopifyLocationSyncRecord,
  ShopifyOrderSyncRecord,
  ShopifyProductSyncRecord,
  ShopifyStoreSyncRecord,
  ShopifySyncRunRecord,
} from "./shopify-sync.types.js";

const TEST_SHOP: ShopifyShopDomain = "sirehshope.myshopify.com";

describe("ShopifySyncService", () => {
  it("prevents duplicate syncs for the same shop", async () => {
    const service = new ShopifySyncService(
      createValidationService(),
      createRepositories({ running: true }),
      () => Promise.resolve(createClient()),
    );

    await expect(service.sync(TEST_SHOP)).rejects.toMatchObject({
      code: "SHOPIFY_SYNC_ALREADY_RUNNING",
      statusCode: 409,
    });
  });

  it("returns a completed sync summary", async () => {
    const service = new ShopifySyncService(
      createValidationService(),
      createRepositories(),
      () =>
        Promise.resolve(
          createClient({
            products: [{ id: 1, title: "Test product", handle: "test-product" }],
            customers: [{ id: 2, email: "buyer@example.com" }],
          }),
        ),
    );

    await expect(service.sync(TEST_SHOP)).resolves.toMatchObject({
      shopDomain: TEST_SHOP,
      status: "completed",
      counts: {
        products: 1,
        customers: 1,
      },
    });
  });

  it("records partial sync results when a later sync step fails", async () => {
    const service = new ShopifySyncService(
      createValidationService(),
      createRepositories(),
      () =>
        Promise.resolve(
          createClient({
            products: [{ id: 1, title: "Test product", handle: "test-product" }],
            customCollectionsError: new Error("Collections failed"),
          }),
        ),
    );

    await expect(service.sync(TEST_SHOP)).resolves.toMatchObject({
      status: "partial",
      counts: {
        products: 1,
      },
    });
  });

  it("returns completed sync summary counts from repositories", async () => {
    const repositories = createRepositories();
    const service = new ShopifySyncService(
      createValidationService(),
      repositories,
      () =>
        Promise.resolve(
          createClient({
            products: [{ id: 1, title: "Test product", handle: "test-product" }],
          }),
        ),
    );

    await service.sync(TEST_SHOP);

    await expect(service.getSummary(TEST_SHOP)).resolves.toMatchObject({
      counts: {
        products: 1,
      },
      latestRun: {
        status: "completed",
      },
    });
  });
});

function createValidationService(): ShopifyConnectionValidationService {
  return new ShopifyConnectionValidationService(
    new SessionRepository(),
    () =>
      Promise.resolve({
        getShop: () =>
          Promise.resolve({
            shop: { myshopify_domain: TEST_SHOP },
          }),
      }),
  );
}

class SessionRepository implements ShopifySessionRepository {
  public saveSession(): Promise<never> {
    return Promise.reject(new Error("Not used."));
  }

  public getSession(): Promise<{
    shop: ShopifyShopDomain;
    accessToken: string;
    scope: readonly string[];
    apiVersion: "2025-01";
    installedAt: Date;
    updatedAt: Date;
  }> {
    return Promise.resolve({
      shop: TEST_SHOP,
      accessToken: "test-access-token",
      scope: shopifyConfig.scopes.split(",").map((scope) => scope.trim()),
      apiVersion: "2025-01",
      installedAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
  }

  public deleteSession(): Promise<void> {
    return Promise.resolve();
  }

  public hasSession(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

function createClient(options: {
  readonly products?: readonly unknown[];
  readonly customers?: readonly unknown[];
  readonly customCollectionsError?: Error;
} = {}) {
  return {
    getShop: () =>
      Promise.resolve({
        shop: {
          name: "Sireh Shope",
          myshopify_domain: TEST_SHOP,
          currency: "USD",
        },
      }),
    getAllProducts: () => Promise.resolve([...(options.products ?? [])]),
    getCustomCollections: () =>
      options.customCollectionsError === undefined
        ? Promise.resolve([])
        : Promise.reject(options.customCollectionsError),
    getSmartCollections: () => Promise.resolve([]),
    getInventoryLevels: () => Promise.resolve([]),
    getLocations: () => Promise.resolve([]),
    getAllOrders: () => Promise.resolve([]),
    getAllCustomers: () => Promise.resolve([...(options.customers ?? [])]),
  };
}

function createRepositories(options: { readonly running?: boolean } = {}) {
  const runs: ShopifySyncRunRecord[] = [];

  return {
    stores: new ShopifyStoreRepository(createStoreDelegate()),
    products: new ShopifyProductSyncRepository(createEntityDelegate<ShopifyProductSyncRecord>()),
    collections: new ShopifyCollectionSyncRepository(
      createEntityDelegate<ShopifyCollectionSyncRecord>(),
    ),
    inventory: new ShopifyInventorySyncRepository(
      createEntityDelegate<ShopifyInventorySyncRecord>(),
    ),
    locations: new ShopifyLocationSyncRepository(createEntityDelegate<ShopifyLocationSyncRecord>()),
    orders: new ShopifyOrderSyncRepository(createEntityDelegate<ShopifyOrderSyncRecord>()),
    customers: new ShopifyCustomerSyncRepository(createEntityDelegate<ShopifyCustomerSyncRecord>()),
    runs: new ShopifySyncRunRepository({
      create: (args) => {
        const run: ShopifySyncRunRecord = {
          id: `run-${runs.length + 1}`,
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
        if (index < 0) {
          return Promise.reject(AppError.notFound("Sync run not found."));
        }
        const existing = runs[index];
        if (existing === undefined) {
          return Promise.reject(AppError.notFound("Sync run not found."));
        }
        const updated: ShopifySyncRunRecord = {
          ...existing,
          ...args.data,
        };
        runs[index] = updated;
        return Promise.resolve(updated);
      },
      findFirst: (args) => {
        if (options.running === true && args.where.status === "running") {
          return Promise.resolve({
            id: "running-run",
            shopDomain: TEST_SHOP,
            status: "running",
            startedAt: new Date("2026-01-01T00:00:00.000Z"),
            productsCount: 0,
            collectionsCount: 0,
            inventoryCount: 0,
            locationsCount: 0,
            ordersCount: 0,
            customersCount: 0,
          });
        }
        const run = runs.find((item) => item.shopDomain === args.where.shopDomain);
        return Promise.resolve(run ?? null);
      },
      findMany: (args) =>
        Promise.resolve(runs.filter((run) => run.shopDomain === args.where.shopDomain)),
    }),
  };
}

function createStoreDelegate() {
  const stores = new Map<string, ShopifyStoreSyncRecord>();

  return {
    upsert: (args: {
      readonly where: { readonly shopDomain: string };
      readonly create: ShopifyStoreSyncRecord;
    }) => {
      stores.set(args.where.shopDomain, args.create);
      return Promise.resolve(args.create);
    },
    findMany: (args: { readonly where: { readonly shopDomain: string } }) =>
      Promise.resolve(
        [...stores.values()].filter((store) => store.shopDomain === args.where.shopDomain),
      ),
    count: (args: { readonly where: { readonly shopDomain: string } }) =>
      Promise.resolve(
        [...stores.values()].filter((store) => store.shopDomain === args.where.shopDomain).length,
      ),
    deleteMany: (args: { readonly where: { readonly shopDomain: string } }) => {
      const deleted = stores.delete(args.where.shopDomain);
      return Promise.resolve({ count: deleted ? 1 : 0 });
    },
  };
}

function createEntityDelegate<TRecord extends { readonly shopDomain: ShopifyShopDomain }>() {
  const records = new Map<string, TRecord>();

  return {
    upsert: (args: {
      readonly where: Record<string, unknown>;
      readonly create: TRecord;
    }) => {
      const key = JSON.stringify(args.where);
      records.set(key, args.create);
      return Promise.resolve(args.create);
    },
    findMany: (args: { readonly where: Record<string, unknown> }) =>
      Promise.resolve(
        [...records.values()].filter((record) => record.shopDomain === args.where.shopDomain),
      ),
    count: (args: { readonly where: Record<string, unknown> }) =>
      Promise.resolve(
        [...records.values()].filter((record) => record.shopDomain === args.where.shopDomain)
          .length,
      ),
    deleteMany: (args: { readonly where: Record<string, unknown> }) => {
      const before = records.size;
      for (const [key, record] of records.entries()) {
        if (record.shopDomain === args.where.shopDomain) {
          records.delete(key);
        }
      }
      return Promise.resolve({ count: before - records.size });
    },
  };
}
