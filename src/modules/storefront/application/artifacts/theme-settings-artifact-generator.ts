import type { ShopifyThemeSettingsMapping } from "../mapping/index.js";
import type { ThemeSettingsArtifactPayload } from "./theme-artifact.types.js";

export class ThemeSettingsArtifactGenerator {
  public generate(settings: ShopifyThemeSettingsMapping): ThemeSettingsArtifactPayload {
    return { settings };
  }
}
