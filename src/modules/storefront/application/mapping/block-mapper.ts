import type { StorefrontBlock } from "../../domain/index.js";
import { cleanSettings } from "./mapping-utils.js";
import type { ShopifyThemeBlockMapping } from "./theme-mapping.types.js";
import { DynamicSourceMapper } from "./dynamic-source-mapper.js";

export class BlockMapper {
  public constructor(private readonly dynamicSourceMapper = new DynamicSourceMapper()) {}

  public map(block: StorefrontBlock): ShopifyThemeBlockMapping {
    return {
      id: block.id,
      type: block.type,
      order: block.order,
      settings: cleanSettings(block.settings),
      dynamicSources: this.dynamicSourceMapper.forBlock(block),
    };
  }
}
