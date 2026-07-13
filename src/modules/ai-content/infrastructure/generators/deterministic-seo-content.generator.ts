import type {
  SEOContentGenerationInput,
  SEOContentGenerationOptions,
  SEOContentPackage,
  SEOImageAltTextSuggestion,
  SEOIndexabilityRecommendation,
  SEOInternalLinkAnchorSuggestion,
  SEOKeywordPlacementGuidance,
  SEOReadinessCheck,
  SEOStructuredDataHint,
} from "../../application/dto/seo-content.types.js";
import {
  SEOContentPackageFactory,
  SEOKeywordSetFactory,
  SEOMetadataFactory,
} from "../../application/factories/index.js";
import type { SEOContentGeneratorPort } from "../../application/ports/seo-content-generator.port.js";

export class DeterministicSEOContentGenerator implements SEOContentGeneratorPort {
  public constructor(
    private readonly keywordSetFactory = new SEOKeywordSetFactory(),
    private readonly metadataFactory = new SEOMetadataFactory(),
    private readonly packageFactory = new SEOContentPackageFactory(),
  ) {}

  public generate(
    input: SEOContentGenerationInput,
    options: SEOContentGenerationOptions,
  ): SEOContentPackage {
    const keywordSet = this.keywordSetFactory.create(input, options);
    const metadata = this.metadataFactory.create(input, options, keywordSet);
    const warnings = this.warnings(input);
    const readiness: SEOReadinessCheck = {
      passed: warnings.length === 0,
      checks: [
        "primary_keyword_selected",
        "metadata_composed",
        "slug_created",
        "content_aggregates_mapped",
      ],
      warnings,
    };

    return this.packageFactory.create(input, options, {
      keywordSet,
      metadata,
      imageAltTextSuggestions: options.includeImageAltText ? this.altText(input, keywordSet.primaryKeyword.value) : [],
      internalLinkAnchors: options.includeInternalLinks ? this.internalLinks(input) : [],
      ...(options.includeCanonical ? { canonicalPath: this.canonicalPath(input, metadata.slug.value) } : {}),
      indexability: this.indexability(input),
      structuredDataHints: this.structuredDataHints(input),
      keywordPlacementGuidance: this.keywordPlacement(keywordSet.primaryKeyword.value, options.language),
      warnings,
      readiness,
    });
  }

  private altText(input: SEOContentGenerationInput, primaryKeyword: string): readonly SEOImageAltTextSuggestion[] {
    return [
      {
        text: `${input.productTitle} ${primaryKeyword}`.slice(0, 120),
        context: "product-level",
      },
      ...(input.category === undefined
        ? []
        : [{ text: `${input.productTitle} in ${input.category}`.slice(0, 120), context: "category" }]),
    ];
  }

  private internalLinks(input: SEOContentGenerationInput): readonly SEOInternalLinkAnchorSuggestion[] {
    return [
      ...(input.category === undefined
        ? []
        : [
            {
              anchorText: `${input.category} collection`,
              context: "related collection",
              suggestedPath: `/collections/${slugPart(input.category)}`,
            },
          ]),
      ...(input.brand === undefined
        ? []
        : [
            {
              anchorText: `${input.brand} products`,
              context: "brand page",
              suggestedPath: `/brands/${slugPart(input.brand)}`,
            },
          ]),
      { anchorText: "Product guide", context: "usage guide" },
    ];
  }

  private canonicalPath(input: SEOContentGenerationInput, slug: string): string {
    if (input.category !== undefined) {
      return `/products/${slug}`;
    }

    return `/pages/${slug}`;
  }

  private indexability(input: SEOContentGenerationInput): SEOIndexabilityRecommendation {
    return input.productRiskFlags?.some((flag) => /restricted|legal|unsafe/iu.test(flag))
      ? "noindex-follow"
      : "index-follow";
  }

  private structuredDataHints(input: SEOContentGenerationInput): readonly SEOStructuredDataHint[] {
    return [
      { type: "Product", reason: "Product identity is available." },
      ...(input.brand === undefined ? [] : [{ type: "Brand" as const, reason: "Brand name is available." }]),
      ...(input.productContentPackage?.faq.length === undefined || input.productContentPackage.faq.length === 0
        ? []
        : [{ type: "FAQPage" as const, reason: "Product FAQ content is available." }]),
      { type: "BreadcrumbList", reason: "Product and category context can support breadcrumbs." },
    ];
  }

  private keywordPlacement(
    primaryKeyword: string,
    language: SEOContentGenerationOptions["language"],
  ): readonly SEOKeywordPlacementGuidance[] {
    const description =
      language === "ms"
        ? `Gunakan "${primaryKeyword}" secara semula jadi dalam tajuk, meta description, H1 dan pembukaan halaman.`
        : `Use "${primaryKeyword}" naturally in the title, meta description, H1 and opening copy.`;

    return [
      { location: "meta-title", guidance: "Include the primary keyword once." },
      { location: "meta-description", guidance: "Include the primary keyword naturally with one grounded benefit." },
      { location: "page-copy", guidance: description },
    ];
  }

  private warnings(input: SEOContentGenerationInput): readonly string[] {
    return [
      ...((input.productDescription ?? "").trim().length === 0
        ? ["Product description is missing; SEO summary uses available structured facts."]
        : []),
      ...((input.benefits ?? []).length === 0
        ? ["No explicit benefits supplied; keyword variants are limited."]
        : []),
    ];
  }
}

function slugPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/gu, "-")
    .replace(/[^a-z0-9-]/gu, "")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "");
}
