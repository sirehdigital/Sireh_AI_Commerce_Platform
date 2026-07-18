import type {
  AutoDsProductStatus,
  AutoDsSynchronizationStatus,
} from "../../domain/models/autods-product.model.js";

export interface AutoDsMoneyDto {
  readonly amount: number;
  readonly currency: string;
}

export interface AutoDsSupplierReferenceDto {
  readonly supplierId: string;
  readonly supplierName: string;
  readonly supplierProductId: string;
  readonly supplierProductUrl: string;
  readonly marketplace: string;
  readonly countryCode?: string;
}

export interface AutoDsProductImageDto {
  readonly id?: string;
  readonly url: string;
  readonly altText?: string;
  readonly position: number;
}

export interface AutoDsProductOptionValueDto {
  readonly name: string;
  readonly value: string;
}

export interface AutoDsProductVariantDto {
  readonly id: string;
  readonly supplierVariantId: string;
  readonly sku?: string;
  readonly title: string;
  readonly options: readonly AutoDsProductOptionValueDto[];
  readonly supplierPrice: AutoDsMoneyDto;
  readonly recommendedRetailPrice?: AutoDsMoneyDto;
  readonly available: boolean;
  readonly inventoryQuantity?: number;
  readonly imageUrl?: string;
  readonly barcode?: string;
  readonly weightGrams?: number;
}

export interface AutoDsShippingEstimateDto {
  readonly destinationCountryCode: string;
  readonly methodName: string;
  readonly cost: AutoDsMoneyDto;
  readonly minimumDeliveryDays: number;
  readonly maximumDeliveryDays: number;
  readonly trackingAvailable: boolean;
}

export interface AutoDsProductSynchronizationDto {
  readonly status: AutoDsSynchronizationStatus;
  readonly lastSynchronizedAt?: string;
  readonly lastInventorySynchronizedAt?: string;
  readonly lastPriceSynchronizedAt?: string;
  readonly failureReason?: string;
}

// Application boundary DTO: mapping may assign internal IDs and timestamps later.
export interface AutoDsProductDto {
  readonly id?: string;
  readonly autoDsProductId: string;
  readonly title: string;
  readonly description?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly tags: readonly string[];
  readonly status: AutoDsProductStatus;
  readonly supplier: AutoDsSupplierReferenceDto;
  readonly images: readonly AutoDsProductImageDto[];
  readonly variants: readonly AutoDsProductVariantDto[];
  readonly shippingEstimates: readonly AutoDsShippingEstimateDto[];
  readonly synchronization?: AutoDsProductSynchronizationDto;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly importedAt?: string;
}

export interface ImportAutoDsProductDto {
  readonly product: AutoDsProductDto;
  readonly requestedBy?: string;
  readonly sourceReference?: string;
  readonly requestedAt?: string;
}

export interface FindAutoDsProductDto {
  readonly autoDsProductId?: string;
  readonly supplierProductId?: string;
}

export interface AutoDsProductImportResultDto {
  readonly productId: string;
  readonly autoDsProductId: string;
  readonly imported: boolean;
  readonly created: boolean;
  readonly updated: boolean;
  readonly importedAt: string;
}
