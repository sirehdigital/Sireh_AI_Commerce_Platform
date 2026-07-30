import type { ShopifyThemeSectionMapping } from "../mapping/index.js";
import type { ThemeDynamicSourceReferencesPayload } from "./theme-artifact.types.js";

export class DynamicSourceArtifactGenerator {
  public generate(sections: readonly ShopifyThemeSectionMapping[]): ThemeDynamicSourceReferencesPayload {
    return {
      dynamicSources: sections.flatMap((section) => [
        ...section.dynamicSources.map((source) => ({
          ownerType: "section" as const,
          ownerId: section.id,
          source,
        })),
        ...section.blocks.flatMap((block) => block.dynamicSources.map((source) => ({
          ownerType: "block" as const,
          ownerId: block.id,
          source,
        }))),
      ]),
    };
  }
}
