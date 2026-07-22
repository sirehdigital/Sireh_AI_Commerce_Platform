export type ProductDraftSourceType = "manual" | "autods" | "supplier" | "ai" | "import" | "migration";

export type ProductDraftStatus =
  | "draft"
  | "enrichment_pending"
  | "enriching"
  | "review_pending"
  | "changes_requested"
  | "approved"
  | "rejected"
  | "publishing"
  | "published"
  | "failed"
  | "archived";

export type ProductDraftRiskLevel = "unknown" | "low" | "medium" | "high" | "critical";

export interface ProductDraftMoney {
  readonly amount: number;
  readonly currency: string;
}

export interface ProductDraftSourceReference {
  readonly sourceType: ProductDraftSourceType;
  readonly sourceId: string;
  readonly supplierId?: string;
  readonly supplierProductId?: string;
  readonly importedAt: string;
}

export interface ProductDraftImage {
  readonly id?: string;
  readonly sourceUrl: string;
  readonly altText?: string;
  readonly position: number;
  readonly width?: number;
  readonly height?: number;
  readonly selected: boolean;
  readonly primary: boolean;
}

export interface ProductDraftOptionValue {
  readonly name: string;
  readonly value: string;
}

export interface ProductDraftVariant {
  readonly id: string;
  readonly sourceVariantId?: string;
  readonly title: string;
  readonly sku?: string;
  readonly barcode?: string;
  readonly options: readonly ProductDraftOptionValue[];
  readonly supplierPrice: ProductDraftMoney;
  readonly sellingPrice: ProductDraftMoney;
  readonly compareAtPrice?: ProductDraftMoney;
  readonly inventoryQuantity?: number;
  readonly available: boolean;
  readonly weightGrams?: number;
  readonly imageId?: string;
}

export interface ProductDraftShippingEstimate {
  readonly minimumDeliveryDays: number;
  readonly maximumDeliveryDays: number;
  readonly shipsFromCountry?: string;
  readonly shipsToCountries: readonly string[];
}

export interface ProductDraftSeo {
  readonly title?: string;
  readonly description?: string;
  readonly handle?: string;
}

export interface ProductDraftBranding {
  readonly brandName?: string;
  readonly productName?: string;
  readonly collectionName?: string;
  readonly positioning?: string;
  readonly targetAudience: readonly string[];
  readonly valueProposition?: string;
}

export interface ProductDraftRiskAssessment {
  readonly level: ProductDraftRiskLevel;
  readonly score?: number;
  readonly reasons: readonly string[];
  readonly restrictedClaims: readonly string[];
  readonly assessedAt?: string;
}

export interface ProductDraftAiMetadata {
  readonly analyzed: boolean;
  readonly branded: boolean;
  readonly copyGenerated: boolean;
  readonly pricingRecommended: boolean;
  readonly riskAssessed: boolean;
  readonly lastProcessedAt?: string;
  readonly modelReference?: string;
}

export interface ProductDraftApprovalMetadata {
  readonly approvalRequired: boolean;
  readonly approvalId?: string;
  readonly requestedAt?: string;
  readonly reviewedAt?: string;
  readonly reviewedBy?: string;
  readonly rejectionReason?: string;
  readonly changeRequestReason?: string;
}

export interface ProductDraftPublicationMetadata {
  readonly marketplace?: string;
  readonly storeId?: string;
  readonly externalProductId?: string;
  readonly externalHandle?: string;
  readonly publishedAt?: string;
  readonly lastSynchronizedAt?: string;
  readonly publicationErrorCode?: string;
  readonly publicationErrorMessage?: string;
}

export interface ProductDraft {
  readonly id: string;
  readonly status: ProductDraftStatus;
  readonly version: number;
  readonly source: ProductDraftSourceReference;
  readonly title: string;
  readonly description: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly vendor?: string;
  readonly tags: readonly string[];
  readonly targetMarkets: readonly string[];
  readonly images: readonly ProductDraftImage[];
  readonly variants: readonly ProductDraftVariant[];
  readonly shipping?: ProductDraftShippingEstimate;
  readonly seo?: ProductDraftSeo;
  readonly branding?: ProductDraftBranding;
  readonly riskAssessment?: ProductDraftRiskAssessment;
  readonly ai?: ProductDraftAiMetadata;
  readonly approval?: ProductDraftApprovalMetadata;
  readonly publication?: ProductDraftPublicationMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
}
