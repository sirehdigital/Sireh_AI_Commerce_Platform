export type ProductMediaJobMode = "PLAN_ONLY" | "GENERATE";

export type ProductMediaJobStatus =
  | "DRAFT"
  | "PLANNED"
  | "VALIDATING"
  | "READY_FOR_GENERATION"
  | "GENERATING"
  | "PARTIALLY_GENERATED"
  | "GENERATED"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED";

export type ProductMediaAssetType =
  | "PRODUCT_HERO"
  | "PRODUCT_GALLERY"
  | "LIFESTYLE"
  | "BENEFIT_CARD"
  | "INGREDIENT_CARD"
  | "HOW_TO_USE"
  | "FEATURE_HIGHLIGHT"
  | "COLLECTION_TILE"
  | "SOCIAL_SQUARE"
  | "SOCIAL_VERTICAL"
  | "AD_CREATIVE"
  | "THUMBNAIL";

export type ProductMediaAssetStatus = "PLANNED" | "GENERATED" | "FAILED" | "SKIPPED" | "PENDING_REVIEW";
export type ProductMediaFormat = "jpg" | "png" | "webp";
export type ProductMediaQualityLevel = "standard" | "premium";
export type ProductMediaVisualQuality = "UNKNOWN" | "PASSED" | "FAILED";

export interface ProductMediaBrandProfile {
  readonly brandName: string;
  readonly visualIdentity: readonly string[];
  readonly preferredColorPalette: readonly string[];
  readonly mood: readonly string[];
  readonly lightingDirection: string;
  readonly backgroundPreferences: readonly string[];
  readonly typographyGuidance?: string;
  readonly prohibitedStyles: readonly string[];
  readonly targetAudience: readonly string[];
  readonly locale: string;
  readonly channelPreferences: readonly string[];
}

export interface ProductMediaSource {
  readonly sourceAssetId: string;
  readonly originalUrl: string;
  readonly contentType?: string;
  readonly width?: number;
  readonly height?: number;
  readonly checksum?: string;
  readonly sourcePlatform?: string;
  readonly licenseStatus: "verified" | "unknown" | "rejected";
  readonly validationStatus?: "pending" | "valid" | "warning" | "rejected";
  readonly rejectionReason?: string;
  readonly storageKey?: string;
}

export interface ProductMediaSpecification {
  readonly assetType: ProductMediaAssetType;
  readonly purpose: string;
  readonly aspectRatio: string;
  readonly width: number;
  readonly height: number;
  readonly format: ProductMediaFormat;
  readonly backgroundRequirement: string;
  readonly textOverlayPolicy: "none" | "minimal" | "allowed";
  readonly safeAreaGuidance: string;
  readonly productPlacementGuidance: string;
  readonly targetChannel: string;
  readonly locale: string;
  readonly variantCount: number;
  readonly qualityLevel: ProductMediaQualityLevel;
  readonly sourceAssetIds: readonly string[];
}

export interface ProductMediaPrompt {
  readonly assetType: ProductMediaAssetType;
  readonly prompt: string;
  readonly negativePrompt: string;
  readonly constraints: readonly string[];
  readonly sourceImageRequired: boolean;
}

export interface ProductMediaPlannedAsset {
  readonly id: string;
  readonly assetType: ProductMediaAssetType;
  readonly purpose: string;
  readonly specification: ProductMediaSpecification;
  readonly prompt: ProductMediaPrompt;
  readonly altText: string;
  readonly warnings: readonly string[];
}

export interface ProductMediaQualityReport {
  readonly score: number;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly requiresHumanReview: boolean;
  readonly visualQuality: ProductMediaVisualQuality;
}

export interface ProductMediaPlan {
  readonly planId: string;
  readonly productDraftId: string;
  readonly locale: string;
  readonly channels: readonly string[];
  readonly brandProfile: ProductMediaBrandProfile;
  readonly sourceMedia: readonly ProductMediaSource[];
  readonly assets: readonly ProductMediaPlannedAsset[];
  readonly warnings: readonly string[];
  readonly qualityReport: ProductMediaQualityReport;
  readonly createdAt: string;
}

export interface ProductMediaAsset {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly mediaJobId: string;
  readonly assetType: ProductMediaAssetType;
  readonly purpose: string;
  readonly status: ProductMediaAssetStatus;
  readonly aspectRatio: string;
  readonly width: number;
  readonly height: number;
  readonly format: ProductMediaFormat;
  readonly promptSnapshot: ProductMediaPrompt;
  readonly negativePrompt?: string;
  readonly sourceAssetReferences: readonly string[];
  readonly providerId?: string;
  readonly providerReference?: string;
  readonly storageKey?: string;
  readonly outputUrl?: string;
  readonly altText: string;
  readonly reviewNotes?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProductMediaJob {
  readonly id: string;
  readonly tenantId: string;
  readonly storeId: string;
  readonly shopDomain?: string;
  readonly productDraftId: string;
  readonly importId?: string;
  readonly parentJobId?: string;
  readonly idempotencyKey: string;
  readonly mode: ProductMediaJobMode;
  readonly status: ProductMediaJobStatus;
  readonly providerId?: string;
  readonly brandProfileSnapshot: ProductMediaBrandProfile;
  readonly planSnapshot: ProductMediaPlan;
  readonly qualityReportSnapshot: ProductMediaQualityReport;
  readonly warnings: readonly string[];
  readonly failureStage?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly approvalId?: string;
  readonly auditReference?: string;
  readonly correlationId?: string;
  readonly forced: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface ProductMediaJobWithAssets {
  readonly job: ProductMediaJob;
  readonly assets: readonly ProductMediaAsset[];
}
