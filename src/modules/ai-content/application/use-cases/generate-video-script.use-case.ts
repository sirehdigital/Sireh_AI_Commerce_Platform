import type {
  VideoScriptGenerationInput,
  VideoScriptGenerationOptionsInput,
  VideoScriptPackage,
} from "../dto/video-script.types.js";
import { VideoScriptInputFactory } from "../factories/video-script-input.factory.js";
import { VideoScriptOptionsFactory } from "../factories/video-script-options.factory.js";
import type { VideoScriptGeneratorPort } from "../ports/video-script-generator.port.js";
import { ProductContentClaimSafetyService } from "../services/product-content-claim-safety.service.js";
import { SocialContentSafetyService } from "../services/social-content-safety.service.js";
import { VideoContentSafetyService } from "../services/video-content-safety.service.js";
import { VideoPlatformCompatibilityService } from "../services/video-platform-compatibility.service.js";
import { VideoTimingValidationService } from "../services/video-timing-validation.service.js";

export interface GenerateVideoScriptUseCaseRequest {
  readonly input: VideoScriptGenerationInput;
  readonly options?: VideoScriptGenerationOptionsInput;
}

export class GenerateVideoScriptUseCase {
  public constructor(
    private readonly generator: VideoScriptGeneratorPort,
    private readonly inputFactory = new VideoScriptInputFactory(),
    private readonly optionsFactory = new VideoScriptOptionsFactory(),
    private readonly timingValidation = new VideoTimingValidationService(),
    private readonly videoSafety = new VideoContentSafetyService(),
    private readonly socialSafety = new SocialContentSafetyService(),
    private readonly platformCompatibility = new VideoPlatformCompatibilityService(),
    private readonly claimSafety = new ProductContentClaimSafetyService(),
  ) {}

  public execute(request: GenerateVideoScriptUseCaseRequest): VideoScriptPackage {
    const input = this.inputFactory.create(request.input);
    const options = this.optionsFactory.create({
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.tone === undefined ? {} : { tone: input.tone }),
      ...(input.campaignObjective === undefined ? {} : { objective: input.campaignObjective }),
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
      ...request.options,
    });
    const videoPackage = this.generator.generate(input, options);

    if (options.strictTiming) {
      this.timingValidation.validate(videoPackage);
    }

    if (options.strictClaimSafety) {
      const generatedText = [
        videoPackage.hook,
        videoPackage.voiceoverScript,
        videoPackage.presenterDialogue,
        videoPackage.captionText ?? "",
        videoPackage.thumbnailTextSuggestion ?? "",
        videoPackage.endCardText ?? "",
        ...videoPackage.onScreenText,
      ].join(" ");
      this.videoSafety.validateText(generatedText);
      this.socialSafety.validateText(generatedText);

      if (input.productContentPackage !== undefined) {
        this.claimSafety.validatePackage(input.productContentPackage);
      }
    }

    if (options.strictPlatformCompliance) {
      this.platformCompatibility.validate(videoPackage, options);
    }

    return videoPackage;
  }
}
