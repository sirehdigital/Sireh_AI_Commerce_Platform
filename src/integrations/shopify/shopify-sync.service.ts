import type { Prisma } from "@prisma/client";
import { AppError } from "../../shared/errors/app-error.js";
import {
  shopifyCollectionSyncRepository,
  shopifyCustomerSyncRepository,
  shopifyInventorySyncRepository,
  shopifyLocationSyncRepository,
  shopifyOrderSyncRepository,
  shopifyProductSyncRepository,
  shopifyStoreRepository,
  shopifySyncRunRepository,
  type ShopifyCollectionSyncRepository,
  type ShopifyCustomerSyncRepository,
  type ShopifyInventorySyncRepository,
  type ShopifyLocationSyncRepository,
  type ShopifyOrderSyncRepository,
  type ShopifyProductSyncRepository,
  type ShopifyStoreRepository,
  type ShopifySyncRunRepository,
} from "../../database/repositories/shopify-sync.repository.js";
import { ShopifyClient } from "./shopify.client.js";
import { ShopifyConnectionValidationService } from "./shopify-connection-validation.service.js";
import type { ShopifyShopDomain } from "./shopify.types.js";
import type {
  ShopifyCollectionSyncRecord,
  ShopifyCustomerSyncRecord,
  ShopifyInventorySyncRecord,
  ShopifyLocationSyncRecord,
  ShopifyOrderSyncRecord,
  ShopifyProductSyncRecord,
  ShopifyStoreSyncRecord,
  ShopifySyncCounts,
  ShopifySyncRunRecord,
  ShopifySyncSummary,
} from "./shopify-sync.types.js";

interface ShopifySyncClient {
  getShop(): Promise<unknown>;
  getAllProducts(): Promise<unknown[]>;
  getCustomCollections(): Promise<unknown[]>;
  getSmartCollections(): Promise<unknown[]>;
  getInventoryLevels(): Promise<unknown[]>;
  getLocations(): Promise<unknown[]>;
  getAllOrders(): Promise<unknown[]>;
  getAllCustomers(): Promise<unknown[]>;
}

interface ShopifySyncRepositories {
  readonly stores: ShopifyStoreRepository;
  readonly products: ShopifyProductSyncRepository;
  readonly collections: ShopifyCollectionSyncRepository;
  readonly inventory: ShopifyInventorySyncRepository;
  readonly locations: ShopifyLocationSyncRepository;
  readonly orders: ShopifyOrderSyncRepository;
  readonly customers: ShopifyCustomerSyncRepository;
  readonly runs: ShopifySyncRunRepository;
}

type ShopifySyncClientFactory = (shop: ShopifyShopDomain) => Promise<ShopifySyncClient>;

interface MutableSyncCounts {
  products: number;
  collections: number;
  inventoryLevels: number;
  locations: number;
  orders: number;
  customers: number;
}

export class ShopifySyncService {
  public constructor(
    private readonly validationService = new ShopifyConnectionValidationService(),
    private readonly repositories: ShopifySyncRepositories = {
      stores: shopifyStoreRepository,
      products: shopifyProductSyncRepository,
      collections: shopifyCollectionSyncRepository,
      inventory: shopifyInventorySyncRepository,
      locations: shopifyLocationSyncRepository,
      orders: shopifyOrderSyncRepository,
      customers: shopifyCustomerSyncRepository,
      runs: shopifySyncRunRepository,
    },
    private readonly clientFactory: ShopifySyncClientFactory = (shop) => ShopifyClient.forShop(shop),
  ) {}

  public async sync(shopDomain: ShopifyShopDomain): Promise<ShopifySyncSummary> {
    const normalizedShop = this.normalizeShop(shopDomain);

    if (await this.repositories.runs.hasRunningSync(normalizedShop)) {
      throw AppError.conflict("Shopify sync is already running for this shop.", {
        shopDomain: normalizedShop,
      }, "SHOPIFY_SYNC_ALREADY_RUNNING");
    }

    const validation = await this.validationService.validate(normalizedShop);
    if (!validation.connected) {
      throw AppError.unauthorized("Shopify store is not connected or cannot be validated.", {
        shopDomain: normalizedShop,
      });
    }

    const startedAt = new Date();
    const run = await this.repositories.runs.createRunning(normalizedShop, startedAt);
    const client = await this.clientFactory(normalizedShop);
    const warnings: string[] = [];
    const counts: MutableSyncCounts = {
      products: 0,
      collections: 0,
      inventoryLevels: 0,
      locations: 0,
      orders: 0,
      customers: 0,
    };

    try {
      await this.syncStoreProfile(normalizedShop, client, startedAt);
      counts.locations = await this.syncLocations(normalizedShop, client, startedAt);
      counts.products = await this.syncProducts(normalizedShop, client, startedAt);
      counts.collections = await this.syncCollections(normalizedShop, client, startedAt);
      counts.inventoryLevels = await this.syncInventory(normalizedShop, client, startedAt);
      counts.orders = await this.syncOrders(normalizedShop, client, startedAt);
      counts.customers = await this.syncCustomers(normalizedShop, client, startedAt);

      return this.completeRun(run, startedAt, counts, warnings, "completed");
    } catch (error) {
      warnings.push(this.safeErrorMessage(error));

      if (this.hasAnyCount(counts)) {
        return this.completeRun(run, startedAt, counts, warnings, "partial");
      }

      await this.completeRun(run, startedAt, counts, warnings, "failed", error);
      throw error;
    }
  }

  public async getStatus(shopDomain: ShopifyShopDomain): Promise<ShopifySyncRunRecord | undefined> {
    return this.repositories.runs.getLatest(this.normalizeShop(shopDomain));
  }

  public async getSummary(shopDomain: ShopifyShopDomain): Promise<{
    readonly latestRun?: ShopifySyncRunRecord;
    readonly counts: ShopifySyncCounts;
  }> {
    const normalizedShop = this.normalizeShop(shopDomain);

    const latestRun = await this.repositories.runs.getLatest(normalizedShop);
    const summary = {
      counts: {
        products: await this.repositories.products.countByShop(normalizedShop),
        collections: await this.repositories.collections.countByShop(normalizedShop),
        inventoryLevels: await this.repositories.inventory.countByShop(normalizedShop),
        locations: await this.repositories.locations.countByShop(normalizedShop),
        orders: await this.repositories.orders.countByShop(normalizedShop),
        customers: await this.repositories.customers.countByShop(normalizedShop),
      },
    };

    return latestRun === undefined ? summary : { ...summary, latestRun };
  }

  private async syncStoreProfile(
    shopDomain: ShopifyShopDomain,
    client: ShopifySyncClient,
    syncedAt: Date,
  ): Promise<void> {
    await this.repositories.stores.upsert(this.toStoreRecord(shopDomain, await client.getShop(), syncedAt));
  }

  private async syncProducts(
    shopDomain: ShopifyShopDomain,
    client: ShopifySyncClient,
    syncedAt: Date,
  ): Promise<number> {
    const products = (await client.getAllProducts()).map((product) =>
      this.toProductRecord(shopDomain, product, syncedAt),
    );

    return this.repositories.products.upsertMany(products);
  }

  private async syncCollections(
    shopDomain: ShopifyShopDomain,
    client: ShopifySyncClient,
    syncedAt: Date,
  ): Promise<number> {
    const customCollections = (await client.getCustomCollections()).map((collection) =>
      this.toCollectionRecord(shopDomain, collection, "custom", syncedAt),
    );
    const smartCollections = (await client.getSmartCollections()).map((collection) =>
      this.toCollectionRecord(shopDomain, collection, "smart", syncedAt),
    );

    return this.repositories.collections.upsertMany([...customCollections, ...smartCollections]);
  }

  private async syncInventory(
    shopDomain: ShopifyShopDomain,
    client: ShopifySyncClient,
    syncedAt: Date,
  ): Promise<number> {
    const levels = (await client.getInventoryLevels()).map((level) =>
      this.toInventoryRecord(shopDomain, level, syncedAt),
    );

    return this.repositories.inventory.upsertMany(levels);
  }

  private async syncLocations(
    shopDomain: ShopifyShopDomain,
    client: ShopifySyncClient,
    syncedAt: Date,
  ): Promise<number> {
    const locations = (await client.getLocations()).map((location) =>
      this.toLocationRecord(shopDomain, location, syncedAt),
    );

    return this.repositories.locations.upsertMany(locations);
  }

  private async syncOrders(
    shopDomain: ShopifyShopDomain,
    client: ShopifySyncClient,
    syncedAt: Date,
  ): Promise<number> {
    const orders = (await client.getAllOrders()).map((order) =>
      this.toOrderRecord(shopDomain, order, syncedAt),
    );

    return this.repositories.orders.upsertMany(orders);
  }

  private async syncCustomers(
    shopDomain: ShopifyShopDomain,
    client: ShopifySyncClient,
    syncedAt: Date,
  ): Promise<number> {
    const customers = (await client.getAllCustomers()).map((customer) =>
      this.toCustomerRecord(shopDomain, customer, syncedAt),
    );

    return this.repositories.customers.upsertMany(customers);
  }

  private async completeRun(
    run: ShopifySyncRunRecord,
    startedAt: Date,
    counts: ShopifySyncCounts,
    warnings: readonly string[],
    status: "completed" | "partial" | "failed",
    error?: unknown,
  ): Promise<ShopifySyncSummary> {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await this.repositories.runs.complete(run.id, {
      status,
      completedAt,
      durationMs,
      productsCount: counts.products,
      collectionsCount: counts.collections,
      inventoryCount: counts.inventoryLevels,
      locationsCount: counts.locations,
      ordersCount: counts.orders,
      customersCount: counts.customers,
      warnings: [...warnings],
      ...(error === undefined
        ? {}
        : {
            errorCode: error instanceof AppError ? error.code : "SHOPIFY_SYNC_ERROR",
            errorMessage: this.safeErrorMessage(error),
          }),
    });

    return {
      shopDomain: run.shopDomain,
      status,
      startedAt,
      completedAt,
      durationMs,
      counts,
      warnings,
    };
  }

  private toStoreRecord(
    shopDomain: ShopifyShopDomain,
    payload: unknown,
    syncedAt: Date,
  ): ShopifyStoreSyncRecord {
    const shop = this.payloadObject(payload, "shop");

    return {
      shopDomain,
      name: this.stringValue(shop.name, shopDomain),
      email: this.optionalString(shop.email),
      currency: this.stringValue(shop.currency, "USD"),
      countryCode: this.optionalString(shop.country_code),
      timezone: this.optionalString(shop.iana_timezone ?? shop.timezone),
      planName: this.optionalString(shop.plan_name),
      primaryDomain: this.optionalString(shop.domain ?? shop.myshopify_domain),
      shopifyCreatedAt: this.optionalDate(shop.created_at),
      syncedAt,
    };
  }

  private toProductRecord(
    shopDomain: ShopifyShopDomain,
    payload: unknown,
    syncedAt: Date,
  ): ShopifyProductSyncRecord {
    const product = this.asRecord(payload);

    return {
      shopDomain,
      shopifyProductId: this.stringValue(product.id, "unknown-product"),
      title: this.stringValue(product.title, "Untitled product"),
      handle: this.stringValue(product.handle, ""),
      status: this.stringValue(product.status, "unknown"),
      vendor: this.optionalString(product.vendor),
      productType: this.optionalString(product.product_type),
      tags: this.stringValue(product.tags, ""),
      publishedAt: this.optionalDate(product.published_at),
      rawPayload: this.toJson(product),
      syncedAt,
    };
  }

  private toCollectionRecord(
    shopDomain: ShopifyShopDomain,
    payload: unknown,
    collectionType: string,
    syncedAt: Date,
  ): ShopifyCollectionSyncRecord {
    const collection = this.asRecord(payload);

    return {
      shopDomain,
      shopifyCollectionId: this.stringValue(collection.id, "unknown-collection"),
      title: this.stringValue(collection.title, "Untitled collection"),
      handle: this.stringValue(collection.handle, ""),
      collectionType,
      publishedAt: this.optionalDate(collection.published_at),
      rawPayload: this.toJson(collection),
      syncedAt,
    };
  }

  private toInventoryRecord(
    shopDomain: ShopifyShopDomain,
    payload: unknown,
    syncedAt: Date,
  ): ShopifyInventorySyncRecord {
    const level = this.asRecord(payload);

    return {
      shopDomain,
      inventoryItemId: this.stringValue(level.inventory_item_id, "unknown-inventory-item"),
      locationId: this.stringValue(level.location_id, "unknown-location"),
      available: this.optionalNumber(level.available),
      updatedAtSource: this.optionalDate(level.updated_at),
      syncedAt,
    };
  }

  private toLocationRecord(
    shopDomain: ShopifyShopDomain,
    payload: unknown,
    syncedAt: Date,
  ): ShopifyLocationSyncRecord {
    const location = this.asRecord(payload);

    return {
      shopDomain,
      shopifyLocationId: this.stringValue(location.id, "unknown-location"),
      name: this.stringValue(location.name, "Unnamed location"),
      active: this.booleanValue(location.active, false),
      countryCode: this.optionalString(location.country_code),
      provinceCode: this.optionalString(location.province_code),
      city: this.optionalString(location.city),
      address1: this.optionalString(location.address1),
      syncedAt,
    };
  }

  private toOrderRecord(
    shopDomain: ShopifyShopDomain,
    payload: unknown,
    syncedAt: Date,
  ): ShopifyOrderSyncRecord {
    const order = this.asRecord(payload);
    const customer = this.asRecordOrUndefined(order.customer);

    return {
      shopDomain,
      shopifyOrderId: this.stringValue(order.id, "unknown-order"),
      orderName: this.stringValue(order.name, "Unnamed order"),
      financialStatus: this.optionalString(order.financial_status),
      fulfillmentStatus: this.optionalString(order.fulfillment_status),
      currency: this.stringValue(order.currency, "USD"),
      totalPrice: this.stringValue(order.total_price, "0"),
      customerEmail: this.optionalString(order.email ?? customer?.email),
      processedAt: this.optionalDate(order.processed_at),
      rawPayload: this.toJson(order),
      syncedAt,
    };
  }

  private toCustomerRecord(
    shopDomain: ShopifyShopDomain,
    payload: unknown,
    syncedAt: Date,
  ): ShopifyCustomerSyncRecord {
    const customer = this.asRecord(payload);

    return {
      shopDomain,
      shopifyCustomerId: this.stringValue(customer.id, "unknown-customer"),
      email: this.optionalString(customer.email),
      firstName: this.optionalString(customer.first_name),
      lastName: this.optionalString(customer.last_name),
      ordersCount: this.numberValue(customer.orders_count, 0),
      totalSpent: this.stringValue(customer.total_spent, "0"),
      currency: this.optionalString(customer.currency),
      rawPayload: this.toJson(customer),
      syncedAt,
    };
  }

  private normalizeShop(shopDomain: ShopifyShopDomain): ShopifyShopDomain {
    return shopDomain.trim().toLowerCase() as ShopifyShopDomain;
  }

  private hasAnyCount(counts: ShopifySyncCounts): boolean {
    return Object.values(counts).some((count) => count > 0);
  }

  private safeErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Shopify sync failed.";
  }

  private payloadObject(payload: unknown, key: string): Record<string, unknown> {
    const record = this.asRecord(payload);
    return this.asRecord(record[key]);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  }

  private asRecordOrUndefined(value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
  }

  private stringValue(value: unknown, fallback: string): string {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "bigint") {
      return value.toString();
    }

    return fallback;
  }

  private optionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  }

  private numberValue(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  private optionalNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private booleanValue(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
  }

  private optionalDate(value: unknown): Date | null {
    if (typeof value !== "string" || value.trim().length === 0) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}

export const shopifySyncService = new ShopifySyncService();
