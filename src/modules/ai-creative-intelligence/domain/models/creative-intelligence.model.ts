export const CREATIVE_ASSET_TYPES = ["IMAGE", "VIDEO", "CAROUSEL", "COPY", "MIXED"] as const;

export type CreativeAssetType = (typeof CREATIVE_ASSET_TYPES)[number];

export const CREATIVE_PLATFORMS = ["FACEBOOK", "INSTAGRAM", "THREADS", "TIKTOK", "SHOPIFY", "EMAIL", "OTHER"] as const;

export type CreativePlatform = (typeof CREATIVE_PLATFORMS)[number];

export const CREATIVE_ANALYSIS_STATUSES = ["PENDING_ANALYSIS", "REVIEW_REQUIRED", "ANALYZED", "REJECTED"] as const;

export type CreativeAnalysisStatus = (typeof CREATIVE_ANALYSIS_STATUSES)[number];

export interface CreativeBrief {
  readonly hook?: string;
  readonly headline?: string;
  readonly primaryText?: string;
  readonly description?: string;
  readonly callToAction?: string;
  readonly visualConcept?: string;
}

export interface CreativeIntelligenceRecord {
  readonly id: string;
  readonly creativeId: string;
  readonly productId: string;
  readonly sourceContentId?: string;
  readonly assetType: CreativeAssetType;
  readonly platforms: readonly CreativePlatform[];
  readonly targetMarkets: readonly string[];
  readonly brief: CreativeBrief;
  readonly brandName?: string;
  readonly brandTone?: string;
  readonly analysisStatus: CreativeAnalysisStatus;
  readonly warnings: readonly string[];
  readonly registeredAt: string;
  readonly version: "SACP-CREATIVE-v1";
}
