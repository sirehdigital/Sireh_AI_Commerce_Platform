import type { BlogContentGenerationInput, BlogContentGenerationOptions, BlogFAQItem } from "../dto/blog-content.types.js";

export class BlogFAQFactory {
  public create(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): readonly BlogFAQItem[] {
    if (!options.includeFAQ || options.faqCount === 0) {
      return [];
    }

    const items: readonly BlogFAQItem[] = [
      {
        question: options.language === "ms" ? `Apakah ${input.productTitle}?` : `What is ${input.productTitle}?`,
        answer: input.productDescription ?? `${input.productTitle} is described using the supplied product information only.`,
        evidenceRequired: false,
      },
      {
        question: options.language === "ms" ? `Siapakah yang sesuai untuk ${input.productTitle}?` : `Who is ${input.productTitle} for?`,
        answer: input.targetAudience?.description ?? input.customerSegment ?? "Use the merchant-approved audience context before publishing.",
        evidenceRequired: input.targetAudience?.description === undefined && input.customerSegment === undefined,
      },
      {
        question: options.language === "ms" ? "Apakah manfaat utama?" : "What are the main benefits?",
        answer: (input.benefits ?? []).slice(0, 3).join("; ") || "Add verified benefit context before making stronger claims.",
        evidenceRequired: (input.benefits ?? []).length === 0,
      },
      {
        question: options.language === "ms" ? "Apakah perkara yang perlu dipertimbangkan?" : "What should customers consider?",
        answer: (input.productRisks ?? []).slice(0, 3).join("; ") || "Review product limitations, usage notes and merchant policies before publishing.",
        evidenceRequired: (input.productRisks ?? []).length === 0,
      },
      {
        question: options.language === "ms" ? "Bagaimana produk ini digunakan?" : "How is this product used?",
        answer: (input.usageGuidance ?? []).slice(0, 3).join("; ") || "Add approved usage guidance if the article includes step-by-step instructions.",
        evidenceRequired: (input.usageGuidance ?? []).length === 0,
      },
    ];

    return items.slice(0, options.faqCount);
  }
}
