import { describe, expect, it } from "vitest";
import { CTA, SEOKeyword } from "../../domain/index.js";
import { ContentLocalizationOptionsFactory } from "../../application/factories/index.js";
import type { ContentLocalizationInput, SupportedLocale } from "../../application/dto/index.js";
import { DeterministicContentLocalizationEngine } from "./deterministic-content-localization.engine.js";

const LOCALES: readonly SupportedLocale[] = ["en-US", "en-GB", "en-AU", "en-CA", "ms-MY"];

describe("DeterministicContentLocalizationEngine", () => {
  const engine = new DeterministicContentLocalizationEngine();
  const optionsFactory = new ContentLocalizationOptionsFactory();

  const input: ContentLocalizationInput = {
    sourceContentId: "content-localize-1",
    sourceLanguage: "en",
    sourceLocale: "en-US",
    targetLanguage: "ms",
    targetLocale: "ms-MY",
    contentType: "blog-article",
    channel: "blog",
    tone: "educational",
    headline: "Product guide for Sireh Lamp",
    body: "This product guide helps customers review product benefits and features. Learn more with {{first_name}}.",
    structuredContent: {
      section: "Product benefit and feature guidance.",
      faq: "Review the product guide before publishing.",
    },
    cta: CTA.create("Learn more"),
    seo: {
      primaryKeyword: SEOKeyword.create("product guide"),
      secondaryKeywords: [],
      indexable: true,
    },
    productFacts: ["product benefits", "product features"],
    brandTerminology: ["Sireh"],
    protectedTerms: ["Sireh Lamp"],
    productNames: ["Sireh Lamp"],
    brandNames: ["Sireh"],
    personalizationTokens: ["{{first_name}}"],
    verifiedClaims: [],
    regulatoryNotes: [],
    campaignMetadata: { campaignId: "campaign-1", sourceProductId: "prod-1" },
    correlationMetadata: { correlationId: "corr-1" },
  };

  it("generates deterministic Malay localization while preserving structure", () => {
    const options = optionsFactory.create({ sourceLocale: "en-US", targetLocale: "ms-MY" });
    const first = engine.localize(input, options);
    const second = engine.localize(input, options);

    expect(first.localizedHeadline).toBe(second.localizedHeadline);
    expect(first.localizedStructuredContent).toEqual(second.localizedStructuredContent);
    expect(first.localizedAt).toEqual(second.localizedAt);
    expect(first.localizedHeadline).toContain("Panduan produk");
    expect(first.validationResult.structurePreserved).toBe(true);
  });

  it.each(LOCALES)("supports locale profile %s", (targetLocale) => {
    const output = engine.localize({ ...input, targetLocale, targetLanguage: targetLocale.startsWith("ms") ? "ms" : "en" }, optionsFactory.create({ targetLocale }));

    expect(output.targetLocale).toBe(targetLocale);
    expect(output.contents[0]?.snapshot().language).toBe(targetLocale.startsWith("ms") ? "ms" : "en");
  });

  it("preserves placeholders, protected terms, product names and brand names", () => {
    const output = engine.localize(input, optionsFactory.create({ targetLocale: "ms-MY" }));

    expect(output.localizedBody).toContain("{{first_name}}");
    expect(output.localizedHeadline).toContain("Sireh Lamp");
    expect(output.preservedTerms).toContain("Sireh");
    expect(output.preservedPlaceholders).toContain("{{first_name}}");
  });

  it("creates review-required items for medical and currency-sensitive content", () => {
    const output = engine.localize(
      {
        ...input,
        body: "This clinically proven product costs $10 and requires regulatory review.",
        regulatoryNotes: ["Review regulated wording."],
      },
      optionsFactory.create({ targetLocale: "ms-MY", adaptCurrencyReferences: true }),
    );

    expect(output.reviewRequiredItems.some((item) => item.blocking)).toBe(true);
    expect(output.readiness).toBe("not-localizable");
  });

  it("adapts English regional spelling without changing product facts", () => {
    const output = engine.localize(
      {
        ...input,
        targetLocale: "en-GB",
        targetLanguage: "en",
        headline: "Favorite color center product guide for Sireh Lamp",
      },
      optionsFactory.create({ sourceLocale: "en-US", targetLocale: "en-GB", localizationMode: "adapt" }),
    );

    expect(output.localizedHeadline).toContain("favourite");
    expect(output.localizedHeadline).toContain("colour");
    expect(output.localizedHeadline).toContain("centre");
    expect(output.localizedHeadline).toContain("Sireh Lamp");
  });

  it("translates controlled Malay phrases to English", () => {
    const output = engine.localize(
      { ...input, sourceLanguage: "ms", sourceLocale: "ms-MY", targetLanguage: "en", targetLocale: "en-US", headline: "Panduan produk", body: "Ketahui lebih lanjut tentang manfaat produk." },
      optionsFactory.create({ sourceLocale: "ms-MY", targetLocale: "en-US" }),
    );

    expect(output.localizedHeadline).toBe("Product guide");
    expect(output.localizedBody).toContain("Learn more");
  });

  it("honours disabled CTA and spelling adaptation", () => {
    const output = engine.localize(
      { ...input, targetLanguage: "en", targetLocale: "en-GB", headline: "Favorite color", cta: CTA.create("Learn more") },
      optionsFactory.create({ sourceLocale: "en-US", targetLocale: "en-GB", localizationMode: "adapt", adaptCTA: false, adaptSpelling: false }),
    );

    expect(output.localizedHeadline).toBe("Favorite color");
    expect(output.localizedCTA?.value).toBe("Learn more");
  });

  it("preserves repeated placeholders, URLs and product identifiers exactly", () => {
    const output = engine.localize(
      { ...input, body: "Review {{first_name}} at https://sireh.example/p/SACP-100-AA for {{first_name}}.", structuredContent: {} },
      optionsFactory.create({ sourceLocale: "en-US", targetLocale: "ms-MY" }),
    );

    expect(output.localizedBody.match(/\{\{first_name\}\}/gu)).toHaveLength(2);
    expect(output.localizedBody).toContain("https://sireh.example/p/SACP-100-AA");
    expect(output.validationResult.placeholdersPreserved).toBe(true);
  });
});
