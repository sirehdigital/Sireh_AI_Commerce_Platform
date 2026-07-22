import type {
  ProductDraftAiMetadata,
  ProductDraftBranding,
  ProductDraftMoney,
  ProductDraftOptionValue,
  ProductDraftRiskAssessment,
  ProductDraftSeo,
  ProductDraftShippingEstimate,
  ProductDraftSourceType,
} from "../../domain/models/product-draft.model.js";

export type CreateProductDraftWeightUnit = "g" | "kg" | "lb" | "oz";

export interface CreateProductDraftSourceReferenceDto {
  readonly sourceId: string;
  readonly sourceName?: string;
  readonly importedAt?: string;
}

export interface CreateProductDraftSupplierReferenceDto {
  readonly supplierId?: string;
  readonly supplierName?: string;
  readonly supplierProductId?: string;
  readonly marketplace?: string;
}

export interface CreateProductDraftImageDto {
  readonly url: string;
  readonly altText?: string;
  readonly position?: number;
}

export interface CreateProductDraftVariantDto {
  readonly sourceVariantId?: string;
  readonly title: string;
  readonly sku?: string;
  readonly price: ProductDraftMoney;
  readonly compareAtPrice?: ProductDraftMoney;
  readonly cost?: ProductDraftMoney;
  readonly barcode?: string;
  readonly inventoryQuantity?: number;
  readonly optionValues: readonly ProductDraftOptionValue[];
  readonly weight?: number;
  readonly weightUnit?: CreateProductDraftWeightUnit;
  readonly taxable?: boolean;
  readonly requiresShipping?: boolean;
}

export interface CreateProductDraftRequestMetadataDto {
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly correlationId?: string;
  readonly idempotencyKey?: string;
}

export interface CreateProductDraftDto {
  readonly sourceType: ProductDraftSourceType;
  readonly sourceReference: CreateProductDraftSourceReferenceDto;
  readonly supplier?: CreateProductDraftSupplierReferenceDto;
  readonly externalCorrelationId?: string;
  readonly title: string;
  readonly description: string;
  readonly vendor?: string;
  readonly productType?: string;
  readonly tags: readonly string[];
  readonly targetMarkets: readonly string[];
  readonly images: readonly CreateProductDraftImageDto[];
  readonly variants: readonly CreateProductDraftVariantDto[];
  readonly shippingEstimate?: ProductDraftShippingEstimate;
  readonly seo?: ProductDraftSeo;
  readonly branding?: ProductDraftBranding;
  readonly riskAssessment?: ProductDraftRiskAssessment;
  readonly ai?: ProductDraftAiMetadata;
  readonly request: CreateProductDraftRequestMetadataDto;
}
