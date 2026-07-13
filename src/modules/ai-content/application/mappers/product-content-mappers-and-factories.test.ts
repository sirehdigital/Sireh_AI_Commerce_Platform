import { describe, expect, it } from "vitest";
import type { NormalizedProduct, ProductAIAnalysis } from "../../../ai-product/types/product.types.js";
import { DeterministicProductContentGenerator } from "../../infrastructure/generators/index.js";
import { ProductContentInputFactory, ProductContentOptionsFactory } from "../factories/index.js";
import { MarketingToContentInputMapper, ProductContentMapper, ProductToContentInputMapper } from "./index.js";

describe("Product content mappers and factories", () => {
  it("normalizes input without mutating source data", () => {
    const source = {
      productId: " product-001 ",
      productTitle: "  Test   Product  ",
      features: [" Feature A ", "Feature A", " "],
      benefits: [" Benefit A "],
    };
    const before = JSON.stringify(source);
    const normalized = new ProductContentInputFactory().create(source);

    expect(normalized.productId).toBe("product-001");
    expect(normalized.productTitle).toBe("Test Product");
    expect(normalized.features).toEqual(["Feature A"]);
    expect(normalized.benefits).toEqual(["Benefit A"]);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("applies safe option defaults and clamps limits", () => {
    const options = new ProductContentOptionsFactory().create({
      benefitCount: 99,
      featureCount: -4,
      faqCount: Number.NaN,
      ctaCount: 99,
    });

    expect(options.channel).toBe("shopify");
    expect(options.language).toBe("en");
    expect(options.benefitCount).toBe(8);
    expect(options.featureCount).toBe(1);
    expect(options.faqCount).toBe(0);
    expect(options.ctaCount).toBe(5);
  });

  it("maps AI Product Engine output into product content input", () => {
    const mapped = new ProductToContentInputMapper().map({
      product: buildProduct(),
      analysis: buildAnalysis(),
    });

    expect(mapped.productId).toBe("normalized-001");
    expect(mapped.productTitle).toBe("Lumora Brush");
    expect(mapped.features).toContain("Variant options: Rose, White");
    expect(mapped.benefits).toContain("Multiple variants available");
    expect(mapped.marketingAudience?.primaryAudience).toBe("beauty enthusiasts");
  });

  it("merges marketing-owned input without requiring a marketing module import", () => {
    const merged = new MarketingToContentInputMapper().merge(
      {
        productId: "product-001",
        productTitle: "Test Product",
      },
      {
        valueProposition: "Clear value for shoppers",
        brandPositioning: "Practical and transparent",
        campaignId: "campaign-001",
      },
    );

    expect(merged.valueProposition).toBe("Clear value for shoppers");
    expect(merged.brandPositioning).toBe("Practical and transparent");
    expect(merged.campaignId).toBe("campaign-001");
  });

  it("maps product content package to snapshots", () => {
    const productContentPackage = new DeterministicProductContentGenerator().generate(
      {
        productId: "product-001",
        productTitle: "Test Product",
        productDescription: "A product with available details.",
      },
      new ProductContentOptionsFactory().create(),
    );
    const packageSnapshot = new ProductContentMapper().toSnapshot(
      productContentPackage,
    );

    expect(packageSnapshot.productId).toBe("product-001");
    expect(packageSnapshot.contents.length).toBe(productContentPackage.contents.length);
    expect(packageSnapshot.shopifyReady.title).toBe("Test Product");
  });
});

function buildProduct(): NormalizedProduct {
  return {
    id: "normalized-001",
    source: "manual",
    status: "draft",
    title: "Lumora Brush",
    description: "A brush for daily routines.",
    tags: ["beauty"],
    targetMarkets: ["US"],
    images: [],
    options: [{ name: "Color", values: ["Rose", "White"] }],
    variants: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function buildAnalysis(): ProductAIAnalysis {
  return {
    summary: "Ready for testing.",
    keyBenefits: ["Multiple variants available"],
    keyFeatures: ["Variant options: Rose, White"],
    audience: {
      primaryAudience: "beauty enthusiasts",
      ageRanges: [],
      customerProblems: ["finding useful tools"],
      customerDesires: ["simple routines"],
      purchaseMotivations: ["clear value"],
      objections: ["delivery timing"],
      recommendedMarkets: ["US"],
    },
    marketingAngles: [],
    score: {
      demand: 70,
      competition: 60,
      profitability: 75,
      trend: 65,
      supplierReliability: 70,
      shipping: 70,
      marketingPotential: 80,
      brandability: 75,
      overall: 72,
    },
    risks: {
      level: "medium",
      score: 40,
      reasons: ["Delivery should be clear"],
      intellectualPropertyRisk: 10,
      restrictedProductRisk: 10,
      supplierRisk: 40,
      shippingRisk: 40,
      refundRisk: 20,
    },
    recommendation: "test",
    reasoning: "Good enough to test.",
    analyzedAt: new Date("2026-01-01T00:00:00.000Z"),
    model: "SACP Rule Engine v1",
  };
}
