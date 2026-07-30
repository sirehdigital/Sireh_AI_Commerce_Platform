import type { ShopifyThemeMetaobjectMapping } from "../mapping/index.js";
import type { ThemeMetaobjectDefinitionsPayload } from "./theme-artifact.types.js";

export class MetaobjectArtifactGenerator {
  public generate(metaobjects: readonly ShopifyThemeMetaobjectMapping[]): ThemeMetaobjectDefinitionsPayload {
    return { metaobjects };
  }
}
