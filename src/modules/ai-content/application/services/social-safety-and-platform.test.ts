import { describe, expect, it } from "vitest";
import { SocialHashtagSetFactory, SocialMediaContentOptionsFactory } from "../factories/index.js";
import { UnsafeHashtagError, UnsafeSocialContentError } from "../errors/index.js";
import {
  SocialContentSafetyService,
  SocialHashtagSafetyService,
  SocialPlatformCompatibilityService,
} from "./index.js";
import { buildSocialInput } from "../../infrastructure/generators/deterministic-social-media-content.generator.test.js";
import { DeterministicSocialMediaContentGenerator } from "../../infrastructure/generators/index.js";

describe("social safety and platform policies", () => {
  it("detects fabricated proof, urgency and unsupported promotions", () => {
    const safety = new SocialContentSafetyService();

    expect(() => safety.validateText("Rated 5-star with only 2 left and 50% off.")).toThrow(UnsafeSocialContentError);
  });

  it("allows restrained grounded copy", () => {
    const safety = new SocialContentSafetyService();

    expect(() => safety.validateText("Explore the product details and choose what fits your routine.")).not.toThrow();
  });

  it("normalizes and deduplicates hashtags within platform limits", () => {
    const hashtags = new SocialHashtagSetFactory().create(
      { ...buildSocialInput(), brand: "Sireh Beauty", tags: ["Sireh Beauty"] },
      new SocialMediaContentOptionsFactory().create({ platform: "instagram", hashtagCount: 6 }),
    );

    expect(hashtags[0]).toBe("#SirehBeauty");
    expect(new Set(hashtags.map((hashtag) => hashtag.toLowerCase())).size).toBe(hashtags.length);
  });

  it("rejects unsafe hashtags", () => {
    expect(() => new SocialHashtagSafetyService().validate(["#GuaranteedResults"], 2)).toThrow(UnsafeHashtagError);
  });

  it("validates platform compatibility", () => {
    const options = new SocialMediaContentOptionsFactory().create({ platform: "x", captionLength: "short" });
    const contentPackage = new DeterministicSocialMediaContentGenerator().generate(buildSocialInput(), options);

    expect(() => new SocialPlatformCompatibilityService().validate(contentPackage, options)).not.toThrow();
  });
});
