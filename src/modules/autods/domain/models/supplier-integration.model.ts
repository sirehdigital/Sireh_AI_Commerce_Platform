import type { SupplierProductImportInput } from "../../../product-import/domain/models/product-import.model.js";

export type SupplierProviderId = string;

export type SupplierConnectionStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "EXPIRED"
  | "INVALID"
  | "REVOKED"
  | "ERROR";

export type SupplierHealthStatus =
  | "ONLINE"
  | "DEGRADED"
  | "OFFLINE"
  | "RATE_LIMITED"
  | "AUTH_FAILED"
  | "UNKNOWN";

export type SupplierImportJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "retrying";

export type SupplierSyncJobStatus = SupplierImportJobStatus;
export type SupplierSyncType = "inventory" | "pricing" | "media" | "shipping" | "full";
export type SupplierCapability = "product_import" | "inventory_sync" | "pricing_sync" | "media_sync" | "shipping_sync";

export interface SupplierCredentialsReference {
  readonly referenceId: string;
  readonly provider: SupplierProviderId;
  readonly label?: string;
  readonly expiresAt?: string;
}

export interface SupplierProviderFailure {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly rateLimited?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface SupplierHealth {
  readonly status: SupplierHealthStatus;
  readonly checkedAt: string;
  readonly capabilities: readonly SupplierCapability[];
  readonly failure?: SupplierProviderFailure;
}

export interface AutoDSConnection {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly supplierProvider: SupplierProviderId;
  readonly status: SupplierConnectionStatus;
  readonly credentialsReference?: SupplierCredentialsReference;
  readonly capabilities: readonly SupplierCapability[];
  readonly health: SupplierHealth;
  readonly connectedAt?: string;
  readonly disconnectedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SupplierPricing {
  readonly currency: SupplierProductImportInput["currency"];
  readonly supplierPrice?: number;
  readonly compareAtPrice?: number;
}

export interface SupplierInventory {
  readonly available: boolean;
  readonly quantity?: number;
}

export interface SupplierShippingProfile {
  readonly origin?: string;
  readonly destinations: readonly string[];
  readonly estimatedDelivery?: SupplierProductImportInput["estimatedDelivery"];
}

export interface SupplierMediaReference {
  readonly url: string;
  readonly altText?: string;
  readonly position?: number;
  readonly providerReference?: string;
}

export interface SupplierVariant {
  readonly externalVariantId?: string;
  readonly sku?: string;
  readonly title?: string;
  readonly pricing: SupplierPricing;
  readonly inventory?: SupplierInventory;
  readonly imageUrl?: string;
  readonly optionValues?: Readonly<Record<string, string>>;
}

export interface SupplierProduct {
  readonly externalProductId: string;
  readonly sourcePlatform: SupplierProductImportInput["sourcePlatform"];
  readonly supplierName?: string;
  readonly supplierUrl?: string;
  readonly title: string;
  readonly description?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly media: readonly SupplierMediaReference[];
  readonly variants: readonly SupplierVariant[];
  readonly pricing: SupplierPricing;
  readonly inventory?: SupplierInventory;
  readonly shipping: SupplierShippingProfile;
  readonly tags: readonly string[];
  readonly rawMetadata: Readonly<Record<string, unknown>>;
}

export interface SupplierProviderResult<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly warnings: readonly string[];
  readonly failure?: SupplierProviderFailure;
}

export interface SupplierProductReference {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly supplierProvider: SupplierProviderId;
  readonly externalProductId: string;
  readonly title: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly inventorySnapshot?: SupplierInventory;
  readonly pricingSnapshot: SupplierPricing;
  readonly mediaReferences: readonly SupplierMediaReference[];
  readonly shippingProfile: SupplierShippingProfile;
  readonly rawPayload?: Readonly<Record<string, unknown>>;
  readonly lastSyncedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SupplierImportJob {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly supplierProvider: SupplierProviderId;
  readonly status: SupplierImportJobStatus;
  readonly idempotencyKey: string;
  readonly requestedBy: string;
  readonly force: boolean;
  readonly productReferenceIds: readonly string[];
  readonly productImportIds: readonly string[];
  readonly warnings: readonly string[];
  readonly failure?: SupplierProviderFailure;
  readonly auditReference?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface SupplierSyncJob {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly supplierProvider: SupplierProviderId;
  readonly syncType: SupplierSyncType;
  readonly status: SupplierSyncJobStatus;
  readonly idempotencyKey: string;
  readonly productReferenceIds: readonly string[];
  readonly warnings: readonly string[];
  readonly failure?: SupplierProviderFailure;
  readonly auditReference?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface SupplierImportRequest {
  readonly provider: SupplierProviderId;
  readonly requestedBy: string;
  readonly externalProductIds?: readonly string[];
  readonly force?: boolean;
  readonly correlationId?: string;
}

export interface SupplierSyncRequest {
  readonly provider: SupplierProviderId;
  readonly syncType: SupplierSyncType;
  readonly externalProductIds?: readonly string[];
  readonly force?: boolean;
  readonly correlationId?: string;
}
