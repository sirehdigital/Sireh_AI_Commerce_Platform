import type { ShopifyThemeTemplateMapping } from "../mapping/index.js";
import type { ThemeTemplateArtifactPayload } from "./theme-artifact.types.js";

export class CollectionArtifactGenerator {
  public generate(collections: readonly ShopifyThemeTemplateMapping[]): Readonly<Record<string, unknown>> {
    return {
      templates: collections.map((collection): ThemeTemplateArtifactPayload => ({
        templateType: "collection",
        role: collection.role,
        sourcePath: collection.path,
        sections: Object.fromEntries(collection.sections.map((section) => [section.id, {
          type: section.type,
          settings: section.settings,
          blocks: section.blocks,
        }])),
        order: collection.order,
        seo: collection.seo,
      })),
    };
  }
}
