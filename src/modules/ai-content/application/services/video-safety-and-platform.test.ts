import { describe, expect, it } from "vitest";
import { DeterministicVideoScriptGenerator } from "../../infrastructure/generators/index.js";
import { buildVideoInput } from "../../infrastructure/generators/deterministic-video-script.generator.test.js";
import { VideoScriptOptionsFactory } from "../factories/index.js";
import { InvalidSceneTimingError, UnsafeVideoContentError } from "../errors/index.js";
import { VideoContentSafetyService, VideoPlatformCompatibilityService, VideoTimingValidationService } from "./index.js";

describe("video safety, timing and platform policies", () => {
  it("detects unsafe video claims", () => {
    expect(() => new VideoContentSafetyService().validateText("This creates guaranteed overnight results.")).toThrow(
      UnsafeVideoContentError,
    );
  });

  it("allows restrained grounded scripts", () => {
    expect(() =>
      new VideoContentSafetyService().validateText("Show the product details and explain the supplied benefit."),
    ).not.toThrow();
  });

  it("validates correct timing", () => {
    const options = new VideoScriptOptionsFactory().create({ platform: "youtube-shorts", targetDurationSeconds: 60 });
    const result = new DeterministicVideoScriptGenerator().generate(buildVideoInput(), options);

    expect(() => new VideoTimingValidationService().validate(result)).not.toThrow();
  });

  it("rejects invalid timing", () => {
    const options = new VideoScriptOptionsFactory().create({ platform: "tiktok", targetDurationSeconds: 30 });
    const result = new DeterministicVideoScriptGenerator().generate(buildVideoInput(), options);
    const broken = {
      ...result,
      scenes: [{ ...result.scenes[0]!, timing: { startSecond: 0, endSecond: 0, durationSeconds: 0 } }],
    };

    expect(() => new VideoTimingValidationService().validate(broken)).toThrow(InvalidSceneTimingError);
  });

  it("validates platform compatibility", () => {
    const options = new VideoScriptOptionsFactory().create({ platform: "youtube", targetDurationSeconds: 180 });
    const result = new DeterministicVideoScriptGenerator().generate(buildVideoInput(), options);

    expect(() => new VideoPlatformCompatibilityService().validate(result, options)).not.toThrow();
  });
});
