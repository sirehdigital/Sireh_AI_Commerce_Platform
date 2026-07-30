import { describe, expect, it } from "vitest";

import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { StorefrontPlan, StorefrontProfile } from "../../domain/index.js";
import {
  CollectionPlanner,
  HomepagePlanner,
  NavigationPlanner,
  ProductPagePlanner,
} from "../planners/index.js";
import { ShopifyThemeMapper } from "./shopify-theme-mapper.js";
import { ThemeMappingValidator } from "./theme-mapping-validator.js";

const profile: StorefrontProfile = {
  id: "profile-lumora",
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
  version: 1,
  brandName: "Lumora Beauty",
  brandPositioning: "Premium skincare inspired by nature.",
  targetMarkets: ["US"],
  defaultLocale: "en-US",
  supportedLocales: ["en-US"],
  currency: "USD",
  industry: "beauty",
  visualIdentity: ["cream", "beige", "soft gold", "olive green", "white"],
  preferredColorPalette: ["#111111", "#FFFFFF", "#D9B99B", "#4C7A5A"],
  typographyDirection: "Premium editorial hierarchy",
  toneOfVoice: ["calm", "elegant", "trustworthy"],
  photographyDirection: "Natural product-led beauty photography",
  trustStyle: ["Cruelty Free", "Natural Ingredients", "Fast Shipping"],
  targetCustomer: ["beauty shoppers"],
  merchandisingPriorities: ["best sellers", "body care"],
  navigationPreferences: ["Shop", "About", "FAQ", "Contact"],
  homepagePriorities: ["hero", "best sellers", "newsletter"],
  productPagePriorities: ["gallery", "benefits", "shipping"],
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
  description: `${title} is approved for theme mapping.`,
  brand: "Lumora",
  category: "Body Care",
  productType,
  tags: ["premium", "natural", "glow"],
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
  seo: { title, description: `${title} from Lumora Beauty.`, handle: title.toLowerCase().replace(/\s+/gu, "-") },
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
});

const plan = (): StorefrontPlan => {
  const products = [product("draft-1", "Velvet Glow"), product("draft-2", "Silk Wash", "Body Wash")];
  const context = {
    profile,
    products,
    mediaReferencesByProductId: {},
    locale: "en-US",
    markets: ["US"],
  };
  return {
    profile,
    homepage: new HomepagePlanner().plan(context),
    productPages: new ProductPagePlanner().plan(context),
    collections: new CollectionPlanner().plan(context),
    navigation: new NavigationPlanner().plan(context),
    metadata: {
      productMetafields: [],
      metaobjects: [],
    },
    themeMapping: {
      templates: [],
      sectionGroups: [],
      settingsFragments: [],
      metafieldDynamicSources: [],
    },
  };
};

describe("ShopifyThemeMapper", () => {
  it("maps homepage, products, collections, navigation, settings, metadata, and preview artifacts deterministically", () => {
    const mapping = new ShopifyThemeMapper().map({
      projectId: "storefront-project:test",
      plan: plan(),
      generatedAt: "2026-07-30T12:00:00.000Z",
    });

    expect(mapping.homepage.path).toBe("templates/index.json");
    expect(mapping.homepage.sections.map((section) => section.type)).toEqual(expect.arrayContaining(["announcement-bar", "header", "image-banner", "featured-collection"]));
    expect(mapping.homepage.order).toEqual(mapping.homepage.sections.map((section) => section.id));
    expect(mapping.products).toHaveLength(2);
    expect(mapping.products[0]?.sections.some((section) => section.blocks.some((block) => block.dynamicSources.length > 0))).toBe(true);
    expect(mapping.collections.map((collection) => collection.templateType)).toEqual(expect.arrayContaining(["collection"]));
    expect(mapping.navigation.mainMenu.map((item) => item.label)).toEqual(expect.arrayContaining(["Shop", "About", "FAQ", "Contact"]));
    expect(mapping.settings.brandColors.primary).toBe("#111111");
    expect(mapping.metafields.map((field) => field.dynamicSource)).toEqual(expect.arrayContaining(["custom.benefits"]));
    expect(mapping.metaobjects.map((item) => item.type)).toEqual(expect.arrayContaining(["trust_badge"]));
    expect(mapping.previewArtifacts.map((artifact) => artifact.path)).toEqual(expect.arrayContaining([
      "theme-preview/theme-mapping.json",
      "theme-preview/homepage.json",
      "theme-preview/products.json",
      "theme-preview/collections.json",
      "theme-preview/navigation.json",
      "theme-preview/settings.json",
      "theme-preview/metafields.json",
      "theme-preview/metaobjects.json",
    ]));
    expect(mapping.validation.errors).toEqual([]);
    expect(mapping.validation.requiresHumanReview).toBe(true);
  });

  it("validates invalid navigation references and broken dynamic sources", () => {
    const mapping = new ShopifyThemeMapper().map({
      projectId: "storefront-project:test",
      plan: plan(),
      generatedAt: "2026-07-30T12:00:00.000Z",
    });
    const validation = new ThemeMappingValidator().validate({
      ...mapping,
      navigation: {
        ...mapping.navigation,
        mainMenu: [{ id: "bad", label: "Bad", handle: "bad", url: "https://example.test", order: 1 }],
      },
      homepage: {
        ...mapping.homepage,
        sections: [{
          ...mapping.homepage.sections[0]!,
          dynamicSources: ["section.settings..heading"],
        }],
      },
    });

    expect(validation.errors.map((error) => error.code)).toEqual(expect.arrayContaining(["INVALID_REFERENCES", "BROKEN_DYNAMIC_SOURCES"]));
  });
});
