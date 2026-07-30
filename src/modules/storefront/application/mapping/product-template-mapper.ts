import type { ProductPagePlan } from "../../domain/index.js";
import { SectionMapper } from "./section-mapper.js";
import type { ShopifyThemeTemplateMapping } from "./theme-mapping.types.js";

export class ProductTemplateMapper {
  public constructor(private readonly sectionMapper = new SectionMapper()) {}

  public map(plan: ProductPagePlan): ShopifyThemeTemplateMapping {
    const sections = plan.sections.map((section) => this.sectionMapper.map(section));
    return {
      path: plan.templateId,
      templateType: "product",
      role: "product-preview",
      sections,
      order: sections.map((section) => section.id),
      seo: {
        title: plan.seoTitle,
        description: plan.metaDescription,
        handle: plan.handle,
        productDraftId: plan.productDraftId,
      },
    };
  }
}
