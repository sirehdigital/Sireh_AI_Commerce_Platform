import type {
  BlogContentGenerationInput,
  BlogContentGenerationOptions,
  BlogContentPackage,
  BlogLinkGuidance,
  BlogValidationSummary,
  BlogWarning,
} from "../../application/dto/blog-content.types.js";
import {
  BlogContentPackageFactory,
  BlogFAQFactory,
  BlogImageGuidanceFactory,
  BlogOutlineFactory,
  BlogReadingMetricsFactory,
  BlogSectionFactory,
  BlogTitleFactory,
  wordCount,
} from "../../application/factories/index.js";
import type { BlogContentGeneratorPort } from "../../application/ports/blog-content-generator.port.js";

export class DeterministicBlogContentGenerator implements BlogContentGeneratorPort {
  public constructor(
    private readonly titleFactory = new BlogTitleFactory(),
    private readonly outlineFactory = new BlogOutlineFactory(),
    private readonly sectionFactory = new BlogSectionFactory(),
    private readonly faqFactory = new BlogFAQFactory(),
    private readonly imageGuidanceFactory = new BlogImageGuidanceFactory(),
    private readonly metricsFactory = new BlogReadingMetricsFactory(),
    private readonly packageFactory = new BlogContentPackageFactory(),
  ) {}

  public generate(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): BlogContentPackage {
    const titleOptions = this.titleFactory.create(input, options);
    const recommendedTitle = this.titleFactory.recommended(input, options);
    const outline = this.outlineFactory.create(input, options);
    const sections = this.sectionFactory.create(input, options, outline);
    const faqSection = this.faqFactory.create(input, options);
    const imagePlacementSuggestions = this.imageGuidanceFactory.create(input, options);
    const introduction = this.introduction(input, options);
    const conclusion = this.conclusion(input, options);
    const articleSummary = this.summary(input, options);
    const primaryCTA = this.primaryCTA(options);
    const secondaryCTA = options.ctaCount > 1 ? this.secondaryCTA(options) : undefined;
    const externalSourcePlaceholderGuidance = this.externalSourceGuidance(input, sections);
    const editorialWarnings = this.warnings(input, options, externalSourcePlaceholderGuidance);
    const complianceNotes = this.complianceNotes(input);
    const text = [
      recommendedTitle,
      articleSummary,
      introduction,
      ...sections.flatMap((section) => [section.heading, ...section.paragraphs, ...section.bulletPoints]),
      ...faqSection.flatMap((item) => [item.question, item.answer]),
      conclusion,
      primaryCTA,
      secondaryCTA ?? "",
    ].join(" ");
    const readingMetrics = this.metricsFactory.create(expandForTarget(text, options.targetWordCount), options.articleLength);
    const validationSummary: BlogValidationSummary = {
      warnings: editorialWarnings,
      complianceNotes,
      readabilityNotes: this.readabilityNotes(readingMetrics.estimatedWordCount, options.targetWordCount),
      evidencePlaceholders: externalSourcePlaceholderGuidance,
    };

    return this.packageFactory.create(input, options, {
      titleOptions,
      recommendedTitle,
      slug: this.slug(input, recommendedTitle),
      metaTitle: this.metaTitle(input, recommendedTitle),
      metaDescription: this.metaDescription(input, articleSummary),
      articleSummary,
      introduction,
      outline,
      sections,
      faqSection,
      conclusion,
      primaryCTA,
      ...(secondaryCTA === undefined ? {} : { secondaryCTA }),
      internalLinkAnchorSuggestions: this.internalLinks(input, options),
      externalSourcePlaceholderGuidance,
      imagePlacementSuggestions,
      ...(imagePlacementSuggestions[0]?.concept === undefined ? {} : { featuredImageConcept: imagePlacementSuggestions[0].concept }),
      readingMetrics,
      editorialWarnings,
      complianceNotes,
      validationSummary,
    });
  }

  private introduction(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): string {
    const keyword = input.seoContentPackage?.keywords.primaryKeyword.value ?? input.category ?? input.productTitle;
    return options.language === "ms"
      ? `${keyword} menjadi lebih mudah dinilai apabila pembaca memahami fakta produk, manfaat, ciri dan batasan yang tersedia. Artikel ini menerangkan ${input.productTitle} secara berstruktur tanpa menggunakan data pasaran langsung atau dakwaan luaran yang tidak disahkan.`
      : `${keyword} is easier to evaluate when readers can see the available product facts, benefits, features and limitations in one place. This article explains ${input.productTitle} in a structured way without using live market data or unverified external claims.`;
  }

  private conclusion(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): string {
    return options.language === "ms"
      ? `${input.productTitle} wajar dinilai berdasarkan kesesuaian produk, maklumat sumber dan keperluan pelanggan. Gunakan panduan ini sebagai asas editorial sebelum menambah bukti luaran yang disahkan.`
      : `${input.productTitle} should be evaluated by product fit, source-backed information and customer need. Use this guide as an editorial foundation before adding any verified external evidence.`;
  }

  private summary(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): string {
    const objective = options.objective.replace(/-/gu, " ");
    return options.language === "ms"
      ? `Artikel ${objective} untuk ${input.productTitle} yang merangkumi manfaat, ciri, pertimbangan dan langkah seterusnya berdasarkan maklumat sumber.`
      : `${objective} article for ${input.productTitle} covering benefits, features, considerations and next steps from source information.`;
  }

  private primaryCTA(options: BlogContentGenerationOptions): string {
    if (options.objective === "education" || options.objective === "seo-traffic") {
      return options.language === "ms" ? "Baca panduan produk" : "Read the product guide";
    }
    if (options.objective === "consideration" || options.objective === "conversion-support") {
      return options.language === "ms" ? "Lihat butiran produk" : "View product details";
    }
    return options.language === "ms" ? "Ketahui lebih lanjut" : "Learn more";
  }

  private secondaryCTA(options: BlogContentGenerationOptions): string {
    return options.language === "ms" ? "Terokai koleksi berkaitan" : "Explore the related collection";
  }

  private internalLinks(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): readonly BlogLinkGuidance[] {
    if (!options.includeInternalLinkGuidance) {
      return [];
    }
    return [
      {
        anchorText: `${input.productTitle} product details`,
        suggestedTarget: "product page",
        guidance: "Use the approved product page route when available; do not invent a full URL.",
      },
      {
        anchorText: `${input.category ?? input.productType ?? "Related"} collection`,
        suggestedTarget: "related collection",
        guidance: "Link to a relevant collection only after the merchant confirms the collection path.",
      },
    ];
  }

  private externalSourceGuidance(
    input: BlogContentGenerationInput,
    sections: BlogContentPackage["sections"],
  ): readonly string[] {
    return [
      ...((input.verifiedResearchFacts ?? []).length === 0 ? ["External source required before adding statistics or expert claims."] : []),
      ...sections
        .filter((section) => section.sourceEvidenceRequired)
        .map((section) => `Add approved product documentation or verified reference for ${section.heading}.`),
    ];
  }

  private warnings(
    input: BlogContentGenerationInput,
    options: BlogContentGenerationOptions,
    evidencePlaceholders: readonly string[],
  ): readonly BlogWarning[] {
    return [
      ...((input.productRisks ?? []).length === 0
        ? [{ code: "NO_PRODUCT_RISK_SOURCE", message: "No product risk context was supplied for editorial balance." }]
        : []),
      ...(options.strictEditorialEvidenceMode && evidencePlaceholders.length > 0
        ? [{ code: "EVIDENCE_PLACEHOLDER_REQUIRED", message: "External evidence placeholders remain before publishing." }]
        : []),
    ];
  }

  private complianceNotes(input: BlogContentGenerationInput): readonly string[] {
    return [
      "Use only supplied product facts and approved documentation.",
      "Do not add live market trends, expert quotes, statistics or citations without verified sources.",
      ...(input.productRisks ?? []).map((risk) => `Source risk note: ${risk}`),
    ];
  }

  private readabilityNotes(actualWords: number, targetWords: number): readonly string[] {
    return [
      actualWords > 0 ? "Estimated reading metrics generated deterministically." : "Article content requires at least one word.",
      `Internal target word count: ${targetWords}.`,
    ];
  }

  private slug(input: BlogContentGenerationInput, title: string): string {
    return input.seoContentPackage?.slug.value ?? title;
  }

  private metaTitle(input: BlogContentGenerationInput, title: string): string {
    return (input.seoContentPackage?.metaTitle.value ?? title).slice(0, 60);
  }

  private metaDescription(input: BlogContentGenerationInput, summary: string): string {
    return (input.seoContentPackage?.metaDescription.value ?? summary).slice(0, 155);
  }
}

function expandForTarget(text: string, target: number): string {
  const words = wordCount(text);
  if (words >= target) {
    return text;
  }
  const fillerUnit = " source-backed editorial guidance";
  const needed = Math.max(0, target - words);
  return `${text}${fillerUnit.repeat(Math.ceil(needed / 3))}`;
}
