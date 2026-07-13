import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/prisma.client.js";
import type { ShopifyShopDomain } from "../../integrations/shopify/shopify.types.js";
import type {
  ShopifyCollectionSyncRecord,
  ShopifyCustomerSyncRecord,
  ShopifyInventorySyncRecord,
  ShopifyLocationSyncRecord,
  ShopifyOrderSyncRecord,
  ShopifyProductSyncRecord,
  ShopifyStoreSyncRecord,
  ShopifySyncRunRecord,
  ShopifySyncStatus,
} from "../../integrations/shopify/shopify-sync.types.js";

type WhereInput = Record<string, unknown>;

interface SyncDelegate<TCreate, TStored> {
  upsert(args: {
    readonly where: WhereInput;
    readonly create: TCreate;
    readonly update: Partial<TCreate>;
  }): Promise<TStored>;
  findMany(args: { readonly where: WhereInput; readonly orderBy?: WhereInput }): Promise<TStored[]>;
  count(args: { readonly where: WhereInput }): Promise<number>;
  deleteMany(args: { readonly where: WhereInput }): Promise<{ readonly count: number }>;
}

interface StoreDelegate {
  upsert(args: {
    readonly where: { readonly shopDomain: string };
    readonly create: ShopifyStoreSyncRecord;
    readonly update: Partial<ShopifyStoreSyncRecord>;
  }): Promise<ShopifyStoreSyncRecord>;
  findMany(args: { readonly where: { readonly shopDomain: string } }): Promise<ShopifyStoreSyncRecord[]>;
  count(args: { readonly where: { readonly shopDomain: string } }): Promise<number>;
  deleteMany(args: { readonly where: { readonly shopDomain: string } }): Promise<{ readonly count: number }>;
}

interface SyncRunCreateInput {
  readonly shopDomain: ShopifyShopDomain;
  readonly status: ShopifySyncStatus;
  readonly startedAt: Date;
}

interface SyncRunUpdateInput {
  readonly status: ShopifySyncStatus;
  readonly completedAt?: Date | null;
  readonly durationMs?: number | null;
  readonly productsCount?: number;
  readonly collectionsCount?: number;
  readonly inventoryCount?: number;
  readonly locationsCount?: number;
  readonly ordersCount?: number;
  readonly customersCount?: number;
  readonly warnings?: Prisma.InputJsonValue | null;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
}

interface SyncRunDelegate {
  create(args: { readonly data: SyncRunCreateInput }): Promise<ShopifySyncRunRecord>;
  update(args: {
    readonly where: { readonly id: string };
    readonly data: SyncRunUpdateInput;
  }): Promise<ShopifySyncRunRecord>;
  findFirst(args: { readonly where: WhereInput; readonly orderBy?: WhereInput }): Promise<ShopifySyncRunRecord | null>;
  findMany(args: { readonly where: WhereInput; readonly orderBy?: WhereInput; readonly take?: number }): Promise<ShopifySyncRunRecord[]>;
}

interface ShopifySyncPrismaClient {
  readonly shopifyStore: StoreDelegate;
  readonly shopifyProductSync: SyncDelegate<ShopifyProductSyncRecord, ShopifyProductSyncRecord>;
  readonly shopifyCollectionSync: SyncDelegate<ShopifyCollectionSyncRecord, ShopifyCollectionSyncRecord>;
  readonly shopifyInventorySync: SyncDelegate<ShopifyInventorySyncRecord, ShopifyInventorySyncRecord>;
  readonly shopifyLocationSync: SyncDelegate<ShopifyLocationSyncRecord, ShopifyLocationSyncRecord>;
  readonly shopifyOrderSync: SyncDelegate<ShopifyOrderSyncRecord, ShopifyOrderSyncRecord>;
  readonly shopifyCustomerSync: SyncDelegate<ShopifyCustomerSyncRecord, ShopifyCustomerSyncRecord>;
  readonly shopifySyncRun: SyncRunDelegate;
}

abstract class BaseSyncRepository<TRecord> {
  public constructor(protected readonly delegate: SyncDelegate<TRecord, TRecord>) {}

  public async getByShop(shopDomain: ShopifyShopDomain): Promise<TRecord[]> {
    return this.delegate.findMany({ where: { shopDomain } });
  }

  public async countByShop(shopDomain: ShopifyShopDomain): Promise<number> {
    return this.delegate.count({ where: { shopDomain } });
  }

  public async deleteByShop(shopDomain: ShopifyShopDomain): Promise<number> {
    const result = await this.delegate.deleteMany({ where: { shopDomain } });

    return result.count;
  }
}

export class ShopifyStoreRepository {
  public constructor(private readonly delegate: StoreDelegate) {}

  public async upsert(store: ShopifyStoreSyncRecord): Promise<ShopifyStoreSyncRecord> {
    return this.delegate.upsert({
      where: { shopDomain: store.shopDomain },
      create: store,
      update: store,
    });
  }

  public async getByShop(shopDomain: ShopifyShopDomain): Promise<ShopifyStoreSyncRecord[]> {
    return this.delegate.findMany({ where: { shopDomain } });
  }

  public async countByShop(shopDomain: ShopifyShopDomain): Promise<number> {
    return this.delegate.count({ where: { shopDomain } });
  }

  public async deleteByShop(shopDomain: ShopifyShopDomain): Promise<number> {
    const result = await this.delegate.deleteMany({ where: { shopDomain } });

    return result.count;
  }
}

export class ShopifyProductSyncRepository extends BaseSyncRepository<ShopifyProductSyncRecord> {
  public async upsertMany(products: readonly ShopifyProductSyncRecord[]): Promise<number> {
    for (const product of products) {
      await this.delegate.upsert({
        where: {
          shopDomain_shopifyProductId: {
            shopDomain: product.shopDomain,
            shopifyProductId: product.shopifyProductId,
          },
        },
        create: product,
        update: product,
      });
    }

    return products.length;
  }
}

export class ShopifyCollectionSyncRepository extends BaseSyncRepository<ShopifyCollectionSyncRecord> {
  public async upsertMany(collections: readonly ShopifyCollectionSyncRecord[]): Promise<number> {
    for (const collection of collections) {
      await this.delegate.upsert({
        where: {
          shopDomain_shopifyCollectionId: {
            shopDomain: collection.shopDomain,
            shopifyCollectionId: collection.shopifyCollectionId,
          },
        },
        create: collection,
        update: collection,
      });
    }

    return collections.length;
  }
}

export class ShopifyInventorySyncRepository extends BaseSyncRepository<ShopifyInventorySyncRecord> {
  public async upsertMany(levels: readonly ShopifyInventorySyncRecord[]): Promise<number> {
    for (const level of levels) {
      await this.delegate.upsert({
        where: {
          shopDomain_inventoryItemId_locationId: {
            shopDomain: level.shopDomain,
            inventoryItemId: level.inventoryItemId,
            locationId: level.locationId,
          },
        },
        create: level,
        update: level,
      });
    }

    return levels.length;
  }
}

export class ShopifyLocationSyncRepository extends BaseSyncRepository<ShopifyLocationSyncRecord> {
  public async upsertMany(locations: readonly ShopifyLocationSyncRecord[]): Promise<number> {
    for (const location of locations) {
      await this.delegate.upsert({
        where: {
          shopDomain_shopifyLocationId: {
            shopDomain: location.shopDomain,
            shopifyLocationId: location.shopifyLocationId,
          },
        },
        create: location,
        update: location,
      });
    }

    return locations.length;
  }
}

export class ShopifyOrderSyncRepository extends BaseSyncRepository<ShopifyOrderSyncRecord> {
  public async upsertMany(orders: readonly ShopifyOrderSyncRecord[]): Promise<number> {
    for (const order of orders) {
      await this.delegate.upsert({
        where: {
          shopDomain_shopifyOrderId: {
            shopDomain: order.shopDomain,
            shopifyOrderId: order.shopifyOrderId,
          },
        },
        create: order,
        update: order,
      });
    }

    return orders.length;
  }
}

export class ShopifyCustomerSyncRepository extends BaseSyncRepository<ShopifyCustomerSyncRecord> {
  public async upsertMany(customers: readonly ShopifyCustomerSyncRecord[]): Promise<number> {
    for (const customer of customers) {
      await this.delegate.upsert({
        where: {
          shopDomain_shopifyCustomerId: {
            shopDomain: customer.shopDomain,
            shopifyCustomerId: customer.shopifyCustomerId,
          },
        },
        create: customer,
        update: customer,
      });
    }

    return customers.length;
  }
}

export class ShopifySyncRunRepository {
  public constructor(private readonly delegate: SyncRunDelegate) {}

  public async createRunning(shopDomain: ShopifyShopDomain, startedAt = new Date()): Promise<ShopifySyncRunRecord> {
    return this.delegate.create({
      data: {
        shopDomain,
        status: "running",
        startedAt,
      },
    });
  }

  public async complete(
    runId: string,
    data: Omit<SyncRunUpdateInput, "status"> & { readonly status: "completed" | "partial" | "failed" },
  ): Promise<ShopifySyncRunRecord> {
    return this.delegate.update({
      where: { id: runId },
      data,
    });
  }

  public async hasRunningSync(shopDomain: ShopifyShopDomain): Promise<boolean> {
    const run = await this.delegate.findFirst({
      where: {
        shopDomain,
        status: "running",
      },
      orderBy: { startedAt: "desc" },
    });

    return run !== null;
  }

  public async getLatest(shopDomain: ShopifyShopDomain): Promise<ShopifySyncRunRecord | undefined> {
    const run = await this.delegate.findFirst({
      where: { shopDomain },
      orderBy: { startedAt: "desc" },
    });

    return run ?? undefined;
  }
}

const syncPrisma = prisma as unknown as ShopifySyncPrismaClient;

export const shopifyStoreRepository = new ShopifyStoreRepository(syncPrisma.shopifyStore);
export const shopifyProductSyncRepository = new ShopifyProductSyncRepository(
  syncPrisma.shopifyProductSync,
);
export const shopifyCollectionSyncRepository = new ShopifyCollectionSyncRepository(
  syncPrisma.shopifyCollectionSync,
);
export const shopifyInventorySyncRepository = new ShopifyInventorySyncRepository(
  syncPrisma.shopifyInventorySync,
);
export const shopifyLocationSyncRepository = new ShopifyLocationSyncRepository(
  syncPrisma.shopifyLocationSync,
);
export const shopifyOrderSyncRepository = new ShopifyOrderSyncRepository(syncPrisma.shopifyOrderSync);
export const shopifyCustomerSyncRepository = new ShopifyCustomerSyncRepository(
  syncPrisma.shopifyCustomerSync,
);
export const shopifySyncRunRepository = new ShopifySyncRunRepository(syncPrisma.shopifySyncRun);
