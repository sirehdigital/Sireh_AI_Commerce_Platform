import type { EmailContentGenerationInput, EmailContentGenerationOptions } from "../dto/email-content.types.js";

export class EmailSubjectLineFactory {
  public create(input: EmailContentGenerationInput, options: EmailContentGenerationOptions): readonly string[] {
    const productName = options.includePersonalization ? "{{product_name}}" : input.productTitle;
    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const lines =
      options.language === "ms"
        ? [
            `Kenali ${productName}`,
            `${benefit} untuk rutin anda`,
            `Butiran penting tentang ${productName}`,
            options.campaignType === "abandoned-cart" ? `Masih mempertimbangkan ${productName}?` : `Pilihan produk untuk anda`,
            options.campaignType === "product-launch" ? `${productName} kini tersedia untuk diterokai` : `Lihat butiran produk`,
            `Panduan ringkas sebelum memilih ${productName}`,
          ]
        : [
            `Meet ${productName}`,
            `${benefit} for your routine`,
            `A closer look at ${productName}`,
            options.campaignType === "abandoned-cart" ? `Still considering ${productName}?` : `A product pick for you`,
            options.campaignType === "product-launch" ? `${productName} is ready to explore` : `Explore the product details`,
            `What to know before choosing ${productName}`,
          ];

    return dedupe(lines.map((line) => truncate(line, 72))).slice(0, options.subjectLineCount);
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  const boundary = value.slice(0, max + 1).lastIndexOf(" ");
  return value.slice(0, boundary > 16 ? boundary : max).trim();
}

function dedupe(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
