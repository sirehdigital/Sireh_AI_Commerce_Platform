import { describe, expect, it } from "vitest";
import type { SocialMediaContentGenerationInput } from "../../application/dto/index.js";
import { SocialMediaContentOptionsFactory } from "../../application/factories/index.js";
import { DeterministicSocialMediaContentGenerator } from "./deterministic-social-media-content.generator.js";

export function buildSocialInput(): SocialMediaContentGenerationInput {
  return {
    productId: "product-001",
    productTitle: "Glow Daily Serum",
    brand: "Sireh Beauty",
    category: "Beauty",
    productType: "Face serum",
    productDescription: "A lightweight daily serum for a simple skincare routine.",
    benefits: ["supports a smoother daily routine", "fits clean morning and evening use"],
    features: ["lightweight texture", "daily-use format"],
    highlights: ["Simple routine support", "Lightweight product format"],
    targetAudience: {
      primaryAudience: "beauty enthusiasts",
      customerProblems: ["finding a simple skincare step"],
      purchaseMotivations: ["easy daily use"],
    },
    valueProposition: "A clear skincare step for everyday routines.",
    targetMarkets: ["US", "MY"],
    tags: ["skincare", "serum"],
    campaignId: "campaign-001",
    correlationId: "correlation-001",
  };
}

describe("DeterministicSocialMediaContentGenerator", () => {
  const generator = new DeterministicSocialMediaContentGenerator();
  const optionsFactory = new SocialMediaContentOptionsFactory();

  it("generates deterministic output for the same input and options", () => {
    const input = buildSocialInput();
    const options = optionsFactory.create({ platform: "instagram", includeCarouselContent: true });
    const first = generator.generate(input, options);
    const second = generator.generate(input, options);

    expect(first.primaryCaption).toBe(second.primaryCaption);
    expect(first.hashtags).toEqual(second.hashtags);
    expect(first.generatedAt).toBeInstanceOf(Date);
  });

  it.each(["facebook", "instagram", "tiktok", "linkedin", "x", "youtube", "generic"] as const)(
    "generates platform-aware %s content",
    (platform) => {
      const result = generator.generate(buildSocialInput(), optionsFactory.create({ platform }));

      expect(result.platform).toBe(platform);
      expect(result.contents.length).toBeGreaterThan(1);
      expect(result.hashtags.length).toBeLessThanOrEqual(platform === "instagram" ? 12 : 6);
    },
  );

  it.each(["awareness", "engagement", "traffic", "conversion", "education", "product-launch"] as const)(
    "supports the %s objective",
    (objective) => {
      const result = generator.generate(buildSocialInput(), optionsFactory.create({ objective }));

      expect(result.objective).toBe(objective);
      expect(result.ctas[0]?.value.length).toBeGreaterThan(0);
    },
  );

  it("generates natural Malay social content", () => {
    const result = generator.generate(buildSocialInput(), optionsFactory.create({ language: "ms", platform: "facebook" }));

    expect(result.hook).toContain("Sedang");
    expect(result.primaryCaption).toContain("Nilai utama");
  });

  it("respects short caption limits without broken trailing spaces", () => {
    const result = generator.generate(buildSocialInput(), optionsFactory.create({ platform: "x", captionLength: "short" }));

    expect(result.primaryCaption.length).toBeLessThanOrEqual(180);
    expect(result.primaryCaption.endsWith(" ")).toBe(false);
  });

  it("creates carousel and story content only when enabled", () => {
    const enabled = generator.generate(
      buildSocialInput(),
      optionsFactory.create({ platform: "instagram", includeCarouselContent: true, includeStoryContent: true }),
    );
    const disabled = generator.generate(
      buildSocialInput(),
      optionsFactory.create({ platform: "linkedin", includeCarouselContent: false, includeStoryContent: false }),
    );

    expect(enabled.carouselSlides.length).toBeGreaterThan(0);
    expect(enabled.storyFrames.length).toBeGreaterThan(0);
    expect(disabled.carouselSlides).toHaveLength(0);
    expect(disabled.storyFrames).toHaveLength(0);
  });

  it("does not mutate source input", () => {
    const input = buildSocialInput();
    const before = JSON.stringify(input);

    generator.generate(input, optionsFactory.create({ platform: "instagram" }));

    expect(JSON.stringify(input)).toBe(before);
  });
});
