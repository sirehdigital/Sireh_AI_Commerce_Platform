import { describe, expect, it } from "vitest";
import {
  MarketingToSocialInputMapper,
  ProductContentToSocialInputMapper,
  SocialMediaContentMapper,
} from "./index.js";
import { MissingSocialContentSourceError } from "../errors/index.js";
import { SocialMediaContentInputFactory, SocialMediaContentOptionsFactory } from "../factories/index.js";
import { DeterministicSocialMediaContentGenerator } from "../../infrastructure/generators/index.js";
import { buildSocialInput } from "../../infrastructure/generators/deterministic-social-media-content.generator.test.js";
import type { ProductContentPackage } from "../dto/index.js";

describe("social content mappers and factories", () => {
  it("normalizes input and rejects missing source", () => {
    const factory = new SocialMediaContentInputFactory();

    expect(factory.create({ ...buildSocialInput(), productTitle: "  Glow Daily Serum  " }).productTitle).toBe("Glow Daily Serum");
    expect(() => factory.create({ ...buildSocialInput(), productId: " " })).toThrow(MissingSocialContentSourceError);
  });

  it("applies option defaults for platform-aware generation", () => {
    const options = new SocialMediaContentOptionsFactory().create({ platform: "linkedin" });

    expect(options.tone).toBe("professional");
    expect(options.hashtagCount).toBeLessThanOrEqual(3);
  });

  it("maps marketing inputs without external marketing module coupling", () => {
    const mapped = new MarketingToSocialInputMapper().map({
      audience: { primaryAudience: "home owners" },
      valueProposition: "Practical daily value.",
      campaignObjective: "traffic",
    });

    expect(mapped.targetAudience?.primaryAudience).toBe("home owners");
    expect(mapped.campaignObjective).toBe("traffic");
  });

  it("maps product content package into social input", () => {
    const productContent = fakeProductContentPackage();
    const mapped = new ProductContentToSocialInputMapper().map(productContent);

    expect(mapped.productId).toBe("product-001");
    expect(mapped.benefits).toContain("Benefit one");
  });

  it("creates a stable social package snapshot", () => {
    const options = new SocialMediaContentOptionsFactory().create({ platform: "facebook" });
    const contentPackage = new DeterministicSocialMediaContentGenerator().generate(buildSocialInput(), options);
    const snapshot = new SocialMediaContentMapper().toSnapshot(contentPackage);

    expect(snapshot.platform).toBe("facebook");
    expect(snapshot.contents.length).toBe(contentPackage.contents.length);
  });
});

function fakeProductContentPackage(): ProductContentPackage {
  const options = new SocialMediaContentOptionsFactory().create({ platform: "instagram" });
  const socialPackage = new DeterministicSocialMediaContentGenerator().generate(buildSocialInput(), options);
  const first = socialPackage.contents[0]!;

  return {
    productId: "product-001",
    channel: "shopify",
    language: "en",
    tone: "friendly",
    title: first,
    subtitle: first,
    shortDescription: first,
    longDescription: first,
    benefits: [first],
    features: [first],
    highlights: [first],
    problemStatement: first,
    solutionStatement: first,
    valueProposition: first,
    targetAudienceStatement: first,
    brandPositioningStatement: first,
    faq: [],
    callsToAction: [first],
    shopifyReady: {
      title: "Glow Daily Serum",
      subtitle: "Daily routine support",
      descriptionHtml: "<p>Daily routine support.</p>",
      benefits: ["Benefit one"],
      features: ["Feature one"],
      highlights: ["Highlight one"],
      callsToAction: ["Learn more"],
    },
    contents: [first],
    generatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}
