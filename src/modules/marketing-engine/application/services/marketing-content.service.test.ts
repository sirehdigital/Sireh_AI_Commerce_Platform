import { describe, expect, it } from "vitest";

import { MarketingEngineValidationError } from "../../domain/errors/marketing-engine.errors.js";
import type { MarketingContentInput } from "../../domain/models/marketing-content.model.js";
import { MarketingContentService } from "./marketing-content.service.js";

const buildInput = (overrides: Partial<MarketingContentInput> = {}): MarketingContentInput => ({
  productTitle: "  Glow Lift Facial Wand  ",
  productType: "Beauty Device",
  category: "Skin Care Tools",
  keyBenefits: [
    "helps customers create a calmer evening routine",
    "supports a refreshed look before daily plans",
    "guaranteed instant results",
  ],
  features: ["USB-C charging", "compact travel size", "three comfort modes"],
  targetAudience: "busy beauty shoppers",
  brandName: "Lumora Beauty",
  targetMarket: "US",
  keywords: ["Beauty Device", "skin care", "Skin Care", "evening routine", " "],
  tone: "friendly",
  productUrl: "https://store.test/products/glow-lift",
  ...overrides,
});

const unsupportedClaimPattern = /guaranteed|instant results|cure|clinically proven|doctor approved|fda approved/iu;

describe("MarketingContentService", () => {
  it("generates full marketing content from normalized input", () => {
    const service = new MarketingContentService();

    const content = service.generate(buildInput());

    expect(content).toMatchObject({
      productTitle: "Glow Lift Facial Wand",
      callToAction: "Explore it here: https://store.test/products/glow-lift",
    });
    expect(content.productDescription.length).toBeGreaterThan(0);
    expect(content.seoTitle.length).toBeGreaterThan(0);
    expect(content.seoDescription.length).toBeGreaterThan(0);
    expect(content.facebookCaption.length).toBeGreaterThan(0);
    expect(content.instagramCaption.length).toBeGreaterThan(0);
    expect(content.tiktokCaption.length).toBeGreaterThan(0);
    expect(content.emailSubject.length).toBeGreaterThan(0);
    expect(content.emailBody.length).toBeGreaterThan(0);
  });

  it("prioritizes benefits before features in product description", () => {
    const service = new MarketingContentService();

    const content = service.generate(buildInput());

    expect(content.productDescription).toContain("helps customers create a calmer evening routine");
    expect(content.productDescription).toContain("USB-C charging");
    expect(content.productDescription.indexOf("helps customers create")).toBeLessThan(
      content.productDescription.indexOf("USB-C charging"),
    );
  });

  it("keeps SEO output useful and within sensible limits", () => {
    const service = new MarketingContentService();

    const content = service.generate(
      buildInput({
        productTitle: "Glow Lift Facial Wand With Compact Beauty Routine Support For Daily Skincare Merchandising",
      }),
    );

    expect(content.seoTitle.length).toBeLessThanOrEqual(60);
    expect(content.seoDescription.length).toBeLessThanOrEqual(155);
    expect(content.seoTitle).toContain("Glow Lift");
    expect(content.seoDescription).toContain("Lumora Beauty");
  });

  it("creates platform-specific social captions", () => {
    const service = new MarketingContentService();

    const content = service.generate(buildInput());

    expect(content.facebookCaption).toContain("without overcomplicating the routine");
    expect(content.instagramCaption).toContain("Built for busy beauty shoppers");
    expect(content.tiktokCaption).toContain("A quick look at Glow Lift Facial Wand");
  });

  it("creates email subject and body with product URL when available", () => {
    const service = new MarketingContentService();

    const content = service.generate(buildInput());

    expect(content.emailSubject).toContain("Glow Lift Facial Wand");
    expect(content.emailBody).toContain("Meet Glow Lift Facial Wand from Lumora Beauty");
    expect(content.emailBody).toContain("See product details: https://store.test/products/glow-lift");
  });

  it("deduplicates tags and removes unsupported claims from generated copy", () => {
    const service = new MarketingContentService();

    const content = service.generate(buildInput());

    expect(content.productTags).toEqual([
      "lumora beauty",
      "us",
      "beauty device",
      "helps customers create a calmer evening routine",
      "supports a refreshed look before daily plans",
      "designed a simple routine",
      "skin care",
      "evening routine",
    ]);
    expect(JSON.stringify(content)).not.toMatch(unsupportedClaimPattern);
  });

  it("rejects invalid required input", () => {
    const service = new MarketingContentService();

    expect(() => service.generate(buildInput({ productTitle: " " }))).toThrow(MarketingEngineValidationError);
    expect(() => service.generate(buildInput({ keyBenefits: [] }))).toThrow(MarketingEngineValidationError);
    expect(() => service.generate(buildInput({ targetAudience: " " }))).toThrow(MarketingEngineValidationError);
  });

  it("does not mutate input data", () => {
    const service = new MarketingContentService();
    const input = buildInput();
    const snapshot = JSON.stringify(input);

    service.generate(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
