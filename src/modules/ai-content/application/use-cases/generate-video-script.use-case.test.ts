import { describe, expect, it } from "vitest";
import { DeterministicVideoScriptGenerator } from "../../infrastructure/generators/index.js";
import { UnsupportedVideoDurationError, UnsupportedVideoPlatformError, UnsafeVideoContentError } from "../errors/index.js";
import { GenerateVideoScriptUseCase } from "./generate-video-script.use-case.js";
import { buildVideoInput } from "../../infrastructure/generators/deterministic-video-script.generator.test.js";

describe("GenerateVideoScriptUseCase", () => {
  const useCase = new GenerateVideoScriptUseCase(new DeterministicVideoScriptGenerator());

  it("generates a complete package with content aggregate mapping", () => {
    const result = useCase.execute({
      input: buildVideoInput(),
      options: { platform: "tiktok", format: "product-demonstration", targetDurationSeconds: 30 },
    });

    expect(result.platform).toBe("tiktok");
    expect(result.format).toBe("product-demonstration");
    expect(result.contents.some((content) => content.snapshot().type === "video-script")).toBe(true);
    expect(result.sourceMetadata.campaignId).toBe("campaign-video-001");
  });

  it("preserves language, tone and correlation metadata", () => {
    const result = useCase.execute({
      input: { ...buildVideoInput(), language: "ms", tone: "professional" },
      options: { platform: "youtube-shorts", targetDurationSeconds: 30 },
    });

    expect(result.language).toBe("ms");
    expect(result.tone).toBe("professional");
    expect(result.sourceMetadata.correlationId).toBe("correlation-video-001");
  });

  it("rejects unsupported platform and duration", () => {
    expect(() =>
      useCase.execute({ input: buildVideoInput(), options: { platform: "vimeo" as never } }),
    ).toThrow(UnsupportedVideoPlatformError);

    expect(() =>
      useCase.execute({ input: buildVideoInput(), options: { platform: "tiktok", targetDurationSeconds: 300 } }),
    ).toThrow(UnsupportedVideoDurationError);
  });

  it("propagates safety validation errors", () => {
    expect(() =>
      useCase.execute({ input: { ...buildVideoInput(), benefits: ["guaranteed overnight results"] } }),
    ).toThrow(UnsafeVideoContentError);
  });

  it("is deterministic across repeated execution", () => {
    const first = useCase.execute({ input: buildVideoInput(), options: { platform: "youtube", targetDurationSeconds: 120 } });
    const second = useCase.execute({ input: buildVideoInput(), options: { platform: "youtube", targetDurationSeconds: 120 } });

    expect(first.voiceoverScript).toBe(second.voiceoverScript);
    expect(first.onScreenText).toEqual(second.onScreenText);
  });
});
