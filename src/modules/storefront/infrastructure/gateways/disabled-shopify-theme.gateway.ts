import type { ShopifyThemeGateway, ShopifyThemeGatewayResult } from "../../application/gateways/index.js";

export class DisabledShopifyThemeGateway implements ShopifyThemeGateway {
  public readonly id = "disabled-shopify-theme-gateway";

  public generateArtifacts(): Promise<ShopifyThemeGatewayResult> {
    return Promise.resolve({
      ok: false,
      previewUrl: null,
      artifactReferences: [],
      warnings: [],
      failureCode: "SHOPIFY_THEME_GATEWAY_DISABLED",
      failureMessage: "Shopify theme artifact generation is disabled until a safe draft-theme workflow is configured.",
    });
  }

  public activateTheme(): Promise<ShopifyThemeGatewayResult> {
    return Promise.resolve(blocked("SHOPIFY_THEME_ACTIVATION_DISABLED", "Theme activation is disabled for storefront preview planning."));
  }

  public publishProducts(): Promise<ShopifyThemeGatewayResult> {
    return Promise.resolve(blocked("SHOPIFY_PRODUCT_PUBLISH_DISABLED", "Product publishing is disabled for storefront preview planning."));
  }

  public uploadMedia(): Promise<ShopifyThemeGatewayResult> {
    return Promise.resolve(blocked("SHOPIFY_MEDIA_UPLOAD_DISABLED", "Media upload is disabled for storefront preview planning."));
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
