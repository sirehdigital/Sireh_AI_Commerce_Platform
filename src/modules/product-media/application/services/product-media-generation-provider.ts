import type { ProductMediaAssetType, ProductMediaPlannedAsset } from "../../domain/models/index.js";

export interface ProductMediaProviderAssetResult {
  readonly plannedAssetId: string;
  readonly status: "GENERATED" | "FAILED";
  readonly providerReference?: string;
  readonly outputUrl?: string;
  readonly storageKey?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
}

export interface ProductMediaProviderResult {
  readonly providerId: string;
  readonly providerJobId?: string;
  readonly assets: readonly ProductMediaProviderAssetResult[];
  readonly warnings: readonly string[];
}

export interface ProductMediaGenerationProvider {
  readonly providerId: string;
  readonly configured: boolean;
  readonly supportedAssetTypes: readonly ProductMediaAssetType[];
  readonly supportsImageReferences: boolean;
  readonly supportsNegativePrompts: boolean;
  readonly supportsTransparentBackground: boolean;
  generate(input: {
    readonly jobId: string;
    readonly assets: readonly ProductMediaPlannedAsset[];
  }): Promise<ProductMediaProviderResult>;
}
