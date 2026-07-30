import type { StorefrontArtifact, StorefrontThemeTarget } from "../../domain/index.js";

export interface ShopifyThemeGatewayResult {
  readonly ok: boolean;
  readonly previewUrl: string | null;
  readonly artifactReferences: readonly string[];
  readonly warnings: readonly string[];
  readonly failureCode?: string;
  readonly failureMessage?: string;
}

export interface ShopifyThemeGateway {
  readonly id: string;
  generateArtifacts(input: {
    readonly themeTarget: StorefrontThemeTarget;
    readonly artifacts: readonly StorefrontArtifact[];
  }): Promise<ShopifyThemeGatewayResult>;
  activateTheme(): Promise<ShopifyThemeGatewayResult>;
  publishProducts(): Promise<ShopifyThemeGatewayResult>;
  uploadMedia(): Promise<ShopifyThemeGatewayResult>;
}
