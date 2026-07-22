import type {
  AIProductRecord,
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCopy,
  ProductCurrency,
  ProductRiskAssessment,
  ProductSource,
  ProductVariant,
} from "../../../ai-product/types/product.types.js";
import type { ProductBrandingResult } from "../../../ai-product/services/product-branding.service.js";
import type { ProductPricingRecommendation } from "../../../ai-product/services/product-pricing.service.js";
import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";

export type ProductImportSourcePlatform = "autods" | "winninghunter" | "generic" | ProductSource;

export type ProductImportPipelineStatus =
  | "RECEIVED"
  | "NORMALIZED"
  | "ANALYZED"
  | "DRAFT_CREATED"
  | "PENDING_APPROVAL"
  | "FAILED";

export type ProductImportApprovalStatus = "PENDING_APPROVAL" | "NOT_CREATED";
export type ProductImportIdempotencyBehavior = "CREATED" | "REPLAYED_EXISTING" | "FORCED_REIMPORT";

export interface SupplierProductImportImageInput {
  readonly url: string;
  readonly altText?: string;
  readonly position?: number;
  readonly width?: number;
  readonly height?: number;
  readonly isPrimary?: boolean;
}

export interface SupplierProductImportVariantInput {
  readonly externalVariantId?: string;
  readonly sku?: string;
  readonly title?: string;
  readonly optionValues?: Readonly<Record<string, string>>;
  readonly supplierPrice?: number;
  readonly compareAtPrice?: number;
  readonly currency?: ProductCurrency;
  readonly inventory?: number;
  readonly weight?: number;
  readonly weightUnit?: ProductVariant["weightUnit"];
  readonly imageUrl?: string;
  readonly available?: boolean;
}

export interface SupplierProductImportDeliveryEstimate {
  readonly minDays?: number;
  readonly maxDays?: number;
}

export interface SupplierProductImportInput {
  readonly externalProductId: string;
  readonly sourcePlatform: ProductImportSourcePlatform;
  readonly supplierName?: string;
  readonly supplierUrl?: string;
  readonly title: string;
  readonly description?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly images: readonly SupplierProductImportImageInput[];
  readonly variants: readonly SupplierProductImportVariantInput[];
  readonly supplierPrice?: number;
  readonly compareAtPrice?: number;
  readonly currency: ProductCurrency;
  readonly inventory?: number;
  readonly shippingOrigin?: string;
  readonly shippingDestinations: readonly string[];
  readonly estimatedDelivery?: SupplierProductImportDeliveryEstimate;
  readonly tags: readonly string[];
  readonly rawMetadata: Readonly<Record<string, unknown>>;
}

export interface ProductImportFailureReason {
  readonly code: string;
  readonly message: string;
  readonly stage: ProductImportPipelineStatus;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ProductImportPipelineResult {
  readonly importId: string;
  readonly source: {
    readonly platform: ProductImportSourcePlatform;
    readonly externalProductId: string;
    readonly supplierName?: string;
  };
  readonly idempotencyKey: string;
  readonly idempotencyBehavior: ProductImportIdempotencyBehavior;
  readonly normalizedProduct?: NormalizedProduct;
  readonly riskResult?: ProductRiskAssessment;
  readonly analysisResult?: ProductAIAnalysis;
  readonly brandingResult?: ProductBrandingResult;
  readonly copyResult?: ProductCopy;
  readonly pricingResult?: ProductPricingRecommendation;
  readonly aiRecord?: AIProductRecord;
  readonly shopifyDraft?: ProductDraft;
  readonly approvalStatus: ProductImportApprovalStatus;
  readonly approvalId?: string;
  readonly warnings: readonly string[];
  readonly auditReference: string;
  readonly finalPipelineStatus: ProductImportPipelineStatus;
  readonly duplicate: boolean;
  readonly failureReason?: ProductImportFailureReason;
}

export interface ProductImportExecutionInput {
  readonly sourcePlatform: ProductImportSourcePlatform;
  readonly payload: unknown;
  readonly requestedBy: string;
  readonly tenantId?: string;
  readonly storeId?: string;
  readonly shopDomain?: `${string}.myshopify.com`;
  readonly correlationId?: string;
  readonly force?: boolean;
}
