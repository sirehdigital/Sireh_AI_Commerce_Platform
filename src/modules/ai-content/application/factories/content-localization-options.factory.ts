import type { ContentLocalizationOptions, ContentLocalizationOptionsInput } from "../dto/content-localization.types.js";
import { UnsupportedLocalePairError } from "../errors/product-content.errors.js";
import { LocaleProfileFactory, normalizeLocale } from "./locale-profile.factory.js";

export class ContentLocalizationOptionsFactory {
  public constructor(private readonly localeProfiles = new LocaleProfileFactory()) {}

  public create(input: ContentLocalizationOptionsInput = {}): ContentLocalizationOptions {
    const sourceLocale = normalizeLocale(input.sourceLocale) ?? "en";
    const targetLocale = normalizeLocale(input.targetLocale) ?? "ms-MY";
    this.localeProfiles.source(sourceLocale);
    this.localeProfiles.target(targetLocale);

    if (sourceLocale === targetLocale && input.localizationMode === "translate") {
      throw new UnsupportedLocalePairError(sourceLocale, targetLocale);
    }

    return {
      sourceLocale,
      targetLocale,
      localizationMode: input.localizationMode ?? (sourceLocale === targetLocale ? "adapt" : "translate-and-adapt"),
      preserveBrandNames: input.preserveBrandNames ?? true,
      preserveProductNames: input.preserveProductNames ?? true,
      preserveProtectedTerminology: input.preserveProtectedTerminology ?? true,
      preserveUrls: input.preserveUrls ?? true,
      preservePlaceholders: input.preservePlaceholders ?? true,
      preservePersonalizationTokens: input.preservePersonalizationTokens ?? true,
      preserveSkuOrProductIdentifiers: input.preserveSkuOrProductIdentifiers ?? true,
      preserveCampaignReferences: input.preserveCampaignReferences ?? true,
      adaptSpelling: input.adaptSpelling ?? true,
      adaptDateFormatGuidance: input.adaptDateFormatGuidance ?? true,
      adaptNumberFormatGuidance: input.adaptNumberFormatGuidance ?? true,
      adaptCurrencyReferences: input.adaptCurrencyReferences ?? false,
      adaptCTA: input.adaptCTA ?? true,
      adaptSEOKeywords: input.adaptSEOKeywords ?? true,
      adaptSlug: input.adaptSlug ?? true,
      adaptTone: input.adaptTone ?? true,
      adaptChannelConventions: input.adaptChannelConventions ?? true,
      includeLocalizationNotes: input.includeLocalizationNotes ?? true,
      includeReviewRequiredFlags: input.includeReviewRequiredFlags ?? true,
      strictClaimPreservationMode: input.strictClaimPreservationMode ?? true,
      strictPlaceholderPreservationMode: input.strictPlaceholderPreservationMode ?? true,
      strictSEOPreservationMode: input.strictSEOPreservationMode ?? true,
      strictStructuralPreservationMode: input.strictStructuralPreservationMode ?? true,
    };
  }
}
