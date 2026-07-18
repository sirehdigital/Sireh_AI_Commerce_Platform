export interface AutoDsMoney {
  readonly amount: number;
  readonly currency: string;
}

export type AutoDsProductStatus =
  | "active"
  | "inactive"
  | "out_of_stock"
  | "discontinued"
  | "draft"
  | "unknown";

export type AutoDsSynchronizationStatus =
  | "pending"
  | "synchronized"
  | "partially_synchronized"
  | "failed"
  | "paused";

export interface AutoDsSupplierReference {
  readonly supplierId: string;
  readonly supplierName: string;
  // Identifies the original supplier listing, distinct from SACP and Shopify identifiers.
  readonly supplierProductId: string;
  readonly supplierProductUrl: string;
  readonly marketplace: string;
  readonly countryCode?: string;
}

export interface AutoDsProductImage {
  readonly id?: string;
  readonly url: string;
  readonly altText?: string;
  readonly position: number;
}

export interface AutoDsProductOptionValue {
  readonly name: string;
  readonly value: string;
}

export interface AutoDsProductVariant {
  readonly id: string;
  readonly supplierVariantId: string;
  readonly sku?: string;
  readonly title: string;
  readonly options: readonly AutoDsProductOptionValue[];
  // Supplier cost and recommended retail price must remain separate.
  readonly supplierPrice: AutoDsMoney;
  readonly recommendedRetailPrice?: AutoDsMoney;
  // Availability is required because exact inventory may be unknown.
  readonly available: boolean;
  readonly inventoryQuantity?: number;
  readonly imageUrl?: string;
  readonly barcode?: string;
  readonly weightGrams?: number;
}

export interface AutoDsShippingEstimate {
  readonly destinationCountryCode: string;
  readonly methodName: string;
  readonly cost: AutoDsMoney;
  readonly minimumDeliveryDays: number;
  readonly maximumDeliveryDays: number;
  readonly trackingAvailable: boolean;
}

export interface AutoDsProductSynchronization {
  readonly status: AutoDsSynchronizationStatus;
  readonly lastSynchronizedAt?: string;
  readonly lastInventorySynchronizedAt?: string;
  readonly lastPriceSynchronizedAt?: string;
  readonly failureReason?: string;
}

// Domain-only model: no access tokens, credentials, or raw AutoDS API payloads.
export interface AutoDsProduct {
  // Internal SACP AutoDS-domain identifier.
  readonly id: string;
  // Identifier assigned by AutoDS.
  readonly autoDsProductId: string;
  readonly title: string;
  readonly description?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly tags: readonly string[];
  readonly status: AutoDsProductStatus;
  readonly supplier: AutoDsSupplierReference;
  readonly images: readonly AutoDsProductImage[];
  readonly variants: readonly AutoDsProductVariant[];
  readonly shippingEstimates: readonly AutoDsShippingEstimate[];
  readonly synchronization: AutoDsProductSynchronization;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly importedAt?: string;
}
