import type {
  SocialMediaContentGenerationInput,
  SocialMediaContentGenerationOptionsInput,
  SocialMediaContentPackage,
} from "../dto/social-media-content.types.js";
import { SocialMediaContentInputFactory } from "../factories/social-media-content-input.factory.js";
import { maxHashtags, SocialMediaContentOptionsFactory } from "../factories/social-media-content-options.factory.js";
import type { SocialMediaContentGeneratorPort } from "../ports/social-media-content-generator.port.js";
import { ProductContentClaimSafetyService } from "../services/product-content-claim-safety.service.js";
import { SocialContentSafetyService } from "../services/social-content-safety.service.js";
import { SocialHashtagSafetyService } from "../services/social-hashtag-safety.service.js";
import { SocialPlatformCompatibilityService } from "../services/social-platform-compatibility.service.js";

export interface GenerateSocialMediaContentUseCaseRequest {
  readonly input: SocialMediaContentGenerationInput;
  readonly options?: SocialMediaContentGenerationOptionsInput;
}

export class GenerateSocialMediaContentUseCase {
  public constructor(
    private readonly generator: SocialMediaContentGeneratorPort,
    private readonly inputFactory = new SocialMediaContentInputFactory(),
    private readonly optionsFactory = new SocialMediaContentOptionsFactory(),
    private readonly socialSafety = new SocialContentSafetyService(),
    private readonly hashtagSafety = new SocialHashtagSafetyService(),
    private readonly platformCompatibility = new SocialPlatformCompatibilityService(),
    private readonly claimSafety = new ProductContentClaimSafetyService(),
  ) {}

  public execute(request: GenerateSocialMediaContentUseCaseRequest): SocialMediaContentPackage {
    const input = this.inputFactory.create(request.input);
    const options = this.optionsFactory.create({
      ...(input.platform === undefined ? {} : { platform: input.platform }),
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.tone === undefined ? {} : { tone: input.tone }),
      ...(input.campaignObjective === undefined ? {} : { objective: input.campaignObjective }),
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
      ...request.options,
    });
    const contentPackage = this.generator.generate(input, options);

    if (options.strictClaimSafety) {
      const text = [
        contentPackage.hook,
        contentPackage.primaryCaption,
        contentPackage.shortCaption,
        contentPackage.longCaption ?? "",
        contentPackage.engagementQuestion ?? "",
        contentPackage.commentPrompt ?? "",
        contentPackage.savePrompt ?? "",
        contentPackage.sharePrompt ?? "",
        contentPackage.linkPrompt ?? "",
        contentPackage.imageOverlayText ?? "",
        ...contentPackage.hashtags,
      ].join(" ");
      this.socialSafety.validateText(text);

      if (input.productContentPackage !== undefined) {
        this.claimSafety.validatePackage(input.productContentPackage);
      }
    }

    this.hashtagSafety.validate(contentPackage.hashtags, maxHashtags(options.platform));

    if (options.strictPlatformCompliance) {
      this.platformCompatibility.validate(contentPackage, options);
    }

    return contentPackage;
  }
}
