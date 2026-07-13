import { describe, expect, it } from "vitest";
import { ProductContentOptionsFactory } from "../../application/factories/index.js";
import { DeterministicProductContentGenerator } from "./deterministic-product-content.generator.js";
import type { ProductContentGenerationInput } from "../../application/dto/index.js";

describe("DeterministicProductContentGenerator", () => {
  it("produces deterministic text output for identical input and options", () => {
    const generator = new DeterministicProductContentGenerator();
    const options = new ProductContentOptionsFactory().create();
    const first = generator.generate(buildInput(), options);
    const second = generator.generate(buildInput(), options);

    expect(first.shopifyReady).toEqual(second.shopifyReady);
    expect(first.contents.map((content) => content.snapshot().body)).toEqual(
      second.contents.map((content) => content.snapshot().body),
    );
  });

  it("generates valid English Shopify content with limits", () => {
    const productContentPackage = new DeterministicProductContentGenerator().generate(
      buildInput(),
      new ProductContentOptionsFactory().create({
        channel: "shopify",
        language: "en",
        benefitCount: 2,
        featureCount: 3,
        faqCount: 2,
        ctaCount: 2,
      }),
    );

    expect(productContentPackage.title.snapshot().headline.value).toContain("Lumora");
    expect(productContentPackage.channel).toBe("shopify");
    expect(productContentPackage.language).toBe("en");
    expect(productContentPackage.benefits).toHaveLength(2);
    expect(productContentPackage.features).toHaveLength(3);
    expect(productContentPackage.faq).toHaveLength(2);
    expect(productContentPackage.callsToAction.map((content) => content.snapshot().cta?.value)).toEqual([
      "Add to cart",
      "View product",
    ]);
  });

  it("generates coherent Malay website content", () => {
    const productContentPackage = new DeterministicProductContentGenerator().generate(
      buildInput(),
      new ProductContentOptionsFactory().create({
        channel: "website",
        language: "ms",
        tone: "professional",
      }),
    );

    expect(productContentPackage.language).toBe("ms");
    expect(productContentPackage.tone).toBe("professional");
    expect(productContentPackage.shortDescription.snapshot().body).toContain("disusun");
    expect(productContentPackage.callsToAction[0]?.snapshot().cta?.value).toBe("Ketahui produk ini");
  });

  it("supports generic channel output and content tone metadata", () => {
    const productContentPackage = new DeterministicProductContentGenerator().generate(
      buildInput(),
      new ProductContentOptionsFactory().create({
        channel: "generic",
        tone: "educational",
      }),
    );

    expect(productContentPackage.channel).toBe("generic");
    expect(productContentPackage.contents.every((content) => content.snapshot().tone === "educational")).toBe(
      true,
    );
  });

  it("respects desired length options", () => {
    const generator = new DeterministicProductContentGenerator();
    const shortPackage = generator.generate(
      buildInput(),
      new ProductContentOptionsFactory().create({ desiredLength: "short" }),
    );
    const longPackage = generator.generate(
      buildInput(),
      new ProductContentOptionsFactory().create({ desiredLength: "long" }),
    );

    expect(longPackage.longDescription.snapshot().body.length).toBeGreaterThan(
      shortPackage.longDescription.snapshot().body.length,
    );
  });

  it("handles missing optional data without fabricating reviews, ratings or certifications", () => {
    const productContentPackage = new DeterministicProductContentGenerator().generate(
      {
        productId: "minimal-001",
        productTitle: "Simple Storage Box",
      },
      new ProductContentOptionsFactory().create({ faqCount: 8 }),
    );
    const text = productContentPackage.contents.map((content) => content.snapshot().body).join(" ");

    expect(text.toLowerCase()).not.toContain("review");
    expect(text.toLowerCase()).not.toContain("rated");
    expect(text.toLowerCase()).not.toContain("certified");
    expect(text.toLowerCase()).not.toContain("guaranteed");
    expect(productContentPackage.faq.length).toBeGreaterThan(0);
  });

  it("does not mutate input objects", () => {
    const input = buildInput();
    const before = JSON.stringify(input);

    new DeterministicProductContentGenerator().generate(input, new ProductContentOptionsFactory().create());

    expect(JSON.stringify(input)).toBe(before);
  });
});

function buildInput(): ProductContentGenerationInput {
  return {
    productId: "product-001",
    productTitle: "Radiance Facial Cleansing Brush",
    productDescription: "A silicone cleansing brush designed for daily face-care routines.",
    brand: "Lumora",
    category: "Beauty Care",
    productType: "Facial Cleansing Brush",
    features: ["Soft silicone touchpoints", "Daily routine use", "Two color options"],
    benefits: ["Supports a simple cleansing routine", "Easy to position for beauty shoppers"],
    tags: ["beauty", "skincare"],
    supplier: {
      supplierName: "ClearGlow Supplies",
      shippingOrigin: "MY",
      estimatedDeliveryDaysMin: 6,
      estimatedDeliveryDaysMax: 12,
    },
    targetMarkets: ["US", "UK"],
    productAnalysis: {
      summary: "Product readiness is supported by clear visuals and variants.",
      keyBenefits: ["Multiple variants available"],
      keyFeatures: ["Variant options: Rose, White"],
      recommendation: "test",
      reasoning: "Moderate risk with useful product detail.",
    },
    productRisk: {
      level: "medium",
      reasons: ["Supplier delivery should be communicated clearly"],
    },
    marketingAudience: {
      primaryAudience: "beauty enthusiasts",
      customerProblems: ["finding simple skincare tools"],
      customerDesires: ["a practical daily routine"],
      purchaseMotivations: ["clear product benefits"],
      objections: ["delivery timing uncertainty"],
    },
    valueProposition: "a practical tool for daily cleansing routines",
    marketingAngles: [
      {
        title: "Daily Routine",
        hook: "Make everyday cleansing easier",
        coreBenefit: "Designed for repeat daily use",
        targetAudience: "beauty enthusiasts",
      },
    ],
  };
}
