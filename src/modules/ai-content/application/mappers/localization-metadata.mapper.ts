import type { LocalizedContentPackage } from "../dto/content-localization.types.js";

export class LocalizationMetadataMapper {
  public map(contentPackage: LocalizedContentPackage): Readonly<Record<string, unknown>> {
    return {
      sourceLocale: contentPackage.sourceLocale,
      targetLocale: contentPackage.targetLocale,
      localizationMode: contentPackage.localizationMode,
      localizationVersion: contentPackage.localizationVersion,
      readiness: contentPackage.readiness,
      preservedTerms: contentPackage.preservedTerms,
      preservedPlaceholders: contentPackage.preservedPlaceholders,
      reviewRequiredCount: contentPackage.reviewRequiredItems.length,
      validationPassed: contentPackage.validationResult.passed,
      localizedAt: contentPackage.localizedAt.toISOString(),
    };
  }
}
