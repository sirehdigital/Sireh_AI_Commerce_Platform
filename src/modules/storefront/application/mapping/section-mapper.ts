import type { StorefrontSection } from "../../domain/index.js";
import { cleanSettings } from "./mapping-utils.js";
import { BlockMapper } from "./block-mapper.js";
import { DynamicSourceMapper } from "./dynamic-source-mapper.js";
import type { ShopifyThemeSectionMapping } from "./theme-mapping.types.js";

export class SectionMapper {
  public constructor(
    private readonly blockMapper = new BlockMapper(),
    private readonly dynamicSourceMapper = new DynamicSourceMapper(),
  ) {}

  public map(section: StorefrontSection): ShopifyThemeSectionMapping {
    return {
      id: section.id,
      type: this.sectionType(section.type),
      order: section.position,
      settings: cleanSettings(section.settings),
      blocks: section.blocks.map((block) => this.blockMapper.map(block)),
      dynamicSources: this.dynamicSourceMapper.forSection(section),
      themeReference: `sections/${this.sectionType(section.type)}.liquid`,
    };
  }

  private sectionType(type: string): string {
    const supportedAliases = new Map<string, string>([
      ["hero-banner", "image-banner"],
      ["custom-liquid-placeholder", "custom-liquid"],
      ["empty-state", "rich-text"],
    ]);
    return supportedAliases.get(type) ?? type;
  }
}
