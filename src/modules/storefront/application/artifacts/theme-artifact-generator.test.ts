import { describe, expect, it } from "vitest";

import type { ProductDraft } from "../../../product-draft/domain/models/product-draft.model.js";
import type { StorefrontPlan, StorefrontProfile, StorefrontProject } from "../../domain/index.js";
import { ShopifyThemeMapper } from "../mapping/index.js";
import {
  CollectionPlanner,
  HomepagePlanner,
  NavigationPlanner,
  ProductPagePlanner,
} from "../planners/index.js";
import { ArtifactBundleBuilder } from "./artifact-bundle-builder.js";
import { ArtifactValidator } from "./artifact-validator.js";
import { ThemeArtifactGenerator } from "./theme-artifact-generator.js";

const generatedAt = "2026-07-30T13:30:00.000Z";

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
  toneOfVoice: ["calm", "elegant"],
  photographyDirection: "Natural product photography",
  trustStyle: ["Cruelty Free", "Natural Ingredients", "Secure Checkout"],
  targetCustomer: ["beauty shoppers"],
  merchandisingPriorities: ["best sellers"],
  navigationPreferences: ["Shop", "About", "FAQ", "Contact"],
  homepagePriorities: ["hero", "best sellers"],
  productPagePriorities: ["gallery", "benefits", "shipping"],
  footerRequirements: ["Company", "Customer Care", "Shop", "Newsletter"],
  policyPageReferences: [],
  socialLinks: [],
  contactReferences: [],
  createdAt: generatedAt,
  updatedAt: generatedAt,
};

const product = (id: string, title: string): ProductDraft => ({
  id,
  status: "approved",
  version: 1,
  source: { sourceType: "import", sourceId: id, importedAt: generatedAt },
  title,
  description: `${title} is approved for artifact preview generation.`,
  brand: "Lumora",
  category: "Body Care",
  productType: "Body Lotion",
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
  }],
  createdAt: generatedAt,
  updatedAt: generatedAt,
});

const plan = (): StorefrontPlan => {
  const products = [product("draft-1", "Velvet Glow")];
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
    metadata: { productMetafields: [], metaobjects: [] },
    themeMapping: { templates: [], sectionGroups: [], settingsFragments: [], metafieldDynamicSources: [] },
  };
};

const project = (): StorefrontProject => ({
  id: "storefront-project:artifact-test",
  tenantId: "tenant-lumora",
  storeId: "store-main",
  shopDomain: "lumora-beauty.myshopify.com",
  status: "PENDING_REVIEW",
  mode: "PLAN_ONLY",
  brandName: "Lumora Beauty",
  themeTargetReference: "PLAN_ONLY",
  selectedProductDraftIds: ["draft-1"],
  locale: "en-US",
  markets: ["US"],
  idempotencyKey: "artifact-test",
  planSnapshot: plan(),
  validationSnapshot: { errors: [], warnings: [], blockedReasons: [], requiresHumanReview: true },
  qualitySnapshot: {
    overallScore: 86,
    categoryScores: { themeMapping: 95 },
    errors: [],
    warnings: [],
    recommendations: [],
    requiresHumanReview: true,
    renderedVisualQuality: "UNKNOWN",
  },
  approvalId: "approval:storefront-project:artifact-test",
  createdAt: generatedAt,
  updatedAt: generatedAt,
  completedAt: generatedAt,
});

describe("ThemeArtifactGenerator", () => {
  it("generates deterministic preview artifacts, manifest, bundle, and validation score", () => {
    const currentProject = project();
    const mapping = new ShopifyThemeMapper().map({ projectId: currentProject.id, plan: currentProject.planSnapshot, generatedAt });
    const result = new ThemeArtifactGenerator().generate({ project: currentProject, mapping, generatedAt });

    expect(result.artifacts.map((artifact) => artifact.path)).toEqual([
      "theme-preview/theme-mapping.json",
      "theme-preview/homepage.json",
      "theme-preview/product.json",
      "theme-preview/collections.json",
      "theme-preview/navigation.json",
      "theme-preview/settings.json",
      "theme-preview/sections.json",
      "theme-preview/blocks.json",
      "theme-preview/dynamic-sources.json",
      "theme-preview/metafields.json",
      "theme-preview/metaobjects.json",
      "theme-preview/assets.json",
      "theme-preview/manifest.json",
      "theme-preview/bundle.json",
    ]);
    expect(result.validation.errors).toEqual([]);
    expect(result.validationScore).toBe(100);
    expect(result.bundle).toMatchObject({
      bundleVersion: "2026-07-30",
      projectId: currentProject.id,
      planningScore: 86,
      mappingScore: 95,
      artifactValidationScore: 100,
      artifactCount: 14,
      requiresReview: true,
    });
    expect(result.bundle.bundleHash).toHaveLength(64);
    expect(result.manifest.artifacts).toHaveLength(12);
  });

  it("validates duplicate artifact paths and broken manifest references", () => {
    const builder = new ArtifactBundleBuilder();
    const artifact = {
      kind: "HOMEPAGE_JSON" as const,
      path: "theme-preview/homepage.json",
      contentHash: "hash-a",
      payload: { ok: true },
    };
    const manifest = builder.manifest({ projectId: "storefront-project:bad", artifacts: [{ ...artifact, contentHash: "hash-b" }] });
    const result = new ArtifactValidator().validate({ artifacts: [artifact, artifact], manifest });

    expect(result.report.errors.map((error) => error.code)).toEqual(expect.arrayContaining([
      "DUPLICATE_ARTIFACT_ID",
      "BROKEN_ARTIFACT_REFERENCE",
      "MISSING_ARTIFACT",
    ]));
    expect(result.score).toBeLessThan(100);
  });
});
