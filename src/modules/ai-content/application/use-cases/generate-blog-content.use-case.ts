import type {
  BlogContentGenerationInput,
  BlogContentGenerationOptionsInput,
  BlogContentPackage,
} from "../dto/blog-content.types.js";
import { BlogContentInputFactory } from "../factories/blog-content-input.factory.js";
import { BlogContentOptionsFactory } from "../factories/blog-content-options.factory.js";
import type { BlogContentGeneratorPort } from "../ports/blog-content-generator.port.js";
import { BlogCompatibilityValidationService } from "../services/blog-compatibility-validation.service.js";
import { BlogContentSafetyService } from "../services/blog-content-safety.service.js";
import { BlogEditorialEvidenceService } from "../services/blog-editorial-evidence.service.js";
import { BlogReadabilityValidationService } from "../services/blog-readability-validation.service.js";
import { ProductContentClaimSafetyService } from "../services/product-content-claim-safety.service.js";

export interface GenerateBlogContentUseCaseRequest {
  readonly input: BlogContentGenerationInput;
  readonly options?: BlogContentGenerationOptionsInput;
}

export class GenerateBlogContentUseCase {
  public constructor(
    private readonly generator: BlogContentGeneratorPort,
    private readonly inputFactory = new BlogContentInputFactory(),
    private readonly optionsFactory = new BlogContentOptionsFactory(),
    private readonly compatibility = new BlogCompatibilityValidationService(),
    private readonly safety = new BlogContentSafetyService(),
    private readonly evidence = new BlogEditorialEvidenceService(),
    private readonly readability = new BlogReadabilityValidationService(),
    private readonly claimSafety = new ProductContentClaimSafetyService(),
  ) {}

  public execute(request: GenerateBlogContentUseCaseRequest): BlogContentPackage {
    const input = this.inputFactory.create(request.input);
    const options = this.optionsFactory.create({
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.tone === undefined ? {} : { tone: input.tone }),
      ...(input.campaignObjective === undefined ? {} : { objective: input.campaignObjective }),
      ...(input.correlationMetadata?.templateId === undefined ? {} : { templateId: input.correlationMetadata.templateId }),
      ...request.options,
    });

    this.compatibility.validateInput(input, options);

    const contentPackage = this.generator.generate(input, options);
    const text = [
      contentPackage.recommendedTitle,
      contentPackage.articleSummary,
      contentPackage.introduction,
      ...contentPackage.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...section.bulletPoints]),
      ...contentPackage.faqSection.flatMap((item) => [item.question, item.answer]),
      contentPackage.conclusion,
    ].join(" ");

    if (options.strictClaimSafetyMode) {
      this.safety.validateText(text);
      if (input.productContentPackage !== undefined) {
        this.claimSafety.validatePackage(input.productContentPackage);
      }
    }
    if (options.strictEditorialEvidenceMode) {
      this.evidence.validate(input, contentPackage);
    }
    if (options.strictReadabilityMode) {
      this.readability.validate(contentPackage);
    }
    this.compatibility.validatePackage(contentPackage, options);

    return contentPackage;
  }
}
