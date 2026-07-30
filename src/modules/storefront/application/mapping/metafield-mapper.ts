import type { StorefrontPlan } from "../../domain/index.js";
import type { ShopifyThemeMetafieldMapping } from "./theme-mapping.types.js";

export class MetafieldMapper {
  public map(plan: StorefrontPlan): readonly ShopifyThemeMetafieldMapping[] {
    const planned = plan.metadata.productMetafields.map((field): ShopifyThemeMetafieldMapping => ({
      ownerType: field.ownerType === "SHOP" ? "SHOP" : field.ownerType,
      namespace: field.namespace,
      key: field.key,
      valueType: field.dataType,
      dynamicSource: `${field.namespace}.${field.key}`,
      required: false,
    }));
    const defaults: readonly ShopifyThemeMetafieldMapping[] = [
      this.field("PRODUCT", "custom", "benefits", "list.single_line_text_field"),
      this.field("PRODUCT", "custom", "how_to_use", "multi_line_text_field"),
      this.field("COLLECTION", "custom", "featured_story", "multi_line_text_field"),
      this.field("SHOP", "custom", "brand_promise", "multi_line_text_field"),
    ];
    return planned.length > 0 ? planned : defaults;
  }

  private field(
    ownerType: ShopifyThemeMetafieldMapping["ownerType"],
    namespace: string,
    key: string,
    valueType: string,
  ): ShopifyThemeMetafieldMapping {
    return {
      ownerType,
      namespace,
      key,
      valueType,
      dynamicSource: `${namespace}.${key}`,
      required: false,
    };
  }
}
