import type { NavigationPlan, StorefrontNavigationItem } from "../../domain/index.js";
import type {
  ShopifyThemeNavigationItemMapping,
  ShopifyThemeNavigationMapping,
} from "./theme-mapping.types.js";

export class NavigationMapper {
  public map(plan: NavigationPlan): ShopifyThemeNavigationMapping {
    return {
      mainMenu: plan.mainMenu.map((item) => this.item(item)),
      footerMenu: plan.footerMenus.concat(plan.legalLinks).map((item) => this.item(item)),
      mobileMenu: plan.mobileMenu.map((item) => this.item(item)),
      utilityLinks: plan.utilityNavigation.map((item) => this.item(item)),
    };
  }

  private item(item: StorefrontNavigationItem): ShopifyThemeNavigationItemMapping {
    return {
      id: item.id,
      label: item.label,
      handle: item.handle,
      url: item.url,
      ...(item.parentId === undefined ? {} : { parentId: item.parentId }),
      order: item.order,
    };
  }
}
