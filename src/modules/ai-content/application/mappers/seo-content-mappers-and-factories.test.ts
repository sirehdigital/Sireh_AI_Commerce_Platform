import { describe, expect, it } from "vitest";
import type { NormalizedProduct } from "../../../ai-product/types/product.types.js";
import type { ProductContentPackage } from "../dto/index.js";
import { DeterministicSEOContentGenerator } from "../../infrastructure/generators/index.js";
import { SEOContentInputFactory, SEOContentOptionsFactory } from "../factories/index.js";
import {
  MarketingToSEOInputMapper,
  ProductContentToSEOInputMapper,
  ProductToSEOInputMapper,
  SEOContentMapper,
} from "./index.js";
import { buildSEOInput } from "../../infrastructure/generators/deterministic-seo-content.generator.test.js";

describe("SEO content mappers and factories", () => {
  it("normalizes SEO input and applies safe option defaults", () => {
    const source = {
      productId: " seo-001 ",
      productTitle: "  Test   Product  ",
      productKeywords: [" Keyword A ", "Keyword A", " "],
    };
    const before = JSON.stringify(source);
    const input = new SEOContentInputFactory().create(source);
    const options = new SEOContentOptionsFactory().create({
      maxSecondaryKeywords: 99,
      maxLongTailKeywords: -1,
    });

    expect(input.productId).toBe("seo-001");
    expect(input.productTitle).toBe("Test Product");
    expect(input.productKeywords).toEqual(["Keyword A"]);
    expect(options.maxSecondaryKeywords).toBe(12);
    expect(options.maxLongTailKeywords).toBe(0);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("maps product content package into SEO input", () => {
    const productContentPackage: ProductContentPackage = {
      productId: "product-content-001",
      channel: "shopify",
      language: "en",
      tone: "friendly",
      title: fakeContent("Product Title"),
      subtitle: fakeContent("Subtitle"),
      shortDescription: fakeContent("Short"),
      longDescription: fakeContent("Long description"),
      benefits: [fakeContent("Benefit one")],
      features: [fakeContent("Feature one")],
      highlights: [],
      problemStatement: fakeContent("Problem"),
      solutionStatement: fakeContent("Solution"),
      valueProposition: fakeContent("Value"),
      targetAudienceStatement: fakeContent("Audience"),
      brandPositioningStatement: fakeContent("Brand"),
      faq: [],
      callsToAction: [],
      shopifyReady: {
        title: "Product Title",
        subtitle: "Subtitle",
        descriptionHtml: "<p>Long</p>",
        benefits: ["Benefit one"],
        features: ["Feature one"],
        highlights: [],
        callsToAction: [],
      },
      contents: [],
      generatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    const mapped = new ProductContentToSEOInputMapper().map(productContentPackage);

    expect(mapped.productId).toBe("product-content-001");
    expect(mapped.productTitle).toBe("Product Title");
    expect(mapped.benefits).toEqual(["Benefit one"]);
  });

  it("maps product and marketing data into SEO input without SDK coupling", () => {
    const mappedProduct = new ProductToSEOInputMapper().map({ product: buildProduct() });
    const merged = new MarketingToSEOInputMapper().merge(mappedProduct, {
      valueProposition: "Clear value",
      searchIntentHints: ["commercial"],
      campaignId: "campaign-001",
    });

    expect(mappedProduct.productId).toBe("normalized-seo-001");
    expect(merged.valueProposition).toBe("Clear value");
    expect(merged.searchIntentHints).toEqual(["commercial"]);
    expect(merged.campaignId).toBe("campaign-001");
  });

  it("maps SEO content package into a compact snapshot", () => {
    const seoPackage = new DeterministicSEOContentGenerator().generate(
      buildSEOInput(),
      new SEOContentOptionsFactory().create(),
    );
    const snapshot = new SEOContentMapper().toSnapshot(seoPackage);

    expect(snapshot.productId).toBe("seo-product-001");
    expect(snapshot.primaryKeyword).toBe(seoPackage.keywords.primaryKeyword.value);
    expect(snapshot.contentIds).toHaveLength(seoPackage.contents.length);
  });
});

function fakeContent(body: string): ProductContentPackage["title"] {
  return {
    id: `fake:${body}`,
    snapshot: () => ({ body }),
  } as never;
}

function buildProduct(): NormalizedProduct {
  return {
    id: "normalized-seo-001",
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
