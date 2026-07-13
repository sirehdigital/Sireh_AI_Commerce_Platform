import type {
  SEOContentGenerationInput,
  SEOContentGenerationOptionsInput,
  SEOContentPackage,
} from "../dto/seo-content.types.js";
import { SEOContentInputFactory } from "../factories/seo-content-input.factory.js";
import { SEOContentOptionsFactory } from "../factories/seo-content-options.factory.js";
import type { SEOContentGeneratorPort } from "../ports/seo-content-generator.port.js";
import { ProductContentClaimSafetyService } from "../services/product-content-claim-safety.service.js";
import { SEOKeywordSafetyService } from "../services/seo-keyword-safety.service.js";
import { SEOMetadataQualityService } from "../services/seo-metadata-quality.service.js";
import { SEOSearchIntentService } from "../services/seo-search-intent.service.js";

export interface GenerateSEOContentUseCaseRequest {
  readonly input: SEOContentGenerationInput;
  readonly options?: SEOContentGenerationOptionsInput;
}

export class GenerateSEOContentUseCase {
  public constructor(
    private readonly generator: SEOContentGeneratorPort,
    private readonly inputFactory = new SEOContentInputFactory(),
    private readonly optionsFactory = new SEOContentOptionsFactory(),
    private readonly searchIntentService = new SEOSearchIntentService(),
    private readonly keywordSafety = new SEOKeywordSafetyService(),
    private readonly metadataQuality = new SEOMetadataQualityService(),
    private readonly claimSafety = new ProductContentClaimSafetyService(),
  ) {}

  public execute(request: GenerateSEOContentUseCaseRequest): SEOContentPackage {
    const input = this.inputFactory.create(request.input);
    const inferredIntent = this.searchIntentService.infer(input, request.options?.searchIntent);
    const options = this.optionsFactory.create({
      ...(input.preferredLanguage === undefined ? {} : { language: input.preferredLanguage }),
      ...(input.targetChannel === undefined ? {} : { channel: input.targetChannel }),
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
      ...request.options,
      searchIntent: inferredIntent,
    });
    const seoPackage = this.generator.generate(input, options);

    if (options.strictKeywordSafety) {
      this.keywordSafety.validateKeywordSet(seoPackage.keywords);
    }

    this.metadataQuality.validate(seoPackage);

    if (options.strictClaimSafety) {
      this.claimSafety.validatePackage({
        productId: seoPackage.productId,
        channel: seoPackage.channel,
        language: seoPackage.language,
        tone: "professional",
        title: seoPackage.contents[0]!,
        subtitle: seoPackage.contents[0]!,
        shortDescription: seoPackage.contents[1]!,
        longDescription: seoPackage.contents[3]!,
        benefits: [],
        features: [],
        highlights: [],
        problemStatement: seoPackage.contents[3]!,
        solutionStatement: seoPackage.contents[3]!,
        valueProposition: seoPackage.contents[3]!,
        targetAudienceStatement: seoPackage.contents[3]!,
        brandPositioningStatement: seoPackage.contents[3]!,
        faq: [],
        callsToAction: [],
        shopifyReady: {
          title: seoPackage.seoProductTitle,
          subtitle: seoPackage.h1,
          descriptionHtml: seoPackage.seoSummary,
          benefits: [],
          features: [],
          highlights: [],
          callsToAction: [],
        },
        contents: seoPackage.contents,
        generatedAt: seoPackage.generatedAt,
      });
    }

    return {
      ...seoPackage,
      readiness: this.metadataQuality.validate(seoPackage),
    };
  }
}
