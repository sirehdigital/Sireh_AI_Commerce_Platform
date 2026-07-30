import type { ShopifyThemeBlockMapping, ShopifyThemeSectionMapping } from "../mapping/index.js";
import type { ThemeBlockDefinitionsPayload } from "./theme-artifact.types.js";

export class BlockArtifactGenerator {
  public generate(sections: readonly ShopifyThemeSectionMapping[]): ThemeBlockDefinitionsPayload {
    return {
      blocks: this.blocks(sections),
    };
  }

  public blocks(sections: readonly ShopifyThemeSectionMapping[]): readonly ShopifyThemeBlockMapping[] {
    return sections.flatMap((section) => section.blocks);
  }
}
