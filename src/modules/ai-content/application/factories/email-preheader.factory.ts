import type { EmailContentGenerationInput, EmailContentGenerationOptions } from "../dto/email-content.types.js";

export class EmailPreheaderFactory {
  public create(input: EmailContentGenerationInput, options: EmailContentGenerationOptions): readonly string[] {
    const feature = input.features?.[0] ?? input.productType ?? input.category ?? "product details";
    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const preheaders =
      options.language === "ms"
        ? [
            `Lihat manfaat, ciri dan langkah seterusnya yang jelas.`,
            `${feature} dengan konteks produk yang tersedia.`,
            `${benefit} tanpa tuntutan yang tidak disahkan.`,
            `Teruskan dengan butiran rasmi produk.`,
          ]
        : [
            `See the benefits, features and a clear next step.`,
            `${feature} with grounded product context.`,
            `${benefit} without unsupported claims.`,
            `Continue with the official product details.`,
          ];

    return preheaders.map((value) => truncate(value, 110)).slice(0, options.preheaderCount);
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  const boundary = value.slice(0, max + 1).lastIndexOf(" ");
  return value.slice(0, boundary > 20 ? boundary : max).trim();
}
