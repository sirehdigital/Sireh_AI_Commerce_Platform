import type {
  BlogArticleLength,
  BlogArticleType,
  BlogChannel,
  BlogContentGenerationOptions,
  BlogContentGenerationOptionsInput,
  BlogObjective,
} from "../dto/blog-content.types.js";
import {
  InvalidBlogLengthError,
  UnsupportedBlogArticleTypeError,
  UnsupportedBlogChannelError,
  UnsupportedBlogLanguageError,
  UnsupportedBlogObjectiveError,
} from "../errors/product-content.errors.js";

const ARTICLE_TYPES: readonly BlogArticleType[] = [
  "educational-article",
  "product-guide",
  "buying-guide",
  "how-to-article",
  "faq-article",
  "problem-solution-article",
  "feature-spotlight",
  "benefits-article",
  "product-comparison-framework",
  "brand-story",
  "product-launch-article",
  "list-article",
  "myth-versus-fact-framework",
  "beginner-guide",
  "customer-objection-article",
  "use-case-article",
  "product-care-article",
  "industry-insight-framework",
  "seasonal-article",
  "trend-article",
];

const OBJECTIVES: readonly BlogObjective[] = [
  "awareness",
  "education",
  "seo-traffic",
  "product-discovery",
  "consideration",
  "conversion-support",
  "objection-handling",
  "brand-authority",
  "customer-support",
  "retention",
  "product-launch",
  "relationship-building",
];

const CHANNELS: readonly BlogChannel[] = ["blog", "website", "shopify", "generic"];
const LENGTH_RANGES: Record<BlogArticleLength, readonly [number, number]> = {
  short: [500, 800],
  medium: [800, 1200],
  long: [1200, 1800],
  comprehensive: [1800, 2500],
};

export class BlogContentOptionsFactory {
  public create(input: BlogContentGenerationOptionsInput = {}): BlogContentGenerationOptions {
    const articleType = input.articleType ?? "product-guide";
    const objective = input.objective ?? defaultObjective(articleType);
    const channel = input.channel ?? "blog";
    const language = input.language ?? "en";
    const articleLength = input.articleLength ?? "medium";

    if (!ARTICLE_TYPES.includes(articleType)) {
      throw new UnsupportedBlogArticleTypeError(articleType);
    }
    if (!OBJECTIVES.includes(objective)) {
      throw new UnsupportedBlogObjectiveError(objective);
    }
    if (!CHANNELS.includes(channel)) {
      throw new UnsupportedBlogChannelError(channel);
    }
    if (language !== "en" && language !== "ms") {
      throw new UnsupportedBlogLanguageError(language);
    }

    const [minWords, maxWords] = LENGTH_RANGES[articleLength];
    const targetWordCount = clamp(input.targetWordCount ?? Math.round((minWords + maxWords) / 2), minWords, maxWords);
    const sectionCount = clamp(input.sectionCount ?? defaultSectionCount(articleLength, articleType), 3, 10);

    if (targetWordCount <= 0 || sectionCount <= 0) {
      throw new InvalidBlogLengthError("Blog length configuration must produce positive word and section counts.", {
        targetWordCount,
        sectionCount,
      });
    }

    return {
      articleType,
      objective,
      channel,
      language,
      tone: input.tone ?? defaultTone(objective),
      articleLength,
      targetWordCount,
      sectionCount,
      headingDepth: input.headingDepth ?? "h2",
      faqCount: clamp(input.faqCount ?? 4, 0, 8),
      ctaCount: clamp(input.ctaCount ?? 2, 1, 3),
      includeProductExamples: input.includeProductExamples ?? true,
      includeProductComparisonFramework:
        input.includeProductComparisonFramework ?? articleType === "product-comparison-framework",
      includeObjectionHandling:
        input.includeObjectionHandling ?? (articleType === "customer-objection-article" || objective === "objection-handling"),
      includeFAQ: input.includeFAQ ?? true,
      includeInternalLinkGuidance: input.includeInternalLinkGuidance ?? true,
      includeExternalSourcePlaceholders: input.includeExternalSourcePlaceholders ?? true,
      includeImagePlacementGuidance: input.includeImagePlacementGuidance ?? true,
      includeFeaturedImageConcept: input.includeFeaturedImageConcept ?? true,
      includeSEOMetadata: input.includeSEOMetadata ?? true,
      includeStructuredSummary: input.includeStructuredSummary ?? true,
      strictClaimSafetyMode: input.strictClaimSafetyMode ?? true,
      strictEditorialEvidenceMode: input.strictEditorialEvidenceMode ?? true,
      strictSEOMode: input.strictSEOMode ?? true,
      strictReadabilityMode: input.strictReadabilityMode ?? true,
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
    };
  }
}

export function blogLengthRange(length: BlogArticleLength): readonly [number, number] {
  return LENGTH_RANGES[length];
}

function defaultObjective(articleType: BlogArticleType): BlogObjective {
  if (articleType === "buying-guide" || articleType === "product-comparison-framework") {
    return "consideration";
  }
  if (articleType === "customer-objection-article") {
    return "objection-handling";
  }
  if (articleType === "product-launch-article") {
    return "product-launch";
  }
  if (articleType === "brand-story") {
    return "brand-authority";
  }
  return "education";
}

function defaultTone(objective: BlogObjective): BlogContentGenerationOptions["tone"] {
  if (objective === "brand-authority") {
    return "authoritative";
  }
  if (objective === "conversion-support" || objective === "product-launch") {
    return "persuasive";
  }
  return "educational";
}

function defaultSectionCount(length: BlogArticleLength, articleType: BlogArticleType): number {
  const base: Record<BlogArticleLength, number> = {
    short: 4,
    medium: 5,
    long: 7,
    comprehensive: 9,
  };
  return articleType === "faq-article" ? Math.max(4, base[length] - 1) : base[length];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
