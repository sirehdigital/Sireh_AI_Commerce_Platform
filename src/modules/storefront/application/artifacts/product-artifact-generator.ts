import type { ShopifyThemeTemplateMapping } from "../mapping/index.js";
import type { ThemeTemplateArtifactPayload } from "./theme-artifact.types.js";

export class ProductArtifactGenerator {
  public generate(products: readonly ShopifyThemeTemplateMapping[]): Readonly<Record<string, unknown>> {
    return {
      templates: products.map((product): ThemeTemplateArtifactPayload => ({
        templateType: "product",
        role: product.role,
        sourcePath: product.path,
        sections: Object.fromEntries(product.sections.map((section) => [section.id, {
          type: section.type,
          settings: section.settings,
          blocks: section.blocks,
        }])),
        order: product.order,
        seo: product.seo,
      })),
    };
  }
}
