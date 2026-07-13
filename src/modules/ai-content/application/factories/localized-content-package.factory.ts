import { Content, CTA, Headline, MetaDescription, MetaTitle, SEOKeyword, Slug, type ContentSEO } from "../../domain/index.js";
import type {
  ContentLocalizationInput,
  ContentLocalizationOptions,
  LocalizedContentPackage,
  LocalizationReviewRequiredItem,
  LocalizationValidationResult,
} from "../dto/content-localization.types.js";

export interface LocalizedContentPackageDraft {
  readonly localizedHeadline: string;
  readonly localizedBody: string;
  readonly localizedStructuredContent: Readonly<Record<string, string>>;
  readonly localizedCTA?: string;
  readonly localizedSEO?: ContentSEO;
  readonly localizedSlug?: string;
  readonly localizedHeadings: readonly string[];
  readonly localizedCaptions: readonly string[];
  readonly localizedSubjectLines: readonly string[];
  readonly localizedPreheaders: readonly string[];
  readonly localizedScriptScenes: readonly string[];
  readonly localizedEmailSections: readonly string[];
  readonly localizedBlogSections: readonly string[];
  readonly preservedTerms: readonly string[];
  readonly preservedPlaceholders: readonly string[];
  readonly changedTerms: readonly string[];
  readonly regionalAdaptations: readonly string[];
  readonly warnings: readonly string[];
  readonly reviewRequiredItems: readonly LocalizationReviewRequiredItem[];
  readonly validationResult: LocalizationValidationResult;
}

export class LocalizedContentPackageFactory {
  public create(
    input: ContentLocalizationInput,
    options: ContentLocalizationOptions,
    draft: LocalizedContentPackageDraft,
  ): LocalizedContentPackage {
    const localizedCTA = draft.localizedCTA === undefined ? undefined : CTA.create(draft.localizedCTA);
    const localizedSEO = draft.localizedSEO ?? localizeSEO(input, draft);
    const sourceProductId = stringMeta(input.campaignMetadata.sourceProductId);
    const campaignId = stringMeta(input.campaignMetadata.campaignId);
    const correlationId = stringMeta(input.correlationMetadata.correlationId);
    const content = Content.create({
      id: `content:${input.sourceContentId}:localized:${options.targetLocale}`,
      type: input.contentType,
      channel: aggregateChannel(input.contentType, input.channel),
      language: options.targetLocale.startsWith("ms") ? "ms" : "en",
      tone: input.tone,
      headline: Headline.create(draft.localizedHeadline.slice(0, 120)),
      body: draft.localizedBody,
      structuredContent: draft.localizedStructuredContent,
      ...(input.audience === undefined ? {} : { audience: input.audience }),
      ...(localizedCTA === undefined ? {} : { cta: localizedCTA }),
      ...(localizedSEO === undefined ? {} : { seo: localizedSEO }),
      metadata: {
        ...(sourceProductId === undefined ? {} : { sourceProductId }),
        ...(campaignId === undefined ? {} : { campaignId }),
        ...(correlationId === undefined ? {} : { correlationId }),
        tags: ["localized-content", options.targetLocale, input.contentType],
        custom: {
          sourceContentId: input.sourceContentId,
          sourceLanguage: input.sourceLanguage,
          sourceLocale: options.sourceLocale,
          targetLanguage: options.targetLocale.startsWith("ms") ? "ms" : "en",
          targetLocale: options.targetLocale,
          localizationMode: options.localizationMode,
          localizationVersion: "SACP Content Localization Rule Engine v1",
          preservedTerms: draft.preservedTerms,
          preservedPlaceholders: draft.preservedPlaceholders,
          reviewRequiredCount: draft.reviewRequiredItems.length,
          validationPassed: draft.validationResult.passed,
        },
      },
    });

    const readiness = readinessFor(draft.validationResult, draft.reviewRequiredItems);

    return {
      sourceLanguage: input.sourceLanguage,
      sourceLocale: options.sourceLocale,
      targetLanguage: options.targetLocale.startsWith("ms") ? "ms" : "en",
      targetLocale: options.targetLocale,
      localizationMode: options.localizationMode,
      localizedHeadline: draft.localizedHeadline,
      localizedBody: draft.localizedBody,
      localizedStructuredContent: draft.localizedStructuredContent,
      ...(localizedCTA === undefined ? {} : { localizedCTA }),
      ...(localizedSEO === undefined ? {} : { localizedSEO }),
      ...(draft.localizedSlug === undefined ? {} : { localizedSlug: draft.localizedSlug }),
      localizedHeadings: draft.localizedHeadings,
      localizedCaptions: draft.localizedCaptions,
      localizedSubjectLines: draft.localizedSubjectLines,
      localizedPreheaders: draft.localizedPreheaders,
      localizedScriptScenes: draft.localizedScriptScenes,
      localizedEmailSections: draft.localizedEmailSections,
      localizedBlogSections: draft.localizedBlogSections,
      preservedTerms: draft.preservedTerms,
      preservedPlaceholders: draft.preservedPlaceholders,
      changedTerms: draft.changedTerms,
      regionalAdaptations: draft.regionalAdaptations,
      warnings: draft.warnings,
      reviewRequiredItems: draft.reviewRequiredItems,
      claimPreservationResult: draft.validationResult,
      structuralPreservationResult: draft.validationResult,
      seoPreservationResult: draft.validationResult,
      validationResult: draft.validationResult,
      readiness,
      contents: [content],
      sourceMetadata: {
        sourceContentId: input.sourceContentId,
        sourceContentType: input.contentType,
        sourceLocale: options.sourceLocale,
        targetLocale: options.targetLocale,
      },
      correlationMetadata: { ...input.correlationMetadata },
      localizationVersion: "SACP Content Localization Rule Engine v1",
      localizedAt: localizationTimestamp(input),
    };
  }
}

function localizationTimestamp(input: ContentLocalizationInput): Date {
  const generatedAt =
    input.sourceContent?.snapshot().createdAt ??
    input.productContentPackage?.generatedAt ??
    input.seoContentPackage?.generatedAt ??
    input.socialMediaContentPackage?.generatedAt ??
    input.videoScriptPackage?.generatedAt ??
    input.emailContentPackage?.generatedAt ??
    input.blogContentPackage?.generatedAt;
  return new Date(generatedAt ?? 0);
}

function localizeSEO(input: ContentLocalizationInput, draft: LocalizedContentPackageDraft): ContentSEO | undefined {
  if (input.seo === undefined) {
    return undefined;
  }
  const primary = input.seo.primaryKeyword?.value ?? draft.localizedHeadline;
  const metaTitle = draft.localizedHeadline.slice(0, 60);
  const metaDescription = draft.localizedBody.slice(0, 155) || draft.localizedHeadline;
  return {
    primaryKeyword: SEOKeyword.create(primary),
    secondaryKeywords: input.seo.secondaryKeywords,
    metaTitle: MetaTitle.create(metaTitle),
    metaDescription: MetaDescription.create(metaDescription),
    slug: Slug.create(draft.localizedSlug ?? draft.localizedHeadline),
    ...(input.seo.searchIntent === undefined ? {} : { searchIntent: input.seo.searchIntent }),
    indexable: input.seo.indexable,
  };
}

function aggregateChannel(contentType: ContentLocalizationInput["contentType"], channel: ContentLocalizationInput["channel"]): ContentLocalizationInput["channel"] {
  if (contentType === "blog-article" && channel === "shopify") {
    return "website";
  }
  if (contentType === "cta" && channel === "blog") {
    return "website";
  }
  return channel;
}

function readinessFor(validation: LocalizationValidationResult, reviewItems: readonly LocalizationReviewRequiredItem[]): LocalizedContentPackage["readiness"] {
  if (!validation.structurePreserved || reviewItems.some((item) => item.blocking && item.severity === "critical")) {
    return "not-localizable";
  }
  if (reviewItems.some((item) => item.blocking)) {
    return "review-required";
  }
  if (validation.warnings.length > 0 || reviewItems.length > 0) {
    return "localized-with-warnings";
  }
  return validation.passed ? "ready-for-approval" : "ready-for-review";
}

function stringMeta(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
