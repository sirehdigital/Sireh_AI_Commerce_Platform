import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { ProductPagePlan, StorefrontBlock, StorefrontSection } from "../../domain/index.js";
import { block, handleize, section } from "./planner-utils.js";
import type { StorefrontPlanningContext } from "./storefront-planning.types.js";

export class ProductPagePlanner {
  public plan(context: StorefrontPlanningContext): readonly ProductPagePlan[] {
    return context.products.map((product) => this.planProduct(context, product));
  }

  private planProduct(context: StorefrontPlanningContext, product: ProductDraft): ProductPagePlan {
    const mediaReferences = context.mediaReferencesByProductId[product.id] ?? product.images.filter((image) => image.selected).map((image) => image.id ?? image.sourceUrl);
    const blocks: StorefrontBlock[] = [
      block("media-gallery", "media-gallery", 1, { mediaCount: mediaReferences.length }),
      block("title", "title", 2, { text: product.title }),
      block("price", "pricing", 3, { currency: product.variants[0]?.sellingPrice.currency ?? context.profile.currency }),
      block("description", "description", 4, { source: "productDraft.description" }),
      block("benefits", "benefits", 5, { count: this.benefits(product).length }),
      block("how-to-use", "how-to-use", 6, { source: "merchant-verified-content-required" }),
      block("specifications", "specifications", 7, { variants: product.variants.length }),
      block("shipping-summary", "shipping-summary", 8, { available: product.shipping !== undefined }),
      block("faq", "faq", 9, { requiresMerchantContent: true }),
      block("trust-content", "trust-content", 10, { count: context.profile.trustStyle.length }),
      block("related-products", "related-products", 11, { source: "same-category-approved-products" }),
      block("sticky-add-to-cart", "sticky-add-to-cart", 12, { enabled: true }),
      block("mobile-purchase-bar", "mobile-purchase-bar", 13, { enabled: true }),
      block("accordion-sections", "accordion-sections", 14, { sections: "description,benefits,shipping,faq" }),
    ];
    const sections: StorefrontSection[] = [
      section({ type: "main-product", id: `product-${product.id}`, position: 1, purpose: "Product purchase experience", settings: { productDraftId: product.id, mediaReferences: mediaReferences.join(",") }, blocks, locale: context.locale, markets: context.markets }),
      section({ type: "related-products", id: `related-${product.id}`, position: 2, purpose: "Related approved products", settings: { category: product.productType ?? product.category ?? "general" }, locale: context.locale, markets: context.markets }),
    ];

    return {
      templateId: `templates/product.${handleize(product.title)}.json`,
      productDraftId: product.id,
      handle: product.seo?.handle ?? handleize(product.title),
      title: product.title,
      blocks,
      sections,
      seoTitle: product.seo?.title ?? product.title,
      metaDescription: product.seo?.description ?? product.description.slice(0, 155),
      structuredDataIntent: "PRODUCT_WITHOUT_REVIEWS",
    };
  }

  private benefits(product: ProductDraft): readonly string[] {
    return [
      product.branding?.valueProposition,
      ...product.tags.filter((tag) => /benefit|soft|glow|hydrating|premium|natural|secure|fast/iu.test(tag)),
    ].filter((value): value is string => value !== undefined && value.trim().length > 0);
  }
}
