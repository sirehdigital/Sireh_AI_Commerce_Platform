import type { EmailContentGenerationInput, EmailContentGenerationOptions, EmailSection } from "../dto/email-content.types.js";

export class EmailSectionFactory {
  public create(input: EmailContentGenerationInput, options: EmailContentGenerationOptions): readonly EmailSection[] {
    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const feature = input.features?.[0] ?? input.productType ?? input.category ?? "product detail";
    const sections: EmailSection[] = [
      {
        key: "product-value",
        title: options.language === "ms" ? "Nilai produk" : "Product value",
        body: options.language === "ms" ? `${input.productTitle} memberi tumpuan kepada ${benefit}.` : `${input.productTitle} focuses on ${benefit}.`,
      },
      ...(options.includeProductHighlights
        ? [
            {
              key: "highlights",
              title: options.language === "ms" ? "Sorotan utama" : "Key highlights",
              body: [...(input.highlights ?? []), feature].slice(0, 3).join("; "),
            },
          ]
        : []),
      ...(options.includeObjectionHandling
        ? [
            {
              key: "objection-handling",
              title: options.language === "ms" ? "Sebelum anda membuat keputusan" : "Before you decide",
              body:
                input.targetAudience?.objections?.[0] ??
                (options.language === "ms"
                  ? "Semak butiran produk dan pastikan ia sesuai dengan keperluan anda."
                  : "Review the product details and make sure it fits your needs."),
            },
          ]
        : []),
      ...(options.includeTrustSection
        ? [
            {
              key: "trust",
              title: options.language === "ms" ? "Maklumat yang jelas" : "Clear product information",
              body:
                options.language === "ms"
                  ? "Kandungan ini menggunakan maklumat produk yang tersedia dan tidak menambah tuntutan palsu."
                  : "This message uses available product information and does not add fabricated claims.",
            },
          ]
        : []),
      ...(options.includeEducationalSection
        ? [
            {
              key: "education",
              title: options.language === "ms" ? "Tip ringkas" : "Useful takeaway",
              body:
                input.usageGuidance?.[0] ??
                (options.language === "ms"
                  ? "Gunakan maklumat produk untuk menilai kesesuaian sebelum membeli."
                  : "Use the product details to evaluate fit before buying."),
            },
          ]
        : []),
    ];

    return sections.slice(0, options.emailLength === "short" ? 2 : options.emailLength === "medium" ? 4 : sections.length);
  }
}
