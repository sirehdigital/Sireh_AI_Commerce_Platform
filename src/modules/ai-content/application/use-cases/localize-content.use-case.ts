import type {
  ContentLocalizationInput,
  ContentLocalizationOptionsInput,
  LocalizedContentPackage,
} from "../dto/content-localization.types.js";
import {
  ContentLocalizationInputFactory,
  ContentLocalizationOptionsFactory,
} from "../factories/index.js";
import type { ContentLocalizationPort } from "../ports/content-localization.port.js";
import {
  LocalizationClaimPreservationError,
  LocalizationPlaceholderMismatchError,
  LocalizationProtectedTermMismatchError,
  LocalizationSEOError,
  LocalizationStructureMismatchError,
} from "../errors/index.js";

export interface LocalizeContentUseCaseRequest {
  readonly input: ContentLocalizationInput;
  readonly options?: ContentLocalizationOptionsInput;
}

export class LocalizeContentUseCase {
  public constructor(
    private readonly localizer: ContentLocalizationPort,
    private readonly inputFactory = new ContentLocalizationInputFactory(),
    private readonly optionsFactory = new ContentLocalizationOptionsFactory(),
  ) {}

  public execute(request: LocalizeContentUseCaseRequest): LocalizedContentPackage {
    const input = this.inputFactory.create(request.input);
    const options = this.optionsFactory.create({
      ...(input.sourceLocale === undefined ? {} : { sourceLocale: input.sourceLocale }),
      targetLocale: input.targetLocale,
      ...request.options,
    });
    const localized = this.localizer.localize(input, options);

    if (options.strictPlaceholderPreservationMode && !localized.validationResult.placeholdersPreserved) {
      throw new LocalizationPlaceholderMismatchError("Localization did not preserve placeholders.");
    }
    if (options.strictStructuralPreservationMode && !localized.validationResult.structurePreserved) {
      throw new LocalizationStructureMismatchError("Localization did not preserve structure.");
    }
    if (options.strictClaimPreservationMode && !localized.validationResult.claimsPreserved) {
      throw new LocalizationClaimPreservationError("Localization did not preserve claims safely.");
    }
    if (options.preserveProtectedTerminology && !localized.validationResult.protectedTermsPreserved) {
      throw new LocalizationProtectedTermMismatchError("Localization did not preserve protected terms.");
    }
    if (options.strictSEOPreservationMode && !localized.validationResult.seoPreserved) {
      throw new LocalizationSEOError("Localization did not preserve SEO intent.");
    }

    return localized;
  }
}
