import type { Prisma } from "@prisma/client";
import type { ShopifyShopDomain } from "./shopify.types.js";

export type ShopifySyncStatus = "running" | "completed" | "partial" | "failed";

export interface ShopifyConnectionValidationResult {
  readonly shopDomain: ShopifyShopDomain;
  readonly connected: boolean;
  readonly apiReachable: boolean;
  readonly tokenValid: boolean;
  readonly requiredScopesPresent: boolean;
  readonly missingScopes: readonly string[];
  readonly validatedAt: Date;
}

export interface ShopifyStoreSyncRecord {
  readonly shopDomain: ShopifyShopDomain;
  readonly name: string;
  readonly email?: string | null;
  readonly currency: string;
  readonly countryCode?: string | null;
  readonly timezone?: string | null;
  readonly planName?: string | null;
  readonly primaryDomain?: string | null;
  readonly shopifyCreatedAt?: Date | null;
  readonly syncedAt: Date;
}

export interface ShopifyProductSyncRecord {
  readonly shopDomain: ShopifyShopDomain;
  readonly shopifyProductId: string;
  readonly title: string;
  readonly handle: string;
  readonly status: string;
  readonly vendor?: string | null;
  readonly productType?: string | null;
  readonly tags: string;
  readonly publishedAt?: Date | null;
  readonly rawPayload?: Prisma.InputJsonValue;
  readonly syncedAt: Date;
}

export interface ShopifyCollectionSyncRecord {
  readonly shopDomain: ShopifyShopDomain;
  readonly shopifyCollectionId: string;
  readonly title: string;
  readonly handle: string;
  readonly collectionType: string;
  readonly publishedAt?: Date | null;
  readonly rawPayload?: Prisma.InputJsonValue;
  readonly syncedAt: Date;
}

export interface ShopifyInventorySyncRecord {
  readonly shopDomain: ShopifyShopDomain;
  readonly inventoryItemId: string;
  readonly locationId: string;
  readonly available?: number | null;
  readonly updatedAtSource?: Date | null;
  readonly syncedAt: Date;
}

export interface ShopifyLocationSyncRecord {
  readonly shopDomain: ShopifyShopDomain;
  readonly shopifyLocationId: string;
  readonly name: string;
  readonly active: boolean;
  readonly countryCode?: string | null;
  readonly provinceCode?: string | null;
  readonly city?: string | null;
  readonly address1?: string | null;
  readonly syncedAt: Date;
}

export interface ShopifyOrderSyncRecord {
  readonly shopDomain: ShopifyShopDomain;
  readonly shopifyOrderId: string;
  readonly orderName: string;
  readonly financialStatus?: string | null;
  readonly fulfillmentStatus?: string | null;
  readonly currency: string;
  readonly totalPrice: string;
  readonly customerEmail?: string | null;
  readonly processedAt?: Date | null;
  readonly rawPayload?: Prisma.InputJsonValue;
  readonly syncedAt: Date;
}

export interface ShopifyCustomerSyncRecord {
  readonly shopDomain: ShopifyShopDomain;
  readonly shopifyCustomerId: string;
  readonly email?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly ordersCount: number;
  readonly totalSpent: string;
  readonly currency?: string | null;
  readonly rawPayload?: Prisma.InputJsonValue;
  readonly syncedAt: Date;
}

export interface ShopifySyncRunRecord {
  readonly id: string;
  readonly shopDomain: ShopifyShopDomain;
  readonly status: ShopifySyncStatus;
  readonly startedAt: Date;
  readonly completedAt?: Date | null;
  readonly durationMs?: number | null;
  readonly productsCount: number;
  readonly collectionsCount: number;
  readonly inventoryCount: number;
  readonly locationsCount: number;
  readonly ordersCount: number;
  readonly customersCount: number;
  readonly warnings?: Prisma.InputJsonValue | null;
  readonly errorCode?: string | null;
  readonly errorMessage?: string | null;
}

export interface ShopifySyncCounts {
  readonly products: number;
  readonly collections: number;
  readonly inventoryLevels: number;
  readonly locations: number;
  readonly orders: number;
  readonly customers: number;
}

export interface ShopifySyncSummary {
  readonly shopDomain: ShopifyShopDomain;
  readonly status: "completed" | "partial" | "failed";
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
  readonly counts: ShopifySyncCounts;
  readonly warnings: readonly string[];
}
