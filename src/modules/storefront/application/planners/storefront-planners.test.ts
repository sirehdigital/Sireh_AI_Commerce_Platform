import { describe, expect, it } from "vitest";

import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { StorefrontProfile } from "../../domain/index.js";
import {
  CollectionPlanner,
  HomepagePlanner,
  NavigationPlanner,
  PlanningScoreCalculator,
  PlanningValidator,
  ProductPagePlanner,
} from "./index.js";
import type { StorefrontPlanningContext } from "./storefront-planning.types.js";

const profile: StorefrontProfile = {
  id: "profile-1",
  tenantId: "tenant",
  storeId: "store",
  shopDomain: "lumora-beauty.myshopify.com",
  version: 1,
  brandName: "Lumora Beauty",
  brandPositioning: "Premium skincare inspired by nature.",
  targetMarkets: ["US"],
  defaultLocale: "en-US",
  supportedLocales: ["en-US"],
  currency: "USD",
  industry: "beauty",
  visualIdentity: ["cream", "soft gold", "olive green"],
  preferredColorPalette: ["#111111", "#FFFFFF", "#D9B99B"],
  typographyDirection: "Premium editorial",
  toneOfVoice: ["calm", "trustworthy"],
  photographyDirection: "Clean product photography",
  trustStyle: ["Fast Shipping", "Secure Checkout", "30-Day Satisfaction"],
  targetCustomer: ["beauty shoppers"],
  merchandisingPriorities: ["best sellers"],
  navigationPreferences: ["Shop", "About", "FAQ", "Contact"],
  homepagePriorities: ["hero", "best sellers"],
  productPagePriorities: ["gallery", "add to cart"],
  footerRequirements: ["Company", "Customer Care", "Shop", "Newsletter"],
  policyPageReferences: [],
  socialLinks: [],
  contactReferences: [],
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

const product = (id: string, title: string, productType = "Body Lotion"): ProductDraft => ({
  id,
  status: "approved",
  version: 1,
  source: { sourceType: "import", sourceId: id, importedAt: "2026-07-30T00:00:00.000Z" },
  title,
  description: `${title} is a premium approved product draft with deterministic storefront data.`,
  brand: "Lumora",
  category: "Body Care",
  productType,
  tags: ["premium", "natural"],
  targetMarkets: ["US"],
  images: [{ id: `${id}-image`, sourceUrl: `https://images.test/${id}.jpg`, altText: title, position: 1, selected: true, primary: true }],
  variants: [{
    id: `${id}-variant`,
    title: "Default Title",
    options: [{ name: "Title", value: "Default Title" }],
    supplierPrice: { amount: 8, currency: "USD" },
    sellingPrice: { amount: 24, currency: "USD" },
    available: true,
    inventoryQuantity: 10,
  }],
  shipping: { minimumDeliveryDays: 3, maximumDeliveryDays: 7, shipsToCountries: ["US"] },
  seo: { title, description: `${title} from Lumora Beauty.`, handle: title.toLowerCase().replace(/\s+/gu, "-") },
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
});

const context: StorefrontPlanningContext = {
  profile,
  products: [product("draft-1", "Velvet Glow"), product("draft-2", "Silk Wash", "Body Wash")],
  mediaReferencesByProductId: {},
  locale: "en-US",
  markets: ["US"],
};

describe("storefront planners", () => {
  it("plans homepage sections from brand profile and approved products", () => {
    const plan = new HomepagePlanner().plan(context);

    expect(plan.sections.map((section) => section.type)).toEqual(expect.arrayContaining([
      "announcement-bar",
      "header",
      "hero-banner",
      "featured-collection",
      "featured-product",
      "collection-list",
      "newsletter",
      "footer",
    ]));
    expect(plan.sections.find((section) => section.id === "sf-testimonials-placeholder")?.validationWarnings).toHaveLength(1);
  });

  it("plans product pages without fake reviews, ratings, ingredients, or medical claims", () => {
    const [page] = new ProductPagePlanner().plan(context);

    expect(page?.blocks.map((block) => block.type)).toEqual(expect.arrayContaining([
      "media-gallery",
      "price",
      "sticky-add-to-cart",
      "mobile-purchase-bar",
      "accordion-sections",
    ]));
    expect(page?.blocks.map((block) => block.type)).not.toEqual(expect.arrayContaining(["reviews", "ratings", "ingredients"]));
    expect(JSON.stringify(page)).not.toMatch(/cure|treat|heal/iu);
  });

  it("plans collections and navigation with deterministic validation", () => {
    const collections = new CollectionPlanner().plan(context);
    const navigation = new NavigationPlanner().plan(context);

    expect(collections.map((collection) => collection.title)).toEqual(["Best Sellers", "Body Lotion", "Body Wash"]);
    expect(collections[0]?.sections.map((section) => section.type)).toEqual(expect.arrayContaining([
      "main-collection-banner",
      "main-collection-product-grid",
      "empty-state",
    ]));
    expect(navigation.mainMenu.map((item) => item.label)).toEqual(expect.arrayContaining(["Shop", "About", "FAQ", "Contact"]));
    expect(navigation.validationWarnings).toEqual([]);
  });

  it("validates required planning surfaces and calculates stable scores", () => {
    const homepage = new HomepagePlanner().plan(context);
    const productPages = new ProductPagePlanner().plan(context);
    const collections = new CollectionPlanner().plan(context);
    const navigation = new NavigationPlanner().plan(context);
    const plan = {
      profile,
      homepage,
      productPages,
      collections,
      navigation,
      metadata: { productMetafields: [], metaobjects: [] },
      themeMapping: { templates: [], sectionGroups: [], settingsFragments: [], metafieldDynamicSources: [] },
    };
    const validation = new PlanningValidator().validate(plan);
    const score = new PlanningScoreCalculator().score(plan, validation);

    expect(validation.errors).toEqual([]);
    expect(validation.requiresHumanReview).toBe(true);
    expect(score.homepage).toBe(100);
    expect(score.navigation).toBe(95);
    expect(typeof score.overall).toBe("number");
    expect(score.overall).toBeGreaterThan(70);
  });
});
