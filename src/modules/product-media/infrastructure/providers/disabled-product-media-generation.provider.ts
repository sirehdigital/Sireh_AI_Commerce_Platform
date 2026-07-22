import type { ProductMediaGenerationProvider } from "../../application/services/product-media-generation-provider.js";

export class DisabledProductMediaGenerationProvider implements ProductMediaGenerationProvider {
  public readonly providerId = "disabled-product-media-provider";
  public readonly configured = false;
  public readonly supportedAssetTypes = [];
  public readonly supportsImageReferences = false;
  public readonly supportsNegativePrompts = false;
  public readonly supportsTransparentBackground = false;

  public generate(): Promise<never> {
    return Promise.reject(new ProductMediaProviderUnavailableError());
  }
}

export class ProductMediaProviderUnavailableError extends Error {
  public constructor() {
    super("Product media generation provider is not configured.");
    this.name = "ProductMediaProviderUnavailableError";
  }
}
