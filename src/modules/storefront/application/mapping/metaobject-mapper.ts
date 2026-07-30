import type { StorefrontPlan } from "../../domain/index.js";
import type { ShopifyThemeMetaobjectMapping, ShopifyThemeMetafieldMapping } from "./theme-mapping.types.js";

export class MetaobjectMapper {
  public map(plan: StorefrontPlan, metafields: readonly ShopifyThemeMetafieldMapping[]): readonly ShopifyThemeMetaobjectMapping[] {
    if (plan.metadata.metaobjects.length > 0) {
      return plan.metadata.metaobjects.map((metaobject) => ({
        type: metaobject.type,
        name: metaobject.name,
        fields: metafields.filter((field) => metaobject.fields.some((candidate) => candidate.key === field.key)),
        source: metaobject.sourceFieldMapping,
      }));
    }
    return [
      this.metaobject("brand_story", "Brand Story", "storefront.profile", metafields.filter((field) => field.ownerType === "SHOP")),
      this.metaobject("faq_item", "FAQ", "merchant.content", [this.field("SHOP", "custom", "question", "single_line_text_field"), this.field("SHOP", "custom", "answer", "multi_line_text_field")]),
      this.metaobject("trust_badge", "Trust Badge", "storefront.trust", [this.field("SHOP", "custom", "trust_label", "single_line_text_field")]),
      this.metaobject("testimonial", "Testimonials", "verified.merchant.content", [this.field("SHOP", "custom", "testimonial_text", "multi_line_text_field")]),
      this.metaobject("announcement_content", "Announcement Content", "storefront.announcement", [this.field("SHOP", "custom", "announcement_text", "single_line_text_field")]),
    ];
  }

  private metaobject(
    type: string,
    name: string,
    source: string,
    fields: readonly ShopifyThemeMetafieldMapping[],
  ): ShopifyThemeMetaobjectMapping {
    return { type, name, fields, source };
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
