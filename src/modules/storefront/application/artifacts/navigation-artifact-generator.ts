import type { ShopifyThemeNavigationMapping } from "../mapping/index.js";
import type { ThemeNavigationArtifactPayload } from "./theme-artifact.types.js";

export class NavigationArtifactGenerator {
  public generate(navigation: ShopifyThemeNavigationMapping): ThemeNavigationArtifactPayload {
    return { navigation };
  }
}
