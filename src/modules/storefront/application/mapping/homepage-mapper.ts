import type { HomepagePlan } from "../../domain/index.js";
import { SectionMapper } from "./section-mapper.js";
import type { ShopifyThemeTemplateMapping } from "./theme-mapping.types.js";

export class HomepageMapper {
  public constructor(private readonly sectionMapper = new SectionMapper()) {}

  public map(plan: HomepagePlan): ShopifyThemeTemplateMapping {
    const sections = plan.sections.map((section) => this.sectionMapper.map(section));
    return {
      path: plan.templateId,
      templateType: "index",
      role: "homepage-preview",
      sections,
      order: sections.map((section) => section.id),
      seo: {
        title: plan.seoTitle,
        description: plan.metaDescription,
      },
    };
  }
}
