import {
  Content,
  CTA,
  Headline,
  MetaDescription,
  MetaTitle,
  ReadingTime,
  SEOKeyword,
  Slug,
  type ContentSEO,
  type ContentType,
} from "../../domain/index.js";
import type {
  BlogContentGenerationInput,
  BlogContentGenerationOptions,
  BlogContentPackage,
  BlogFAQItem,
  BlogImageGuidance,
  BlogLinkGuidance,
  BlogOutlineItem,
  BlogReadingMetrics,
  BlogSection,
  BlogTitleOption,
  BlogValidationSummary,
  BlogWarning,
} from "../dto/blog-content.types.js";

export interface BlogContentPackageDraft {
  readonly titleOptions: readonly BlogTitleOption[];
  readonly recommendedTitle: string;
  readonly slug: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly articleSummary: string;
  readonly introduction: string;
  readonly outline: readonly BlogOutlineItem[];
  readonly sections: readonly BlogSection[];
  readonly faqSection: readonly BlogFAQItem[];
  readonly conclusion: string;
  readonly primaryCTA: string;
  readonly secondaryCTA?: string;
  readonly internalLinkAnchorSuggestions: readonly BlogLinkGuidance[];
  readonly externalSourcePlaceholderGuidance: readonly string[];
  readonly imagePlacementSuggestions: readonly BlogImageGuidance[];
  readonly featuredImageConcept?: string;
  readonly readingMetrics: BlogReadingMetrics;
  readonly editorialWarnings: readonly BlogWarning[];
  readonly complianceNotes: readonly string[];
  readonly validationSummary: BlogValidationSummary;
}

export class BlogContentPackageFactory {
  public create(
    input: BlogContentGenerationInput,
    options: BlogContentGenerationOptions,
    draft: BlogContentPackageDraft,
  ): BlogContentPackage {
    const primaryCTA = CTA.create(draft.primaryCTA);
    const secondaryCTA = draft.secondaryCTA === undefined ? undefined : CTA.create(draft.secondaryCTA);
    const primaryKeyword = primaryKeywordFor(input);
    const secondaryKeywords = secondaryKeywordsFor(input);
    const seo = contentSEO(input, draft, primaryKeyword, secondaryKeywords);
    const fullArticle = articleBody(draft);
    const articleContent = this.content(input, options, "blog-article", "article", draft.recommendedTitle, fullArticle, primaryCTA, seo, {
      sections: draft.sections.map((section) => `${section.heading}\n${section.paragraphs.join("\n\n")}`).join("\n\n"),
      faq: draft.faqSection.map((item) => `${item.question}\n${item.answer}`).join("\n\n"),
    });
    const contents = [
      articleContent,
      this.content(input, options, "generic-content", "summary", "Blog article summary", draft.articleSummary, undefined, undefined),
      this.content(input, options, "seo-title", "meta-title", draft.metaTitle, draft.metaTitle, undefined, seo),
      this.content(input, options, "seo-description", "meta-description", draft.metaTitle, draft.metaDescription, undefined, seo),
      this.content(input, options, "cta", "primary-cta", primaryCTA.value, primaryCTA.value, primaryCTA, undefined),
      ...(secondaryCTA === undefined
        ? []
        : [this.content(input, options, "cta", "secondary-cta", secondaryCTA.value, secondaryCTA.value, secondaryCTA, undefined)]),
    ];

    return {
      productId: input.productId,
      articleType: options.articleType,
      objective: options.objective,
      ...(input.targetAudience === undefined ? {} : { targetAudience: cloneAudience(input.targetAudience) }),
      language: options.language,
      tone: options.tone,
      channel: options.channel,
      searchIntent: normalizedSearchIntent(input),
      primaryKeyword,
      secondaryKeywords,
      titleOptions: draft.titleOptions,
      recommendedTitle: draft.recommendedTitle,
      slug: draft.slug,
      metaTitle: draft.metaTitle,
      metaDescription: draft.metaDescription,
      articleSummary: draft.articleSummary,
      introduction: draft.introduction,
      outline: draft.outline,
      sections: draft.sections,
      subheadings: draft.sections.map((section) => section.heading),
      productExamples: options.includeProductExamples ? productExamples(input) : [],
      benefitExplanations: (input.benefits ?? []).map((benefit) => `Benefit explained from source data: ${benefit}`),
      featureExplanations: (input.features ?? []).map((feature) => `Feature explained from source data: ${feature}`),
      useCaseExplanations: (input.usageGuidance ?? []).map((usage) => `Use-case guidance from source data: ${usage}`),
      ...withObjectionSection(draft.sections, options),
      faqSection: draft.faqSection,
      conclusion: draft.conclusion,
      primaryCTA,
      ...(secondaryCTA === undefined ? {} : { secondaryCTA }),
      internalLinkAnchorSuggestions: draft.internalLinkAnchorSuggestions,
      externalSourcePlaceholderGuidance: draft.externalSourcePlaceholderGuidance,
      imagePlacementSuggestions: draft.imagePlacementSuggestions,
      imageAltTextSuggestions: draft.imagePlacementSuggestions.map((image) => image.altText),
      ...(draft.featuredImageConcept === undefined ? {} : { featuredImageConcept: draft.featuredImageConcept }),
      readingMetrics: draft.readingMetrics,
      wordCount: draft.readingMetrics.estimatedWordCount,
      editorialWarnings: draft.editorialWarnings,
      complianceNotes: draft.complianceNotes,
      validationSummary: draft.validationSummary,
      contents,
      sourceMetadata: sourceMetadata(input, options),
      generatedAt: new Date(),
    };
  }

  private content(
    input: BlogContentGenerationInput,
    options: BlogContentGenerationOptions,
    type: ContentType,
    component: string,
    headline: string,
    body: string,
    cta: CTA | undefined,
    seo: ContentSEO | undefined,
    structuredContent: Readonly<Record<string, string>> = {},
  ): Content {
    return Content.create({
      id: `content:${input.productId}:blog:${component}`,
      type,
      channel: aggregateChannel(type, options.channel),
      language: options.language,
      tone: options.tone,
      headline: Headline.create(headline.slice(0, 120)),
      body,
      structuredContent,
      ...(cta === undefined ? {} : { cta }),
      ...(seo === undefined ? {} : { seo }),
      metadata: {
        sourceProductId: input.productId,
        ...(input.correlationMetadata?.sourceMarketingAnalysisId === undefined
          ? {}
          : { sourceMarketingAnalysisId: input.correlationMetadata.sourceMarketingAnalysisId }),
        ...(input.correlationMetadata?.campaignId === undefined ? {} : { campaignId: input.correlationMetadata.campaignId }),
        ...(input.correlationMetadata?.correlationId === undefined ? {} : { correlationId: input.correlationMetadata.correlationId }),
        tags: ["blog-content", options.articleType, component],
        custom: {
          component,
          articleType: options.articleType,
          objective: options.objective,
          customerJourneyReference: input.correlationMetadata?.customerJourneyReference,
        },
      },
      readingTime: ReadingTime.create(Math.max(1, Math.ceil(body.split(/\s+/u).length / 220))),
      ...(options.templateId === undefined ? {} : { templateId: options.templateId }),
    });
  }
}

function aggregateChannel(type: ContentType, channel: BlogContentGenerationOptions["channel"]): BlogContentGenerationOptions["channel"] {
  if (type === "blog-article" && channel === "shopify") {
    return "website";
  }
  if (type === "cta" && channel === "blog") {
    return "website";
  }
  return channel;
}

function contentSEO(
  input: BlogContentGenerationInput,
  draft: BlogContentPackageDraft,
  primaryKeyword: string,
  secondaryKeywords: readonly string[],
): ContentSEO {
  return {
    primaryKeyword: SEOKeyword.create(primaryKeyword),
    secondaryKeywords: secondaryKeywords.map((keyword) => SEOKeyword.create(keyword)),
    metaTitle: MetaTitle.create(draft.metaTitle),
    metaDescription: MetaDescription.create(draft.metaDescription),
    slug: Slug.create(draft.slug),
    searchIntent: normalizedSearchIntent(input),
    indexable: true,
  };
}

function primaryKeywordFor(input: BlogContentGenerationInput): string {
  return input.seoContentPackage?.keywords.primaryKeyword.value ?? input.category ?? input.productTitle;
}

function secondaryKeywordsFor(input: BlogContentGenerationInput): readonly string[] {
  return [
    ...(input.seoContentPackage?.keywords.secondaryKeywords.map((keyword) => keyword.value) ?? []),
    ...(input.features ?? []),
  ].slice(0, 5);
}

function normalizedSearchIntent(input: BlogContentGenerationInput): BlogContentPackage["searchIntent"] {
  const intent = input.searchIntent ?? input.seoContentPackage?.searchIntent ?? "informational";
  return intent === "local" || intent === "comparison" ? "commercial" : intent;
}

function articleBody(draft: BlogContentPackageDraft): string {
  return [
    draft.introduction,
    ...draft.sections.map((section) => `${section.heading}\n${section.paragraphs.join("\n\n")}\n${section.bulletPoints.join("\n")}`),
    ...(draft.faqSection.length === 0
      ? []
      : [`FAQ\n${draft.faqSection.map((item) => `${item.question}\n${item.answer}`).join("\n\n")}`]),
    draft.conclusion,
  ].join("\n\n");
}

function productExamples(input: BlogContentGenerationInput): readonly string[] {
  return [input.productTitle, ...(input.highlights ?? []).slice(0, 2)].map((value) => `Example from source context: ${value}`);
}

function objectionSection(
  sections: readonly BlogSection[],
  options: BlogContentGenerationOptions,
): BlogSection | undefined {
  return options.includeObjectionHandling ? sections.find((section) => /consideration|objection|risk/iu.test(section.heading)) : undefined;
}

function withObjectionSection(
  sections: readonly BlogSection[],
  options: BlogContentGenerationOptions,
): { readonly objectionHandlingSection?: BlogSection } {
  const section = objectionSection(sections, options);
  return section === undefined ? {} : { objectionHandlingSection: section };
}

function cloneAudience(audience: NonNullable<BlogContentGenerationInput["targetAudience"]>): NonNullable<BlogContentGenerationInput["targetAudience"]> {
  return {
    ...audience,
    ...(audience.problems === undefined ? {} : { problems: [...audience.problems] }),
    ...(audience.motivations === undefined ? {} : { motivations: [...audience.motivations] }),
    ...(audience.objections === undefined ? {} : { objections: [...audience.objections] }),
  };
}

function sourceMetadata(
  input: BlogContentGenerationInput,
  options: BlogContentGenerationOptions,
): Readonly<Record<string, unknown>> {
  return {
    productId: input.productId,
    articleType: options.articleType,
    objective: options.objective,
    channel: options.channel,
    searchIntent: normalizedSearchIntent(input),
    ...(input.correlationMetadata?.campaignId === undefined ? {} : { campaignId: input.correlationMetadata.campaignId }),
    ...(input.correlationMetadata?.correlationId === undefined ? {} : { correlationId: input.correlationMetadata.correlationId }),
    ...(input.correlationMetadata?.sourceMarketingAnalysisId === undefined
      ? {}
      : { sourceMarketingAnalysisId: input.correlationMetadata.sourceMarketingAnalysisId }),
    ...(input.correlationMetadata?.customerJourneyReference === undefined
      ? {}
      : { customerJourneyReference: input.correlationMetadata.customerJourneyReference }),
  };
}
