import type {
  EmailContentGenerationInput,
  EmailContentGenerationOptionsInput,
  EmailContentPackage,
} from "../dto/email-content.types.js";
import { EmailContentInputFactory } from "../factories/email-content-input.factory.js";
import { EmailContentOptionsFactory } from "../factories/email-content-options.factory.js";
import { EmailOfferContextFactory } from "../factories/email-offer-context.factory.js";
import type { EmailContentGeneratorPort } from "../ports/email-content-generator.port.js";
import { ProductContentClaimSafetyService } from "../services/product-content-claim-safety.service.js";
import { EmailCompatibilityValidationService } from "../services/email-compatibility-validation.service.js";
import { EmailComplianceValidationService } from "../services/email-compliance-validation.service.js";
import { EmailContentSafetyService } from "../services/email-content-safety.service.js";
import { EmailPersonalizationValidationService } from "../services/email-personalization-validation.service.js";

export interface GenerateEmailContentUseCaseRequest {
  readonly input: EmailContentGenerationInput;
  readonly options?: EmailContentGenerationOptionsInput;
}

export class GenerateEmailContentUseCase {
  public constructor(
    private readonly generator: EmailContentGeneratorPort,
    private readonly inputFactory = new EmailContentInputFactory(),
    private readonly optionsFactory = new EmailContentOptionsFactory(),
    private readonly offerContextFactory = new EmailOfferContextFactory(),
    private readonly emailSafety = new EmailContentSafetyService(),
    private readonly personalizationValidation = new EmailPersonalizationValidationService(),
    private readonly compatibilityValidation = new EmailCompatibilityValidationService(),
    private readonly complianceValidation = new EmailComplianceValidationService(),
    private readonly claimSafety = new ProductContentClaimSafetyService(),
  ) {}

  public execute(request: GenerateEmailContentUseCaseRequest): EmailContentPackage {
    const input = this.inputFactory.create(request.input);
    const options = this.optionsFactory.create({
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.tone === undefined ? {} : { tone: input.tone }),
      ...(input.campaignObjective === undefined ? {} : { objective: input.campaignObjective }),
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
      ...request.options,
    });

    if (options.strictOfferValidation) {
      this.offerContextFactory.validate(input, options);
    }

    const contentPackage = this.generator.generate(input, options);
    const text = [
      ...contentPackage.subjectLines,
      ...contentPackage.preheaders,
      contentPackage.headline,
      contentPackage.mainBody,
      contentPackage.plainTextVersion ?? "",
    ].join(" ");

    if (options.strictPersonalization) {
      this.personalizationValidation.validateText(text, options.personalizationTokens);
    }
    if (options.strictClaimSafety) {
      this.emailSafety.validateText(text);
      if (input.productContentPackage !== undefined) {
        this.claimSafety.validatePackage(input.productContentPackage);
      }
    }
    if (options.strictCompliance) {
      this.compatibilityValidation.validate(contentPackage, options);
      this.complianceValidation.validate(input, options, contentPackage);
    }

    return contentPackage;
  }
}
