import type { ProductMediaAssetType } from "../../domain/models/index.js";
import type { ProductMediaGenerationProvider, ProductMediaProviderResult } from "../../application/services/product-media-generation-provider.js";

export class FakeProductMediaGenerationProvider implements ProductMediaGenerationProvider {
  public readonly providerId = "fake-product-media-provider";
  public readonly configured = true;
  public readonly supportedAssetTypes: readonly ProductMediaAssetType[];
  public readonly supportsImageReferences = true;
  public readonly supportsNegativePrompts = true;
  public readonly supportsTransparentBackground = false;

  public constructor(private readonly failAssetTypes: readonly ProductMediaAssetType[] = []) {
    this.supportedAssetTypes = [
      "PRODUCT_HERO",
      "PRODUCT_GALLERY",
      "LIFESTYLE",
      "BENEFIT_CARD",
      "INGREDIENT_CARD",
      "HOW_TO_USE",
      "FEATURE_HIGHLIGHT",
      "COLLECTION_TILE",
      "SOCIAL_SQUARE",
      "SOCIAL_VERTICAL",
      "AD_CREATIVE",
      "THUMBNAIL",
    ];
  }

  public generate(input: Parameters<ProductMediaGenerationProvider["generate"]>[0]): Promise<ProductMediaProviderResult> {
    return Promise.resolve({
      providerId: this.providerId,
      providerJobId: `${this.providerId}:${input.jobId}`,
      assets: input.assets.map((asset) => {
        if (this.failAssetTypes.includes(asset.assetType)) {
          return {
            plannedAssetId: asset.id,
            status: "FAILED",
            failureCode: "FAKE_PROVIDER_ASSET_FAILED",
            failureMessage: `Fake provider failed ${asset.assetType}.`,
          };
        }

        return {
          plannedAssetId: asset.id,
          status: "GENERATED",
          providerReference: `${this.providerId}:${asset.id}`,
          storageKey: `fake-media/${input.jobId}/${asset.id}.${asset.specification.format}`,
          outputUrl: `https://media.example/${input.jobId}/${asset.id}.${asset.specification.format}`,
        };
      }),
      warnings: [],
    });
  }
}
