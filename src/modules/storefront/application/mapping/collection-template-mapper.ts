import type { CollectionPagePlan } from "../../domain/index.js";
import { SectionMapper } from "./section-mapper.js";
import type { ShopifyThemeTemplateMapping } from "./theme-mapping.types.js";

export class CollectionTemplateMapper {
  public constructor(private readonly sectionMapper = new SectionMapper()) {}

  public map(plan: CollectionPagePlan): ShopifyThemeTemplateMapping {
    const sections = plan.sections.map((section) => this.sectionMapper.map(section));
    return {
      path: plan.templateId,
      templateType: "collection",
      role: "collection-preview",
      sections,
      order: sections.map((section) => section.id),
      seo: {
        title: plan.seoTitle,
        description: plan.metaDescription,
        handle: plan.handle,
      },
    };
  }
}
