import { describe, expect, it } from "vitest";
import { Content, CTA, Headline } from "../../domain/index.js";
import { DeterministicContentLocalizationEngine } from "../../infrastructure/localization/index.js";
import {
  LocalizationClaimPreservationError,
  MissingLocalizationSourceError,
  UnsupportedLocalePairError,
  UnsupportedTargetLocaleError,
} from "../errors/index.js";
import { ContentAggregateToLocalizationInputMapper } from "../mappers/index.js";
import { LocalizeContentUseCase } from "./localize-content.use-case.js";

describe("LocalizeContentUseCase", () => {
  const useCase = new LocalizeContentUseCase(new DeterministicContentLocalizationEngine());

  it("localizes a Content aggregate and preserves source aggregate identity", () => {
    const content = Content.create({
      id: "content-source-1",
      type: "product-description",
      channel: "shopify",
      language: "en",
      tone: "professional",
      headline: Headline.create("Product guide for Sireh Bottle"),
      body: "This product guide helps customers review product benefits. Learn more.",
      cta: CTA.create("Learn more"),
      metadata: { sourceProductId: "prod-1", campaignId: "campaign-1", correlationId: "corr-1" },
    });
    const input = new ContentAggregateToLocalizationInputMapper().map(content, "ms-MY");
    const output = useCase.execute({ input });

    expect(output.targetLocale).toBe("ms-MY");
    expect(output.localizedHeadline).toContain("Sireh Bottle");
    expect(output.contents[0]?.id).not.toBe(content.id);
    expect(content.snapshot().headline.value).toBe("Product guide for Sireh Bottle");
    expect(output.correlationMetadata.correlationId).toBe("corr-1");
  });

  it("supports validate-only mode", () => {
    const input = {
      sourceContentId: "validate-only-1",
      sourceLanguage: "en" as const,
      targetLanguage: "en" as const,
      targetLocale: "en-US" as const,
      contentType: "generic-content" as const,
      channel: "generic" as const,
      tone: "neutral" as const,
      headline: "Product guide",
      body: "Product guide body.",
      structuredContent: {},
      productFacts: [],
      brandTerminology: [],
      protectedTerms: [],
      productNames: [],
      brandNames: [],
      personalizationTokens: [],
      verifiedClaims: [],
      regulatoryNotes: [],
      campaignMetadata: {},
      correlationMetadata: {},
    };
    const output = useCase.execute({ input, options: { localizationMode: "validate-only", sourceLocale: "en-US", targetLocale: "en-US" } });

    expect(output.localizedHeadline).toBe("Product guide");
  });

  it("rejects unsupported locale configuration and missing source", () => {
    const input = {
      sourceContentId: "bad-locale",
      sourceLanguage: "en" as const,
      targetLanguage: "en" as const,
      targetLocale: "fr-FR" as "en-US",
      contentType: "generic-content" as const,
      channel: "generic" as const,
      tone: "neutral" as const,
      headline: "Product guide",
      body: "Product guide body.",
      structuredContent: {},
      productFacts: [],
      brandTerminology: [],
      protectedTerms: [],
      productNames: [],
      brandNames: [],
      personalizationTokens: [],
      verifiedClaims: [],
      regulatoryNotes: [],
      campaignMetadata: {},
      correlationMetadata: {},
    };

    expect(() => useCase.execute({ input })).toThrow(UnsupportedTargetLocaleError);
    expect(() => useCase.execute({ input: { ...input, sourceContentId: " " } })).toThrow(MissingLocalizationSourceError);
    expect(() => useCase.execute({ input: { ...input, targetLocale: "en-US" }, options: { sourceLocale: "en-US", targetLocale: "en-US", localizationMode: "translate" } })).toThrow(UnsupportedLocalePairError);
  });

  it("throws strict claim preservation errors", () => {
    const input = {
      sourceContentId: "claim-1",
      sourceLanguage: "en" as const,
      targetLanguage: "ms" as const,
      targetLocale: "ms-MY" as const,
      contentType: "generic-content" as const,
      channel: "generic" as const,
      tone: "neutral" as const,
      headline: "Product guide",
      body: "This product guide is safe.",
      structuredContent: {},
      productFacts: [],
      brandTerminology: [],
      protectedTerms: [],
      productNames: [],
      brandNames: [],
      personalizationTokens: [],
      verifiedClaims: ["missing verified claim"],
      regulatoryNotes: [],
      campaignMetadata: {},
      correlationMetadata: {},
    };

    expect(() => useCase.execute({ input })).toThrow(LocalizationClaimPreservationError);
  });
});
