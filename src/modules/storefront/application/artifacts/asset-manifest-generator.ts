import type { ShopifyThemeMappingModel } from "../mapping/index.js";
import type { AssetManifestPayload } from "./theme-artifact.types.js";

export class AssetManifestGenerator {
  public generate(mapping: ShopifyThemeMappingModel): AssetManifestPayload {
    const templateAssets: AssetManifestPayload["assets"] = [
      { id: "homepage-json", ownerPath: mapping.homepage.path, assetType: "json" as const, required: true },
      ...mapping.products.map((template, index) => ({ id: `product-json-${index + 1}`, ownerPath: template.path, assetType: "json" as const, required: true })),
      ...mapping.collections.map((template, index) => ({ id: `collection-json-${index + 1}`, ownerPath: template.path, assetType: "json" as const, required: true })),
    ];
    return {
      assets: templateAssets.concat([
        { id: "navigation-json", ownerPath: "theme-preview/navigation.json", assetType: "navigation", required: true },
        { id: "settings-json", ownerPath: "theme-preview/settings.json", assetType: "settings", required: true },
        { id: "metafields-json", ownerPath: "theme-preview/metafields.json", assetType: "metadata", required: false },
        { id: "metaobjects-json", ownerPath: "theme-preview/metaobjects.json", assetType: "metadata", required: false },
      ]),
    };
  }
}
