import type { ShopifyThemeGateway, ShopifyThemeGatewayResult } from "../../application/gateways/index.js";
import type { StorefrontArtifact } from "../../domain/index.js";

export class FakeShopifyThemeGateway implements ShopifyThemeGateway {
  public readonly id = "fake-shopify-theme-gateway";
  public readonly generatedArtifactIds: string[] = [];
  public readonly activationAttempts: string[] = [];
  public readonly productPublishAttempts: string[] = [];
  public readonly mediaUploadAttempts: string[] = [];

  public generateArtifacts(input: { readonly artifacts: readonly StorefrontArtifact[] }): Promise<ShopifyThemeGatewayResult> {
    this.generatedArtifactIds.push(...input.artifacts.map((artifact) => artifact.id));
    return Promise.resolve({
      ok: true,
      previewUrl: null,
      artifactReferences: input.artifacts.map((artifact) => artifact.path),
      warnings: ["Generated artifacts are isolated review artifacts and were not uploaded to Shopify."],
    });
  }

  public activateTheme(): Promise<ShopifyThemeGatewayResult> {
    this.activationAttempts.push("blocked");
    return Promise.resolve(blocked("SHOPIFY_THEME_ACTIVATION_DISABLED", "Fake gateway does not activate themes."));
  }

  public publishProducts(): Promise<ShopifyThemeGatewayResult> {
    this.productPublishAttempts.push("blocked");
    return Promise.resolve(blocked("SHOPIFY_PRODUCT_PUBLISH_DISABLED", "Fake gateway does not publish products."));
  }

  public uploadMedia(): Promise<ShopifyThemeGatewayResult> {
    this.mediaUploadAttempts.push("blocked");
    return Promise.resolve(blocked("SHOPIFY_MEDIA_UPLOAD_DISABLED", "Fake gateway does not upload media."));
  }
}

function blocked(failureCode: string, failureMessage: string): ShopifyThemeGatewayResult {
  return {
    ok: false,
    previewUrl: null,
    artifactReferences: [],
    warnings: [],
    failureCode,
    failureMessage,
  };
}
