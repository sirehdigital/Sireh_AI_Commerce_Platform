import type { ContentLocalizationInput, SupportedLocale } from "../dto/content-localization.types.js";
import type { ProductContentPackage } from "../dto/product-content.types.js";

export class ProductContentToLocalizationInputMapper {
  public map(contentPackage: ProductContentPackage, targetLocale: SupportedLocale): ContentLocalizationInput {
    const title = contentPackage.title.snapshot();
    return {
      sourceContentId: `product-content:${contentPackage.productId}`,
      sourceLanguage: contentPackage.language,
      targetLanguage: targetLocale.startsWith("ms") ? "ms" : "en",
      targetLocale,
      contentType: "product-description",
      channel: contentPackage.channel,
      tone: contentPackage.tone,
      headline: title.headline.value,
      body: contentPackage.longDescription.snapshot().body,
      structuredContent: {
        benefits: contentPackage.benefits.map((content) => content.snapshot().body).join("\n"),
        features: contentPackage.features.map((content) => content.snapshot().body).join("\n"),
      },
      productContentPackage: contentPackage,
      productFacts: contentPackage.contents.map((content) => content.snapshot().body).filter(Boolean),
      brandTerminology: [],
      protectedTerms: [],
      productNames: [title.headline.value],
      brandNames: [],
      personalizationTokens: [],
      verifiedClaims: [],
      regulatoryNotes: [],
      campaignMetadata: { productId: contentPackage.productId },
      correlationMetadata: {},
    };
  }
}
