import { describe, expect, it } from "vitest";
import { SEOContentOptionsFactory } from "../../application/factories/index.js";
import type { SEOContentGenerationInput } from "../../application/dto/index.js";
import { DeterministicSEOContentGenerator } from "./deterministic-seo-content.generator.js";

describe("DeterministicSEOContentGenerator", () => {
  it("generates deterministic SEO output for identical input", () => {
    const generator = new DeterministicSEOContentGenerator();
    const options = new SEOContentOptionsFactory().create();
    const first = generator.generate(buildSEOInput(), options);
    const second = generator.generate(buildSEOInput(), options);

    expect(first.keywords).toEqual(second.keywords);
    expect(first.metaTitle.value).toBe(second.metaTitle.value);
    expect(first.metaDescription.value).toBe(second.metaDescription.value);
    expect(first.slug.value).toBe(second.slug.value);
  });

  it("generates primary, secondary, long-tail and semantic keywords with limits", () => {
    const result = new DeterministicSEOContentGenerator().generate(
      buildSEOInput(),
      new SEOContentOptionsFactory().create({
        preferredPrimaryKeyword: "Lumora facial cleansing brush",
        maxSecondaryKeywords: 3,
        maxLongTailKeywords: 2,
      }),
    );

    expect(result.keywords.primaryKeyword.value).toBe("lumora facial cleansing brush");
    expect(result.keywords.secondaryKeywords).toHaveLength(3);
    expect(result.keywords.longTailKeywords).toHaveLength(2);
    expect(result.keywords.semanticVariants.length).toBeGreaterThan(0);
  });

  it("generates valid metadata, slug, h1 and h2 headings", () => {
    const result = new DeterministicSEOContentGenerator().generate(
      buildSEOInput(),
      new SEOContentOptionsFactory().create(),
    );

    expect(result.metaTitle.value.toLowerCase()).toContain(result.keywords.primaryKeyword.value);
    expect(result.metaDescription.value.toLowerCase()).toContain(result.keywords.primaryKeyword.value);
    expect(result.slug.value).toMatch(/^[a-z0-9-]+$/u);
    expect(result.h1.toLowerCase()).toContain(result.keywords.primaryKeyword.value);
    expect(result.h2Headings.length).toBeGreaterThan(1);
    expect(new Set(result.h2Headings).size).toBe(result.h2Headings.length);
  });

  it("supports Malay SEO metadata without external translation", () => {
    const result = new DeterministicSEOContentGenerator().generate(
      buildSEOInput(),
      new SEOContentOptionsFactory().create({ language: "ms", channel: "website" }),
    );

    expect(result.language).toBe("ms");
    expect(result.metaDescription.value).toContain("untuk");
    expect(result.seoSummary).toContain("diposisikan");
  });

  it("generates Shopify, website and generic channel output", () => {
    const generator = new DeterministicSEOContentGenerator();

    for (const channel of ["shopify", "website", "generic"] as const) {
      const result = generator.generate(buildSEOInput(), new SEOContentOptionsFactory().create({ channel }));

      expect(result.channel).toBe(channel);
      expect(result.contents.every((content) => content.snapshot().channel === channel)).toBe(true);
    }
  });

  it("generates structured-data hints without fabricated ratings or review counts", () => {
    const result = new DeterministicSEOContentGenerator().generate(
      buildSEOInput(),
      new SEOContentOptionsFactory().create(),
    );
    const hintText = JSON.stringify(result.structuredDataHints).toLowerCase();

    expect(result.structuredDataHints.map((hint) => hint.type)).toContain("Product");
    expect(result.structuredDataHints.map((hint) => hint.type)).toContain("Brand");
    expect(hintText).not.toContain("rating");
    expect(hintText).not.toContain("review");
  });

  it("returns warnings instead of pretending live SEO data exists", () => {
    const result = new DeterministicSEOContentGenerator().generate(
      {
        productId: "minimal-seo-001",
        productTitle: "Simple Storage Box",
      },
      new SEOContentOptionsFactory().create(),
    );

    expect(result.warnings).toContain("Product description is missing; SEO summary uses available structured facts.");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("search volume");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("cpc");
  });

  it("does not mutate source input", () => {
    const input = buildSEOInput();
    const before = JSON.stringify(input);

    new DeterministicSEOContentGenerator().generate(input, new SEOContentOptionsFactory().create());

    expect(JSON.stringify(input)).toBe(before);
  });
});

export function buildSEOInput(): SEOContentGenerationInput {
  return {
    productId: "seo-product-001",
    productTitle: "Radiance Facial Cleansing Brush",
    productSubtitle: "Daily skincare tool",
    brand: "Lumora",
    category: "Beauty Care",
    productType: "Facial Cleansing Brush",
    productDescription: "A silicone cleansing brush designed for daily face-care routines.",
    benefits: ["Supports a simple cleansing routine", "Easy to position for beauty shoppers"],
    features: ["Soft silicone touchpoints", "Daily routine use", "Two color options"],
    tags: ["beauty", "skincare"],
    targetMarkets: ["US", "UK"],
    productKeywords: ["facial cleansing brush", "beauty cleansing tool"],
    marketingAudience: {
      primaryAudience: "beauty enthusiasts",
      customerProblems: ["finding simple skincare tools"],
      purchaseMotivations: ["clear product benefits"],
    },
    marketingAngles: [{ title: "Daily routine", coreBenefit: "simple cleansing routine" }],
    valueProposition: "a practical tool for daily cleansing routines",
    campaignId: "campaign-001",
    sourceMarketingAnalysisId: "marketing-001",
    correlationId: "correlation-001",
  };
}
