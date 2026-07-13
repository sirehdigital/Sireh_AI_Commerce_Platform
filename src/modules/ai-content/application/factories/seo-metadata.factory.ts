import { MetaDescription, MetaTitle, Slug } from "../../domain/index.js";
import type {
  SEOContentGenerationInput,
  SEOContentGenerationOptions,
  SEOKeywordSet,
} from "../dto/seo-content.types.js";

export interface SEOMetadataDraft {
  readonly seoProductTitle: string;
  readonly metaTitle: MetaTitle;
  readonly metaDescription: MetaDescription;
  readonly slug: Slug;
  readonly h1: string;
  readonly h2Headings: readonly string[];
  readonly seoSummary: string;
}

export class SEOMetadataFactory {
  public create(
    input: SEOContentGenerationInput,
    options: SEOContentGenerationOptions,
    keywordSet: SEOKeywordSet,
  ): SEOMetadataDraft {
    const primary = keywordSet.primaryKeyword.value;
    const brand = input.brand === undefined ? "" : ` | ${input.brand}`;
    const titleBase = `${toTitleCase(primary)}${brand}`;
    const metaTitle = MetaTitle.create(truncateWords(titleBase, options.metaTitleMaxLength));
    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productSubtitle ?? input.category;
    const cta = options.language === "ms" ? "Lihat butiran produk." : "Explore the product details.";
    const descriptionBase =
      options.language === "ms"
        ? `${toTitleCase(primary)} untuk ${this.audience(input)} dengan ${benefit ?? "maklumat produk yang jelas"}. ${cta}`
        : `${toTitleCase(primary)} for ${this.audience(input)} with ${benefit ?? "clear product details"}. ${cta}`;
    const metaDescription = MetaDescription.create(
      truncateWords(descriptionBase, options.metaDescriptionMaxLength),
    );
    const slugSource =
      options.slugStrategy === "primary-keyword" ? primary : `${input.brand ?? ""} ${input.productTitle}`;
    const h1 =
      options.language === "ms"
        ? `${toTitleCase(primary)} untuk ${this.audience(input)}`
        : `${toTitleCase(primary)} for ${this.audience(input)}`;
    const h2Headings = [
      options.language === "ms" ? `Manfaat ${toTitleCase(primary)}` : `${toTitleCase(primary)} Benefits`,
      options.language === "ms" ? "Ciri Produk" : "Product Features",
      options.language === "ms" ? "Maklumat Penggunaan" : "How It Fits Customer Needs",
    ];
    const seoSummary =
      options.language === "ms"
        ? `${input.productTitle} diposisikan untuk carian ${options.searchIntent} dengan kata kunci utama "${primary}".`
        : `${input.productTitle} is positioned for ${options.searchIntent} search intent with primary keyword "${primary}".`;

    return {
      seoProductTitle: metaTitle.value,
      metaTitle,
      metaDescription,
      slug: Slug.create(slugSource),
      h1: truncateWords(h1, 90),
      h2Headings: [...new Set(h2Headings)].map((heading) => truncateWords(heading, 90)),
      seoSummary,
    };
  }

  private audience(input: SEOContentGenerationInput): string {
    return input.marketingAudience?.primaryAudience ?? input.customerPersona ?? "customers";
  }
}

function truncateWords(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const words = value.split(/\s+/u);
  let result = "";

  for (const word of words) {
    const next = result.length === 0 ? word : `${result} ${word}`;
    if (next.length > maxLength) {
      break;
    }
    result = next;
  }

  return result.length === 0 ? value.slice(0, maxLength).trim() : result;
}

function toTitleCase(value: string): string {
  return value.replace(/\b\w/gu, (character) => character.toUpperCase());
}
