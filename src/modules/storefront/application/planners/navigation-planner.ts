import type { NavigationPlan, StorefrontNavigationItem } from "../../domain/index.js";
import { navItem } from "./planner-utils.js";
import type { StorefrontPlanningContext } from "./storefront-planning.types.js";

export class NavigationPlanner {
  public plan(context: StorefrontPlanningContext): NavigationPlan {
    const categories = [...new Set(context.products.map((product) => product.productType ?? product.category).filter((value): value is string => value !== undefined))];
    const mainMenu: StorefrontNavigationItem[] = [
      navItem("shop", "Shop", "/collections/all", 1),
      navItem("about", "About", "/pages/about-us", 2),
      navItem("faq", "FAQ", "/pages/faq", 3),
      navItem("contact", "Contact", "/pages/contact", 4),
      ...categories.map((category, index) => navItem(`category-${category}`, category, `/collections/${category.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`, index + 5, "shop")),
    ];
    const legalLinks = context.profile.policyPageReferences.length > 0 ? context.profile.policyPageReferences : [
      navItem("shipping-policy", "Shipping Policy", "/policies/shipping-policy", 1),
      navItem("refund-policy", "Return & Refund Policy", "/policies/refund-policy", 2),
      navItem("privacy-policy", "Privacy Policy", "/policies/privacy-policy", 3),
      navItem("terms", "Terms & Conditions", "/policies/terms-of-service", 4),
    ];
    const footerMenus = context.profile.footerRequirements.map((label, index) => navItem(`footer-${label}`, label, `#${label.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`, index + 1));
    const utilityNavigation = [
      navItem("search", "Search", "/search", 1),
      navItem("cart", "Cart", "/cart", 2),
      navItem("account", "Account", "/account", 3),
    ];
    const validationWarnings = [
      ...this.validate(mainMenu),
      ...this.validate(legalLinks),
      ...this.validate(footerMenus),
      ...this.validate(utilityNavigation),
    ];

    return {
      mainMenu,
      mobileMenu: mainMenu,
      footerMenus,
      utilityNavigation,
      legalLinks,
      validationWarnings,
    };
  }

  private validate(items: readonly StorefrontNavigationItem[]): readonly string[] {
    const warnings: string[] = [];
    const handles = items.map((item) => item.handle);
    if (new Set(handles).size !== handles.length) {
      warnings.push("Navigation contains duplicate handles.");
    }
    for (const item of items) {
      if (!item.url.startsWith("/") && !item.url.startsWith("#")) {
        warnings.push(`Navigation item ${item.label} has a broken reference.`);
      }
      const visited = new Set<string>([item.id]);
      let parentId = item.parentId;
      while (parentId !== undefined) {
        if (visited.has(parentId)) {
          warnings.push("Navigation contains circular hierarchy.");
          break;
        }
        visited.add(parentId);
        parentId = items.find((candidate) => candidate.id === parentId)?.parentId;
      }
    }
    return warnings;
  }
}
