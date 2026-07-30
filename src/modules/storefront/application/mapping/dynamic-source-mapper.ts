import type { StorefrontBlock, StorefrontSection } from "../../domain/index.js";

export class DynamicSourceMapper {
  public forSection(section: StorefrontSection): readonly string[] {
    return [
      ...section.dynamicDataBindings,
      ...Object.keys(section.settings).filter((key) => /product|collection|heading|text|media|menu/iu.test(key)).map((key) => `section.settings.${key}`),
    ];
  }

  public forBlock(block: StorefrontBlock): readonly string[] {
    return Object.keys(block.settings)
      .filter((key) => /product|collection|source|media|text|label/iu.test(key))
      .map((key) => `block.settings.${key}`);
  }
}
