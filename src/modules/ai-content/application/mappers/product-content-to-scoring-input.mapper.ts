import type { ContentQualityScoringInput } from "../dto/content-quality-scoring.types.js";
import type { ProductContentPackage } from "../dto/product-content.types.js";

export class ProductContentToScoringInputMapper {
  public map(contentPackage: ProductContentPackage): ContentQualityScoringInput {
    const title = contentPackage.title.snapshot();
    const bodyParts = contentPackage.contents.map((content) => content.snapshot().body).filter(Boolean);
    return {
      contentId: `score:${contentPackage.productId}:product-content`,
      contentType: "product-description",
      channel: contentPackage.channel,
      language: contentPackage.language,
      tone: contentPackage.tone,
      headline: title.headline.value,
      body: bodyParts.join("\n\n"),
      structuredContent: {
        title: title.headline.value,
        benefits: contentPackage.benefits.map((content) => content.snapshot().body).join("\n"),
        features: contentPackage.features.map((content) => content.snapshot().body).join("\n"),
      },
      sourceMetadata: { productId: contentPackage.productId, sourcePackage: "product-content" },
      campaignMetadata: {},
      correlationMetadata: {},
      productContentPackage: contentPackage,
    };
  }
}
