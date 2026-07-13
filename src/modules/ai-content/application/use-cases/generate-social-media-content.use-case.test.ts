import { describe, expect, it } from "vitest";
import { UnsupportedSocialPlatformError, UnsafeSocialContentError } from "../errors/index.js";
import { DeterministicSocialMediaContentGenerator } from "../../infrastructure/generators/index.js";
import { GenerateSocialMediaContentUseCase } from "./generate-social-media-content.use-case.js";
import { buildSocialInput } from "../../infrastructure/generators/deterministic-social-media-content.generator.test.js";

describe("GenerateSocialMediaContentUseCase", () => {
  const useCase = new GenerateSocialMediaContentUseCase(new DeterministicSocialMediaContentGenerator());

  it("generates a complete package with mapped content aggregates", () => {
    const result = useCase.execute({
      input: buildSocialInput(),
      options: { platform: "instagram", objective: "conversion", contentAngle: "product-benefit" },
    });

    expect(result.platform).toBe("instagram");
    expect(result.objective).toBe("conversion");
    expect(result.contents.some((content) => content.snapshot().type === "social-post")).toBe(true);
    expect(result.sourceMetadata.campaignId).toBe("campaign-001");
  });

  it("preserves language, tone and correlation metadata", () => {
    const result = useCase.execute({
      input: { ...buildSocialInput(), language: "ms", tone: "professional" },
      options: { platform: "facebook" },
    });

    expect(result.language).toBe("ms");
    expect(result.tone).toBe("professional");
    expect(result.sourceMetadata.correlationId).toBe("correlation-001");
  });

  it("rejects unsupported platform input", () => {
    expect(() =>
      useCase.execute({
        input: buildSocialInput(),
        options: { platform: "threads" as never },
      }),
    ).toThrow(UnsupportedSocialPlatformError);
  });

  it("propagates social safety errors", () => {
    expect(() =>
      useCase.execute({
        input: { ...buildSocialInput(), benefits: ["guaranteed cure for every concern"] },
      }),
    ).toThrow(UnsafeSocialContentError);
  });

  it("is deterministic across repeated execution", () => {
    const first = useCase.execute({ input: buildSocialInput(), options: { platform: "linkedin" } });
    const second = useCase.execute({ input: buildSocialInput(), options: { platform: "linkedin" } });

    expect(first.primaryCaption).toBe(second.primaryCaption);
    expect(first.hashtags).toEqual(second.hashtags);
  });
});
