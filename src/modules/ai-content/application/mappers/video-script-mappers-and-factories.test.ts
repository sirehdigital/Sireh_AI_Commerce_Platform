import { describe, expect, it } from "vitest";
import { DeterministicVideoScriptGenerator } from "../../infrastructure/generators/index.js";
import { buildVideoInput } from "../../infrastructure/generators/deterministic-video-script.generator.test.js";
import {
  MarketingToVideoInputMapper,
  ProductContentToVideoInputMapper,
  VideoScriptMapper,
} from "./index.js";
import { MissingVideoContentSourceError } from "../errors/index.js";
import { VideoScriptInputFactory, VideoScriptOptionsFactory } from "../factories/index.js";
import type { ProductContentPackage } from "../dto/index.js";

describe("video script mappers and factories", () => {
  it("normalizes input and rejects missing source", () => {
    const factory = new VideoScriptInputFactory();

    expect(factory.create({ ...buildVideoInput(), productTitle: "  Glow Daily Serum  " }).productTitle).toBe(
      "Glow Daily Serum",
    );
    expect(() => factory.create({ ...buildVideoInput(), productId: " " })).toThrow(MissingVideoContentSourceError);
  });

  it("applies defaults for platform-aware options", () => {
    const options = new VideoScriptOptionsFactory().create({ platform: "youtube" });

    expect(options.targetDurationSeconds).toBe(180);
    expect(options.tone).toBe("educational");
  });

  it("maps marketing input without external module coupling", () => {
    const mapped = new MarketingToVideoInputMapper().map({
      audience: { primaryAudience: "beauty enthusiasts" },
      valueProposition: "Daily routine support.",
      campaignObjective: "traffic",
    });

    expect(mapped.targetAudience?.primaryAudience).toBe("beauty enthusiasts");
    expect(mapped.campaignObjective).toBe("traffic");
  });

  it("maps product content package into video input", () => {
    const mapped = new ProductContentToVideoInputMapper().map(fakeProductContentPackage());

    expect(mapped.productId).toBe("product-video-001");
    expect(mapped.benefits).toContain("Benefit one");
  });

  it("creates a stable video package snapshot", () => {
    const options = new VideoScriptOptionsFactory().create({ platform: "tiktok" });
    const contentPackage = new DeterministicVideoScriptGenerator().generate(buildVideoInput(), options);
    const snapshot = new VideoScriptMapper().toSnapshot(contentPackage);

    expect(snapshot.platform).toBe("tiktok");
    expect(snapshot.sceneCount).toBe(contentPackage.scenes.length);
  });
});

function fakeProductContentPackage(): ProductContentPackage {
  const options = new VideoScriptOptionsFactory().create({ platform: "tiktok" });
  const videoPackage = new DeterministicVideoScriptGenerator().generate(buildVideoInput(), options);
  const first = videoPackage.contents[0]!;

  return {
    productId: "product-video-001",
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
