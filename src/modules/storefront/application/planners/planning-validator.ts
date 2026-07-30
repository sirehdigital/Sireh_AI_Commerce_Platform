import type {
  StorefrontPlan,
  StorefrontValidationIssue,
  StorefrontValidationReport,
} from "../../domain/index.js";

export class PlanningValidator {
  public validate(plan: StorefrontPlan): StorefrontValidationReport {
    const errors: StorefrontValidationIssue[] = [];
    const warnings: StorefrontValidationIssue[] = [];

    if (plan.homepage.sections.length === 0) {
      errors.push(this.error("MISSING_HOMEPAGE", "Homepage plan is missing.", "homepage"));
    }
    if (!plan.homepage.sections.some((section) => section.type === "hero-banner")) {
      errors.push(this.error("MISSING_HERO", "Homepage hero is missing.", "homepage.sections"));
    }
    if (plan.navigation.mainMenu.length === 0 || plan.navigation.mobileMenu.length === 0) {
      errors.push(this.error("MISSING_NAVIGATION", "Main and mobile navigation are required.", "navigation"));
    }
    if (plan.productPages.length === 0) {
      warnings.push(this.warning("MISSING_PRODUCT_DATA", "No approved products were available for product page planning.", "productPages"));
    }
    if (plan.profile.brandName.trim().length === 0) {
      errors.push(this.error("MISSING_BRAND_PROFILE", "Storefront brand profile is incomplete.", "profile.brandName"));
    }
    if (plan.collections.some((collection) => collection.title.trim().length === 0 || collection.handle.trim().length === 0)) {
      errors.push(this.error("INVALID_COLLECTION", "Collection plans require title and handle.", "collections"));
    }
    const sectionIds = plan.homepage.sections.concat(plan.productPages.flatMap((page) => page.sections), plan.collections.flatMap((collection) => collection.sections)).map((section) => section.id);
    if (new Set(sectionIds).size !== sectionIds.length) {
      errors.push(this.error("DUPLICATE_SECTIONS", "Section IDs must be unique across the storefront plan.", "sections"));
    }
    const menuGroups = [
      plan.navigation.mainMenu,
      plan.navigation.footerMenus,
      plan.navigation.mobileMenu,
      plan.navigation.utilityNavigation,
      plan.navigation.legalLinks,
    ];
    if (menuGroups.some((group) => new Set(group.map((item) => item.handle)).size !== group.length)) {
      warnings.push(this.warning("INVALID_MENU", "Navigation handles contain duplicates.", "navigation"));
    }
    warnings.push(...plan.navigation.validationWarnings.map((message) => this.warning("INVALID_MENU", message, "navigation")));

    return {
      errors,
      warnings,
      blockedReasons: errors.map((issue) => issue.message),
      requiresHumanReview: true,
    };
  }

  private error(code: string, message: string, path: string): StorefrontValidationIssue {
    return { code, message, severity: "ERROR", path };
  }

  private warning(code: string, message: string, path: string): StorefrontValidationIssue {
    return { code, message, severity: "WARNING", path };
  }
}
