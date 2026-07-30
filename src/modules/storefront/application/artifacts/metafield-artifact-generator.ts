import type { ShopifyThemeMetafieldMapping } from "../mapping/index.js";
import type { ThemeMetafieldDefinitionsPayload } from "./theme-artifact.types.js";

export class MetafieldArtifactGenerator {
  public generate(metafields: readonly ShopifyThemeMetafieldMapping[]): ThemeMetafieldDefinitionsPayload {
    return { metafields };
  }
}
