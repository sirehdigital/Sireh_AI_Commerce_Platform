import type { HomepagePlan, StorefrontSection } from "../../domain/index.js";
import { block, handleize, section } from "./planner-utils.js";
import type { StorefrontPlanningContext } from "./storefront-planning.types.js";

export class HomepagePlanner {
  public plan(context: StorefrontPlanningContext): HomepagePlan {
    const sections: StorefrontSection[] = [];
    const add = (item: StorefrontSection): void => {
      sections.push({ ...item, position: sections.length + 1 });
    };
    const products = context.products;
    const categories = [...new Set(products.map((product) => product.productType ?? product.category).filter((value): value is string => value !== undefined))];
    const firstProduct = products[0];

    add(section({ type: "announcement-bar", id: "announcement-bar", position: 1, purpose: "Market-aware announcement area", settings: { text: "Policy messaging requires merchant confirmation." }, locale: context.locale, markets: context.markets }));
    add(section({ type: "header", id: "header", position: 2, purpose: "Primary navigation", settings: { menu: "main-menu" }, locale: context.locale, markets: context.markets }));
    add(section({ type: "hero-banner", id: "hero-banner", position: 3, purpose: "Brand hero", settings: { heading: context.profile.brandName, subheading: context.profile.brandPositioning, primaryCta: "Shop now", secondaryCta: "Explore categories" }, locale: context.locale, markets: context.markets }));
    if (products.length > 0) {
      add(section({ type: "featured-collection", id: "featured-collection", position: 4, purpose: "Best sellers", settings: { heading: "Best Sellers", productCount: Math.min(4, products.length) }, locale: context.locale, markets: context.markets }));
    }
    if (firstProduct !== undefined) {
      add(section({ type: "featured-product", id: "featured-product", position: 5, purpose: "Featured product story", settings: { productDraftId: firstProduct.id, heading: firstProduct.title }, locale: context.locale, markets: context.markets }));
    }
    add(section({ type: "rich-text", id: "brand-story", position: 6, purpose: "Brand story", settings: { heading: `The ${context.profile.brandName} Standard`, text: context.profile.brandPositioning }, locale: context.locale, markets: context.markets }));
    add(section({ type: "multicolumn", id: "benefits", position: 7, purpose: "Benefits", settings: { heading: "Why choose us" }, blocks: context.profile.trustStyle.map((trust, index) => block("benefit", `benefit-${index + 1}`, index + 1, { label: trust })), locale: context.locale, markets: context.markets }));
    if (products.length > 0) {
      add(section({ type: "featured-collection", id: "best-sellers", position: 8, purpose: "Best sellers grid", settings: { heading: "Best Sellers", productCount: Math.min(4, products.length) }, locale: context.locale, markets: context.markets }));
    }
    if (categories.length > 0) {
      add(section({ type: "collection-list", id: "categories", position: 9, purpose: "Shop by category", settings: { heading: "Shop by Category" }, blocks: categories.map((category, index) => block("category", handleize(category), index + 1, { label: category })), locale: context.locale, markets: context.markets }));
    }
    add(section({ type: "image-with-text", id: "image-with-text", position: 10, purpose: "Editorial product education", settings: { heading: context.profile.photographyDirection, requiresMerchantImage: true }, locale: context.locale, markets: context.markets, warnings: ["Image content requires merchant-approved assets."] }));
    add(section({ type: "multicolumn", id: "trust-section", position: 11, purpose: "Trust content", settings: { heading: "Shop with confidence" }, blocks: context.profile.trustStyle.map((trust, index) => block("trust", `trust-${index + 1}`, index + 1, { label: trust })), locale: context.locale, markets: context.markets }));
    add(section({ type: "multicolumn", id: "testimonials-placeholder", position: 12, purpose: "Testimonials placeholder", settings: { heading: "Customer stories", requiresVerifiedReviews: true }, locale: context.locale, markets: context.markets, warnings: ["Testimonials are placeholders only until verified merchant content exists."] }));
    add(section({ type: "newsletter", id: "newsletter", position: 13, purpose: "Newsletter signup", settings: { heading: `Join the ${context.profile.brandName} Journal`, subheading: "Exclusive tips, early releases, and members-only offers." }, locale: context.locale, markets: context.markets }));
    add(section({ type: "custom-liquid-placeholder", id: "instagram-placeholder", position: 14, purpose: "Instagram placeholder", settings: { requiresMerchantConnection: true }, locale: context.locale, markets: context.markets, warnings: ["Instagram feed requires future merchant connection."] }));
    add(section({ type: "collapsible-content", id: "faq", position: 15, purpose: "FAQ", settings: { heading: "FAQ" }, locale: context.locale, markets: context.markets }));
    add(section({ type: "footer", id: "footer", position: 16, purpose: "Footer", settings: { groups: context.profile.footerRequirements.join(", ") }, locale: context.locale, markets: context.markets }));

    return {
      templateId: "templates/index.json",
      title: `${context.profile.brandName} homepage plan`,
      seoTitle: `${context.profile.brandName} | ${context.profile.brandPositioning}`,
      metaDescription: `${context.profile.brandName} storefront plan for ${context.profile.industry}.`,
      sections,
    };
  }
}
