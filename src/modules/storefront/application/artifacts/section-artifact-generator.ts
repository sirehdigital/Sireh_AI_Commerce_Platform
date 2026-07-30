import type { ShopifyThemeMappingModel, ShopifyThemeSectionMapping } from "../mapping/index.js";
import type { ThemeSectionDefinitionsPayload } from "./theme-artifact.types.js";

export class SectionArtifactGenerator {
  public generate(mapping: ShopifyThemeMappingModel): ThemeSectionDefinitionsPayload {
    return {
      sections: this.sections(mapping),
    };
  }

  public sections(mapping: ShopifyThemeMappingModel): readonly ShopifyThemeSectionMapping[] {
    return [
      ...mapping.homepage.sections,
      ...mapping.products.flatMap((template) => template.sections),
      ...mapping.collections.flatMap((template) => template.sections),
    ];
  }
}
