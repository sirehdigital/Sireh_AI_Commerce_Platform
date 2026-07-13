import { Content } from "../../domain/aggregates/content.aggregate.js";
import {
  Headline,
  type ContentSearchIntent,
  type ContentSEO,
  type ContentType,
} from "../../domain/index.js";
import type {
  SEOContentGenerationInput,
  SEOContentGenerationOptions,
  SEOContentPackage,
  SEOImageAltTextSuggestion,
  SEOIndexabilityRecommendation,
  SEOInternalLinkAnchorSuggestion,
  SEOKeywordPlacementGuidance,
  SEOKeywordSet,
  SEOReadinessCheck,
  SEOStructuredDataHint,
} from "../dto/seo-content.types.js";
import type { SEOMetadataDraft } from "./seo-metadata.factory.js";

export interface SEOContentPackageDraft {
  readonly keywordSet: SEOKeywordSet;
  readonly metadata: SEOMetadataDraft;
  readonly imageAltTextSuggestions: readonly SEOImageAltTextSuggestion[];
  readonly internalLinkAnchors: readonly SEOInternalLinkAnchorSuggestion[];
  readonly canonicalPath?: string;
  readonly indexability: SEOIndexabilityRecommendation;
  readonly structuredDataHints: readonly SEOStructuredDataHint[];
  readonly keywordPlacementGuidance: readonly SEOKeywordPlacementGuidance[];
  readonly warnings: readonly string[];
  readonly readiness: SEOReadinessCheck;
}

export class SEOContentPackageFactory {
  public create(
    input: SEOContentGenerationInput,
    options: SEOContentGenerationOptions,
    draft: SEOContentPackageDraft,
  ): SEOContentPackage {
    const contentSEO: ContentSEO = {
      primaryKeyword: draft.keywordSet.primaryKeyword,
      secondaryKeywords: draft.keywordSet.secondaryKeywords,
      metaTitle: draft.metadata.metaTitle,
      metaDescription: draft.metadata.metaDescription,
      slug: draft.metadata.slug,
      searchIntent: normalizeIntent(options.searchIntent),
      ...(draft.canonicalPath === undefined ? {} : { canonicalReference: draft.canonicalPath }),
      indexable: draft.indexability === "index-follow",
    };
    const seoTitle = this.content(input, options, "seo-title", "seo-title", draft.metadata.metaTitle.value, contentSEO);
    const seoDescription = this.content(
      input,
      options,
      "seo-description",
      "seo-description",
      draft.metadata.metaDescription.value,
      contentSEO,
    );
    const h1 = this.content(input, options, "product-title", "seo-h1", draft.metadata.h1, contentSEO);
    const summary = this.content(
      input,
      options,
      "generic-content",
      "seo-summary",
      draft.metadata.seoSummary,
      contentSEO,
    );
    const contents = [seoTitle, seoDescription, h1, summary];

    return {
      productId: input.productId,
      language: options.language,
      channel: options.channel,
      ...(options.targetMarket === undefined ? {} : { targetMarket: options.targetMarket }),
      keywords: draft.keywordSet,
      searchIntent: options.searchIntent,
      seoProductTitle: draft.metadata.seoProductTitle,
      metaTitle: draft.metadata.metaTitle,
      metaDescription: draft.metadata.metaDescription,
      slug: draft.metadata.slug,
      h1: draft.metadata.h1,
      h2Headings: draft.metadata.h2Headings,
      seoSummary: draft.metadata.seoSummary,
      imageAltTextSuggestions: draft.imageAltTextSuggestions,
      internalLinkAnchors: draft.internalLinkAnchors,
      ...(draft.canonicalPath === undefined ? {} : { canonicalPath: draft.canonicalPath }),
      indexability: draft.indexability,
      structuredDataHints: draft.structuredDataHints,
      keywordPlacementGuidance: draft.keywordPlacementGuidance,
      warnings: draft.warnings,
      readiness: draft.readiness,
      contentSEO,
      contents,
      generatedAt: new Date(),
    };
  }

  private content(
    input: SEOContentGenerationInput,
    options: SEOContentGenerationOptions,
    type: ContentType,
    component: string,
    text: string,
    seo: ContentSEO,
  ): Content {
    return Content.create({
      id: `content:${input.productId}:${options.channel}:${component}`,
      type,
      channel: options.channel,
      language: options.language,
      tone: "professional",
      headline: Headline.create(text.slice(0, 120)),
      body: text,
      seo,
      metadata: {
        sourceProductId: input.productId,
        ...(input.sourceMarketingAnalysisId === undefined
          ? {}
          : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
        ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
        ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
        ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
        tags: ["seo-content", component],
        custom: { component, searchIntent: options.searchIntent },
      },
      ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
    });
  }
}

function normalizeIntent(intent: SEOContentGenerationOptions["searchIntent"]): ContentSearchIntent {
  if (intent === "local" || intent === "comparison") {
    return "commercial";
  }

  return intent;
}
