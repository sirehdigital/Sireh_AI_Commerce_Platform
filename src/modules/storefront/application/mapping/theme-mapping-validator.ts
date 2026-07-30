import type { StorefrontValidationIssue, StorefrontValidationReport } from "../../domain/index.js";
import type { ShopifyThemeMappingModel, ShopifyThemeNavigationItemMapping } from "./theme-mapping.types.js";

export class ThemeMappingValidator {
  public validate(mapping: Omit<ShopifyThemeMappingModel, "validation">): StorefrontValidationReport {
    const errors: StorefrontValidationIssue[] = [];
    const warnings: StorefrontValidationIssue[] = [];
    if (mapping.homepage.sections.length === 0) {
      errors.push(this.error("MISSING_THEME_SECTIONS", "Homepage mapping must include theme sections.", "homepage.sections"));
    }
    if (mapping.products.length === 0) {
      warnings.push(this.warning("MISSING_PRODUCT_TEMPLATES", "No product template mappings were generated.", "products"));
    }
    if (mapping.collections.length === 0) {
      warnings.push(this.warning("MISSING_COLLECTION_TEMPLATES", "No collection template mappings were generated.", "collections"));
    }
    if (mapping.homepage.path.trim().length === 0) {
      errors.push(this.error("MISSING_TEMPLATES", "Homepage template path is missing.", "homepage.path"));
    }
    const navigationItems = mapping.navigation.mainMenu.concat(mapping.navigation.footerMenu, mapping.navigation.mobileMenu, mapping.navigation.utilityLinks);
    this.validateNavigation(navigationItems, errors, warnings);
    const dynamicSources = mapping.homepage.sections.concat(mapping.products.flatMap((template) => template.sections), mapping.collections.flatMap((template) => template.sections)).flatMap((section) => section.dynamicSources.concat(section.blocks.flatMap((block) => block.dynamicSources)));
    if (dynamicSources.some((source) => source.trim().length === 0 || source.includes(".."))) {
      errors.push(this.error("BROKEN_DYNAMIC_SOURCES", "Dynamic sources must be complete references.", "dynamicSources"));
    }
    if (mapping.homepage.sections.some((section) => section.type === "unsupported")) {
      errors.push(this.error("UNSUPPORTED_MAPPING", "Unsupported theme section mapping detected.", "sections"));
    }
    return {
      errors,
      warnings,
      blockedReasons: errors.map((issue) => issue.message),
      requiresHumanReview: true,
    };
  }

  private validateNavigation(
    items: readonly ShopifyThemeNavigationItemMapping[],
    errors: StorefrontValidationIssue[],
    warnings: StorefrontValidationIssue[],
  ): void {
    const handles = items.map((item) => `${item.parentId ?? "root"}:${item.handle}`);
    if (new Set(handles).size !== handles.length) {
      warnings.push(this.warning("DUPLICATE_HANDLES", "Navigation mapping contains duplicate handles.", "navigation"));
    }
    for (const item of items) {
      if (!item.url.startsWith("/") && !item.url.startsWith("#")) {
        errors.push(this.error("INVALID_REFERENCES", "Navigation mapping contains invalid references.", `navigation.${item.id}`));
      }
    }
  }

  private error(code: string, message: string, path: string): StorefrontValidationIssue {
    return { code, message, severity: "ERROR", path };
  }

  private warning(code: string, message: string, path: string): StorefrontValidationIssue {
    return { code, message, severity: "WARNING", path };
  }
}
