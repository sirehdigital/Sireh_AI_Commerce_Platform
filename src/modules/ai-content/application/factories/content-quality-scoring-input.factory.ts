import type { ContentSnapshot } from "../../domain/index.js";
import type { ContentQualityScoringInput } from "../dto/content-quality-scoring.types.js";
import { MissingContentScoringSourceError } from "../errors/product-content.errors.js";

export class ContentQualityScoringInputFactory {
  public create(input: ContentQualityScoringInput): ContentQualityScoringInput {
    const contentId = clean(input.contentId);
    const headline = clean(input.headline);
    const body = input.body.trim();

    if (contentId === undefined) {
      throw new MissingContentScoringSourceError("Content ID is required for quality scoring.");
    }
    if (headline === undefined && body.length === 0 && Object.keys(input.structuredContent).length === 0) {
      throw new MissingContentScoringSourceError("Headline, body or structured content is required for quality scoring.");
    }

    return {
      contentId,
      ...(input.content === undefined ? {} : { content: input.content }),
      contentType: input.contentType,
      channel: input.channel,
      language: input.language,
      tone: input.tone,
      ...(input.audience === undefined ? {} : { audience: cloneAudience(input.audience) }),
      headline: headline ?? "",
      body,
      structuredContent: { ...input.structuredContent },
      ...(input.cta === undefined ? {} : { cta: input.cta }),
      ...(input.seo === undefined ? {} : { seo: input.seo }),
      ...(input.searchIntent === undefined ? {} : { searchIntent: input.searchIntent }),
      ...(input.productSourceData === undefined ? {} : { productSourceData: { ...input.productSourceData } }),
      ...(input.marketingSourceData === undefined ? {} : { marketingSourceData: { ...input.marketingSourceData } }),
      ...(input.productContentPackage === undefined ? {} : { productContentPackage: input.productContentPackage }),
      ...(input.seoContentPackage === undefined ? {} : { seoContentPackage: input.seoContentPackage }),
      ...(input.socialMediaContentPackage === undefined ? {} : { socialMediaContentPackage: input.socialMediaContentPackage }),
      ...(input.videoScriptPackage === undefined ? {} : { videoScriptPackage: input.videoScriptPackage }),
      ...(input.emailContentPackage === undefined ? {} : { emailContentPackage: input.emailContentPackage }),
      ...(input.blogContentPackage === undefined ? {} : { blogContentPackage: input.blogContentPackage }),
      sourceMetadata: { ...input.sourceMetadata },
      campaignMetadata: { ...input.campaignMetadata },
      correlationMetadata: { ...input.correlationMetadata },
    };
  }

  public fromContent(content: ContentQualityScoringInput["content"]): ContentQualityScoringInput {
    if (content === undefined) {
      throw new MissingContentScoringSourceError("Content aggregate is required for quality scoring.");
    }
    const snapshot: ContentSnapshot = content.snapshot();
    return {
      contentId: snapshot.id,
      content,
      contentType: snapshot.type,
      channel: snapshot.channel,
      language: snapshot.language,
      tone: snapshot.tone,
      ...(snapshot.audience === undefined ? {} : { audience: snapshot.audience }),
      headline: snapshot.headline.value,
      body: snapshot.body,
      structuredContent: snapshot.structuredContent,
      ...(snapshot.cta === undefined ? {} : { cta: snapshot.cta }),
      ...(snapshot.seo === undefined ? {} : { seo: snapshot.seo }),
      ...(snapshot.seo?.searchIntent === undefined ? {} : { searchIntent: snapshot.seo.searchIntent }),
      sourceMetadata: snapshot.metadata.custom,
      campaignMetadata: {
        ...(snapshot.metadata.campaignId === undefined ? {} : { campaignId: snapshot.metadata.campaignId }),
      },
      correlationMetadata: {
        ...(snapshot.metadata.correlationId === undefined ? {} : { correlationId: snapshot.metadata.correlationId }),
      },
    };
  }
}

function clean(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function cloneAudience(audience: NonNullable<ContentQualityScoringInput["audience"]>): NonNullable<ContentQualityScoringInput["audience"]> {
  return {
    ...audience,
    ...(audience.notes === undefined ? {} : { notes: [...audience.notes] }),
  };
}
