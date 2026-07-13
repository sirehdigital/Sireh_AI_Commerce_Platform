import type {
  BlogContentGenerationInput,
  BlogContentGenerationOptions,
  BlogOutlineItem,
  BlogSection,
} from "../dto/blog-content.types.js";

export class BlogSectionFactory {
  public create(
    input: BlogContentGenerationInput,
    options: BlogContentGenerationOptions,
    outline: readonly BlogOutlineItem[],
  ): readonly BlogSection[] {
    return outline.map((item) => this.section(input, options, item));
  }

  private section(input: BlogContentGenerationInput, options: BlogContentGenerationOptions, item: BlogOutlineItem): BlogSection {
    const keyword = input.seoContentPackage?.keywords.primaryKeyword.value ?? input.category ?? input.productTitle;
    const facts = item.supportingFacts.length > 0 ? item.supportingFacts : [input.productTitle];
    const paragraphs = [
      localized(
        options,
        `${item.heading} should be understood through the available product facts for ${input.productTitle}. This section focuses on ${facts[0] ?? input.productTitle} without adding live market data or unsupported claims.`,
        `${item.heading} perlu difahami melalui fakta produk yang tersedia untuk ${input.productTitle}. Bahagian ini memberi fokus kepada ${facts[0] ?? input.productTitle} tanpa menambah data pasaran langsung atau dakwaan yang tidak disokong.`,
      ),
      localized(
        options,
        `For ${audience(input)}, the practical value is clearer when the product is evaluated by fit, evidence and source-backed limitations.`,
        `Untuk ${audience(input)}, nilai praktikal lebih jelas apabila produk dinilai berdasarkan kesesuaian, bukti dan had yang disokong sumber.`,
      ),
    ];

    return {
      order: item.order,
      heading: item.heading,
      purpose: item.purpose,
      paragraphs,
      bulletPoints: facts.slice(0, 4).map((fact) => `Source-supported point: ${fact}`),
      productReferences: [input.productTitle, ...(input.brand === undefined ? [] : [input.brand])],
      keywordGuidance: [
        keyword,
        ...(input.seoContentPackage?.keywords.secondaryKeywords.map((secondaryKeyword) => secondaryKeyword.value) ?? []),
        ...(input.seoContentPackage?.keywords.longTailKeywords.map((longTailKeyword) => longTailKeyword.value) ?? []),
      ].slice(0, 4),
      ...(options.includeInternalLinkGuidance ? { internalLinkAnchorSuggestion: `${input.productTitle} product details` } : {}),
      ...(options.includeImagePlacementGuidance ? { imagePlacementSuggestion: `Place a relevant product visual near ${item.heading}.` } : {}),
      complianceNote: "Use only verified product facts and approved documentation.",
      sourceEvidenceRequired: item.primaryTopic === "considerations" || item.primaryTopic === "criteria",
    };
  }
}

function audience(input: BlogContentGenerationInput): string {
  return input.targetAudience?.primaryAudience ?? input.customerSegment ?? "the intended audience";
}

function localized(options: BlogContentGenerationOptions, en: string, ms: string): string {
  return options.language === "ms" ? ms : en;
}
