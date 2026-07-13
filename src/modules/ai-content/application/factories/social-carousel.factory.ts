import type {
  SocialCarouselSlide,
  SocialMediaContentGenerationInput,
  SocialMediaContentGenerationOptions,
} from "../dto/social-media-content.types.js";

export class SocialCarouselFactory {
  public create(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): readonly SocialCarouselSlide[] {
    if (!options.includeCarouselContent) {
      return [];
    }

    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const feature = input.features?.[0] ?? input.productType ?? input.category ?? "Product detail";
    const slides: readonly Omit<SocialCarouselSlide, "sequence">[] = [
      { title: trimCopy(input.productTitle, 52), body: trimCopy(benefit, 90) },
      { title: options.language === "ms" ? "Masalah pelanggan" : "Customer problem", body: trimCopy(input.targetAudience?.customerProblems?.[0] ?? "Finding a product that fits everyday needs.", 90) },
      { title: options.language === "ms" ? "Penyelesaian produk" : "Product solution", body: trimCopy(input.valueProposition ?? benefit, 90) },
      { title: options.language === "ms" ? "Manfaat utama" : "Key benefit", body: trimCopy(benefit, 90) },
      { title: options.language === "ms" ? "Ciri sokongan" : "Supporting feature", body: trimCopy(feature, 90) },
      { title: options.language === "ms" ? "Langkah seterusnya" : "Next step", body: options.language === "ms" ? "Lihat butiran produk sebelum membuat keputusan." : "Explore the product details before deciding." },
    ];

    return slides.slice(0, options.carouselSlideLimit).map((slide, index) => ({
      sequence: index + 1,
      ...slide,
    }));
  }
}

function trimCopy(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const trimmed = value.slice(0, maxLength + 1);
  return `${trimmed.slice(0, Math.max(0, trimmed.lastIndexOf(" "))).trim()}.`;
}
