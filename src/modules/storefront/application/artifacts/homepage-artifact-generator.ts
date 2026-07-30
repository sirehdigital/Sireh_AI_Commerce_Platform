import type { ShopifyThemeTemplateMapping } from "../mapping/index.js";
import type { ThemeTemplateArtifactPayload } from "./theme-artifact.types.js";

export class HomepageArtifactGenerator {
  public generate(homepage: ShopifyThemeTemplateMapping): ThemeTemplateArtifactPayload {
    return {
      templateType: "index",
      role: homepage.role,
      sourcePath: homepage.path,
      sections: Object.fromEntries(homepage.sections.map((section) => [section.id, {
        type: section.type,
        settings: section.settings,
        blocks: section.blocks,
      }])),
      order: homepage.order,
      seo: homepage.seo,
    };
  }
}
