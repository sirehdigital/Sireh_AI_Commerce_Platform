import type { LocalizationReviewRequiredItem, LocalizationValidationResult } from "../dto/content-localization.types.js";

export class LocalizationValidationFactory {
  public create(input: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly sourceStructureKeys: readonly string[];
    readonly targetStructureKeys: readonly string[];
    readonly placeholders: readonly string[];
    readonly protectedTerms: readonly string[];
    readonly verifiedClaims: readonly string[];
    readonly sourceLanguage: string;
    readonly targetLanguage: string;
    readonly sourceLocale: string;
    readonly targetLocale: string;
    readonly sourceCTA?: string;
    readonly targetCTA?: string;
    readonly sourceSEO?: string;
    readonly targetSEO?: string;
    readonly warnings: readonly string[];
    readonly reviewRequiredItems: readonly LocalizationReviewRequiredItem[];
  }): LocalizationValidationResult {
    const placeholdersPreserved = input.placeholders.every(
      (placeholder) => occurrences(input.sourceText, placeholder) === occurrences(input.targetText, placeholder),
    );
    const protectedTermsPreserved = input.protectedTerms.every((term) => input.targetText.includes(term));
    const claimsPreserved = input.verifiedClaims.every(
      (claim) => input.sourceText.includes(claim) && input.targetText.includes(claim),
    );
    const structurePreserved = input.sourceStructureKeys.join("|") === input.targetStructureKeys.join("|");
    const unsafeStrengthening = /\b(guaranteed results|clinically proven|cures|medical grade|hasil dijamin)\b/iu.test(input.targetText);
    const languageConsistent = localeLanguage(input.targetLocale) === input.targetLanguage;
    const localeConsistent = localeLanguage(input.sourceLocale) === input.sourceLanguage && languageConsistent;
    const seoPreserved = input.sourceSEO === undefined || (input.targetSEO !== undefined && input.targetSEO.trim().length > 0);
    const ctaIntentPreserved = input.sourceCTA === undefined || (input.targetCTA !== undefined && input.targetCTA.trim().length > 0);
    const passed = placeholdersPreserved && protectedTermsPreserved && claimsPreserved && structurePreserved && seoPreserved && ctaIntentPreserved && localeConsistent && !unsafeStrengthening;

    return {
      passed,
      languageConsistent,
      localeConsistent,
      placeholdersPreserved,
      protectedTermsPreserved,
      claimsPreserved: claimsPreserved && !unsafeStrengthening,
      structurePreserved,
      seoPreserved,
      ctaIntentPreserved,
      tonePreserved: true,
      channelCompatible: true,
      warnings: [...input.warnings, ...(unsafeStrengthening ? ["Localization introduced stronger claim language."] : [])],
      reviewRequiredItems: input.reviewRequiredItems,
    };
  }
}

function occurrences(value: string, needle: string): number {
  if (needle.length === 0) {
    return 0;
  }
  return value.split(needle).length - 1;
}

function localeLanguage(locale: string): string {
  return locale.toLowerCase().split("-")[0] ?? locale.toLowerCase();
}
