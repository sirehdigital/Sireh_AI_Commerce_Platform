import { describe, expect, it } from "vitest";
import type { VideoScriptGenerationInput } from "../../application/dto/index.js";
import { VideoScriptOptionsFactory } from "../../application/factories/index.js";
import { DeterministicVideoScriptGenerator } from "./deterministic-video-script.generator.js";

export function buildVideoInput(): VideoScriptGenerationInput {
  return {
    productId: "product-video-001",
    productTitle: "Glow Daily Serum",
    brand: "Sireh Beauty",
    category: "Beauty",
    productType: "Face serum",
    productDescription: "A lightweight daily serum for simple skincare routines.",
    features: ["lightweight texture", "daily-use format"],
    benefits: ["supports a smoother daily routine", "fits clean morning and evening use"],
    highlights: ["Simple routine support", "Lightweight product format"],
    productRisks: ["Avoid unsupported medical claims."],
    usageInstructions: ["Apply a small amount as part of a normal skincare routine."],
    targetAudience: {
      primaryAudience: "beauty enthusiasts",
      customerProblems: ["finding a simple skincare step"],
      purchaseMotivations: ["easy daily use"],
    },
    valueProposition: "A clear skincare step for everyday routines.",
    campaignId: "campaign-video-001",
    correlationId: "correlation-video-001",
  };
}

describe("DeterministicVideoScriptGenerator", () => {
  const generator = new DeterministicVideoScriptGenerator();
  const optionsFactory = new VideoScriptOptionsFactory();

  it("generates deterministic video scripts", () => {
    const input = buildVideoInput();
    const options = optionsFactory.create({ platform: "tiktok", targetDurationSeconds: 30 });
    const first = generator.generate(input, options);
    const second = generator.generate(input, options);

    expect(first.voiceoverScript).toBe(second.voiceoverScript);
    expect(first.scenes.map((scene) => scene.timing)).toEqual(second.scenes.map((scene) => scene.timing));
  });

  it.each(["tiktok", "instagram-reels", "facebook-reels", "youtube-shorts", "youtube", "generic-video"] as const)(
    "generates %s output",
    (platform) => {
      const result = generator.generate(buildVideoInput(), optionsFactory.create({ platform }));

      expect(result.platform).toBe(platform);
      expect(result.scenes.length).toBeGreaterThanOrEqual(3);
      expect(result.contents.length).toBeGreaterThan(1);
    },
  );

  it.each(["short-form", "standard-product-video", "product-demonstration", "problem-solution", "educational", "feature-spotlight", "faq", "launch"] as const)(
    "supports %s format",
    (format) => {
      const result = generator.generate(buildVideoInput(), optionsFactory.create({ platform: "youtube", format }));

      expect(result.format).toBe(format);
      expect(result.scriptTitle.toLowerCase()).toContain(format.replace(/-/gu, " "));
    },
  );

  it("generates Malay voiceover and captions", () => {
    const result = generator.generate(buildVideoInput(), optionsFactory.create({ language: "ms", platform: "tiktok" }));

    expect(result.hook).toContain("Sedang");
    expect(result.voiceoverScript).toContain("memberi tumpuan");
  });

  it("allocates exact scene timing without overlap", () => {
    const result = generator.generate(
      buildVideoInput(),
      optionsFactory.create({ platform: "youtube-shorts", targetDurationSeconds: 45 }),
    );
    const total = result.scenes.reduce((sum, scene) => sum + scene.timing.durationSeconds, 0);

    expect(total).toBe(45);
    expect(result.scenes[0]?.timing.startSecond).toBe(0);
    expect(result.scenes.at(-1)?.timing.endSecond).toBe(45);
  });

  it("creates testimonial placeholders without fabricated proof", () => {
    const result = generator.generate(
      buildVideoInput(),
      optionsFactory.create({ format: "testimonial-framework", platform: "instagram-reels" }),
    );

    expect(result.complianceNotes.join(" ")).toContain("verified testimonial");
    expect(result.voiceoverScript).not.toMatch(/rated 5|customer says/iu);
  });

  it("does not mutate source input", () => {
    const input = buildVideoInput();
    const before = JSON.stringify(input);

    generator.generate(input, optionsFactory.create({ platform: "tiktok" }));

    expect(JSON.stringify(input)).toBe(before);
  });
});
