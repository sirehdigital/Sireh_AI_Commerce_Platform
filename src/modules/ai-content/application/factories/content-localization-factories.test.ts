import { describe, expect, it } from "vitest";
import type { ContentLocalizationInput } from "../dto/content-localization.types.js";
import {
  InvalidContentLocalizationInputError,
  InvalidPersonalizationTokenError,
  UnsupportedSourceLocaleError,
  UnsupportedTargetLocaleError,
} from "../errors/index.js";
import { ContentLocalizationInputFactory } from "./content-localization-input.factory.js";
import { ContentLocalizationOptionsFactory } from "./content-localization-options.factory.js";
import { LocaleProfileFactory, normalizeLocale } from "./locale-profile.factory.js";
import { LocalizationPhraseFactory } from "./localization-phrase.factory.js";
import { LocalizationValidationFactory } from "./localization-validation.factory.js";

describe("content localization factories", () => {
  const inputFactory = new ContentLocalizationInputFactory();

  it("normalizes supported locale casing deterministically", () => {
    expect(normalizeLocale(" EN-gb ")).toBe("en-GB");
    expect(new LocaleProfileFactory().target("MS-my").locale).toBe("ms-MY");
  });

  it("returns focused errors for unsupported source and target locales", () => {
    expect(() => new LocaleProfileFactory().source("fr-FR")).toThrow(UnsupportedSourceLocaleError);
    expect(() => new LocaleProfileFactory().target("id-ID")).toThrow(UnsupportedTargetLocaleError);
  });

  it("rejects language and locale mismatches", () => {
    expect(() => inputFactory.create({ ...baseInput(), targetLanguage: "en" })).toThrow(
      InvalidContentLocalizationInputError,
    );
    expect(() => inputFactory.create({ ...baseInput(), sourceLanguage: "ms" })).toThrow(
      InvalidContentLocalizationInputError,
    );
  });

  it("rejects malformed and unsupported personalization tokens", () => {
    expect(() => inputFactory.create({ ...baseInput(), body: "Hello {{first_name}" })).toThrow(
      InvalidPersonalizationTokenError,
    );
    expect(() => inputFactory.create({ ...baseInput(), body: "Hello {{secret_token}}" })).toThrow(
      InvalidPersonalizationTokenError,
    );
  });

  it("applies conservative localization defaults", () => {
    const options = new ContentLocalizationOptionsFactory().create({ sourceLocale: "en-US", targetLocale: "ms-MY" });

    expect(options.localizationMode).toBe("translate-and-adapt");
    expect(options.adaptCurrencyReferences).toBe(false);
    expect(options.strictClaimPreservationMode).toBe(true);
    expect(options.strictPlaceholderPreservationMode).toBe(true);
  });

  it("detects placeholder deletion and duplication by occurrence count", () => {
    const validation = new LocalizationValidationFactory();
    const common = {
      sourceText: "Hello {{first_name}}",
      sourceStructureKeys: [] as readonly string[],
      targetStructureKeys: [] as readonly string[],
      placeholders: ["{{first_name}}"],
      protectedTerms: [] as readonly string[],
      verifiedClaims: [] as readonly string[],
      sourceLanguage: "en",
      targetLanguage: "ms",
      sourceLocale: "en-US",
      targetLocale: "ms-MY",
      warnings: [] as readonly string[],
      reviewRequiredItems: [] as const,
    };

    expect(validation.create({ ...common, targetText: "Helo" }).placeholdersPreserved).toBe(false);
    expect(
      validation.create({ ...common, targetText: "Helo {{first_name}} {{first_name}}" }).placeholdersPreserved,
    ).toBe(false);
  });

  it("requires every declared verified claim in both source and target", () => {
    const result = new LocalizationValidationFactory().create({
      sourceText: "Safe use guidance.",
      targetText: "Panduan penggunaan selamat.",
      sourceStructureKeys: [],
      targetStructureKeys: [],
      placeholders: [],
      protectedTerms: [],
      verifiedClaims: ["Missing claim"],
      sourceLanguage: "en",
      targetLanguage: "ms",
      sourceLocale: "en-US",
      targetLocale: "ms-MY",
      warnings: [],
      reviewRequiredItems: [],
    });

    expect(result.claimsPreserved).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("protects standalone terminology without blocking larger words", () => {
    const profiles = new LocaleProfileFactory();
    const localized = new LocalizationPhraseFactory().localizeText(
      "Product Pro product",
      profiles.source("en-US"),
      profiles.target("ms-MY"),
      ["Pro"],
    );

    expect(localized).toBe("Produk Pro produk");
  });
});

function baseInput(): ContentLocalizationInput {
  return {
    sourceContentId: "source-1",
    sourceLanguage: "en",
    sourceLocale: "en-US",
    targetLanguage: "ms",
    targetLocale: "ms-MY",
    contentType: "generic-content",
    channel: "generic",
    tone: "neutral",
    headline: "Product guide",
    body: "Learn more with {{first_name}}.",
    structuredContent: {},
    productFacts: [],
    brandTerminology: [],
    protectedTerms: [],
    productNames: [],
    brandNames: [],
    personalizationTokens: ["{{first_name}}"],
    verifiedClaims: [],
    regulatoryNotes: [],
    campaignMetadata: {},
    correlationMetadata: {},
  };
}
