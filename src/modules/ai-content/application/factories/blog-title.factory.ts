import type {
  BlogContentGenerationInput,
  BlogContentGenerationOptions,
  BlogTitleOption,
} from "../dto/blog-content.types.js";

export class BlogTitleFactory {
  public create(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): readonly BlogTitleOption[] {
    const product = input.productTitle;
    const keyword = input.seoContentPackage?.keywords.primaryKeyword.value ?? input.category ?? product;
    const audience = input.targetAudience?.primaryAudience ?? input.customerSegment ?? input.targetMarket ?? "customers";

    return uniqueOptions([
      { style: "product-guide", title: localized(options, `${product}: A practical product guide`, `Panduan praktikal untuk ${product}`) },
      { style: "educational", title: localized(options, `What to know about ${keyword}`, `Apa yang perlu diketahui tentang ${keyword}`) },
      { style: "benefit-led", title: localized(options, `How ${product} supports ${benefit(input)}`, `Bagaimana ${product} menyokong ${benefit(input)}`) },
      { style: "question-based", title: localized(options, `Is ${product} right for ${audience}?`, `Adakah ${product} sesuai untuk ${audience}?`) },
      { style: "buying-guide", title: localized(options, `A buyer's guide to choosing ${keyword}`, `Panduan pembeli untuk memilih ${keyword}`) },
      { style: "problem-solution", title: localized(options, `${problem(input)}: a grounded product overview`, `${problem(input)}: gambaran produk yang berasas`) },
    ]).slice(0, 6);
  }

  public recommended(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): string {
    const titles = this.create(input, options);
    const preferred = titles.find((title) => title.style === preferredStyle(options.articleType));
    return (preferred ?? titles[0])?.title ?? input.productTitle;
  }
}

function preferredStyle(articleType: BlogContentGenerationOptions["articleType"]): string {
  if (articleType === "buying-guide") {
    return "buying-guide";
  }
  if (articleType === "problem-solution-article") {
    return "problem-solution";
  }
  if (articleType === "benefits-article") {
    return "benefit-led";
  }
  return "product-guide";
}

function benefit(input: BlogContentGenerationInput): string {
  return input.benefits?.[0] ?? input.valueProposition ?? "everyday product decisions";
}

function problem(input: BlogContentGenerationInput): string {
  return input.targetAudience?.problems?.[0] ?? input.productRisks?.[0] ?? "Product questions";
}

function localized(options: BlogContentGenerationOptions, en: string, ms: string): string {
  return options.language === "ms" ? ms : en;
}

function uniqueOptions(options: readonly BlogTitleOption[]): readonly BlogTitleOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.title.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
