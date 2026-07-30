import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { CollectionPagePlan, StorefrontSection } from "../../domain/index.js";
import { block, handleize, section } from "./planner-utils.js";
import type { StorefrontPlanningContext } from "./storefront-planning.types.js";

export class CollectionPlanner {
  public plan(context: StorefrontPlanningContext): readonly CollectionPagePlan[] {
    const byCategory = new Map<string, ProductDraft[]>();
    byCategory.set("Best Sellers", [...context.products]);
    for (const product of context.products) {
      const category = product.productType ?? product.category ?? "Featured";
      byCategory.set(category, [...(byCategory.get(category) ?? []), product]);
    }
    return [...byCategory.entries()].map(([title, products]) => this.collection(context, title, products));
  }

  private collection(context: StorefrontPlanningContext, title: string, products: readonly ProductDraft[]): CollectionPagePlan {
    const handle = handleize(title);
    const sections: StorefrontSection[] = [
      section({ type: "main-collection-banner", id: `collection-hero-${handle}`, position: 1, purpose: "Collection hero", settings: { heading: title }, locale: context.locale, markets: context.markets }),
      section({ type: "rich-text", id: `collection-description-${handle}`, position: 2, purpose: "Collection description", settings: { text: `${title} products curated for ${context.profile.brandName}.` }, locale: context.locale, markets: context.markets }),
      section({ type: "main-collection-product-grid", id: `collection-grid-${handle}`, position: 3, purpose: "Product grid", settings: { productCount: products.length, pagination: true }, locale: context.locale, markets: context.markets }),
      section({ type: "collection-list", id: `category-cards-${handle}`, position: 4, purpose: "Category cards", blocks: products.slice(0, 6).map((product, index) => block("category-card", product.id, index + 1, { title: product.title })), locale: context.locale, markets: context.markets }),
      section({ type: "empty-state", id: `empty-state-${handle}`, position: 5, purpose: "Empty state", settings: { message: "No approved products are currently assigned." }, locale: context.locale, markets: context.markets }),
    ];

    return {
      templateId: `templates/collection.${handle}.json`,
      handle,
      title,
      description: `${title} products curated for ${context.profile.brandName}.`,
      productDraftIds: products.map((product) => product.id),
      sections,
      sortControls: ["manual", "best-selling", "price-ascending", "price-descending"],
      filters: ["availability", "price", "product-type"],
      mobileGridBehavior: "two-column mobile grid with filter drawer",
      seoTitle: `${title} | ${context.profile.brandName}`,
      metaDescription: `Shop ${title} from ${context.profile.brandName}.`,
    };
  }
}
