import type {
  ProductContentGenerationInput,
  ProductContentGenerationOptionsInput,
  ProductContentPackage,
} from "../dto/product-content.types.js";
import { ProductContentInputFactory } from "../factories/product-content-input.factory.js";
import { ProductContentOptionsFactory } from "../factories/product-content-options.factory.js";
import type { ProductContentGeneratorPort } from "../ports/product-content-generator.port.js";
import { ProductContentClaimSafetyService } from "../services/product-content-claim-safety.service.js";

export interface GenerateProductContentUseCaseRequest {
  readonly input: ProductContentGenerationInput;
  readonly options?: ProductContentGenerationOptionsInput;
}

export class GenerateProductContentUseCase {
  public constructor(
    private readonly generator: ProductContentGeneratorPort,
    private readonly inputFactory = new ProductContentInputFactory(),
    private readonly optionsFactory = new ProductContentOptionsFactory(),
    private readonly claimSafety = new ProductContentClaimSafetyService(),
  ) {}

  public execute(request: GenerateProductContentUseCaseRequest): ProductContentPackage {
    const input = this.inputFactory.create(request.input);
    const options = this.optionsFactory.create({
      ...(input.tone === undefined ? {} : { tone: input.tone }),
      ...(input.language === undefined ? {} : { language: input.language }),
      ...(input.channel === undefined ? {} : { channel: input.channel }),
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
      ...request.options,
    });
    const productContentPackage = this.generator.generate(input, options);

    if (options.strictClaimSafety) {
      this.claimSafety.validatePackage(productContentPackage);
    }

    return productContentPackage;
  }
}
