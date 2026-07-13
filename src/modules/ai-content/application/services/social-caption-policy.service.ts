import { captionLimit } from "../factories/social-media-content-options.factory.js";
import type {
  SocialMediaContentGenerationInput,
  SocialMediaContentGenerationOptions,
} from "../dto/social-media-content.types.js";

export class SocialCaptionPolicyService {
  public buildPrimary(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
    hook: string,
    cta: string,
  ): string {
    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const feature = input.features?.[0] ?? input.productType ?? input.category ?? "product detail";
    const riskNote = input.productRisks?.[0] === undefined ? "" : `\n\nNote: ${input.productRisks[0]}`;
    const emoji = options.includeEmojis ? this.emoji(options.platform) : "";
    const lines =
      options.language === "ms"
        ? [
            `${emoji}${hook}`,
            `Nilai utama: ${benefit}.`,
            `Ciri sokongan: ${feature}.`,
            `Sesuai untuk ${input.targetAudience?.primaryAudience ?? "pengguna yang mahukan pilihan yang jelas"}.`,
            cta,
          ]
        : [
            `${emoji}${hook}`,
            `Core value: ${benefit}.`,
            `Supporting detail: ${feature}.`,
            `Made for ${input.targetAudience?.primaryAudience ?? "customers who want a clearer choice"}.`,
            cta,
          ];

    return this.truncate(`${lines.filter(Boolean).join("\n")}${riskNote}`, captionLimit(options.platform, options.captionLength));
  }

  public buildShort(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
    hook: string,
    cta: string,
  ): string {
    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const text =
      options.language === "ms"
        ? `${hook} ${benefit}. ${cta}`
        : `${hook} ${benefit}. ${cta}`;

    return this.truncate(text, captionLimit(options.platform, "short"));
  }

  public buildLong(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
    hook: string,
    cta: string,
  ): string | undefined {
    if (options.captionLength !== "long" && options.platform !== "facebook" && options.platform !== "linkedin") {
      return undefined;
    }

    const benefits = (input.benefits ?? []).slice(0, 3).map((benefit) => `- ${benefit}`).join("\n");
    const features = (input.features ?? []).slice(0, 2).map((feature) => `- ${feature}`).join("\n");
    const text =
      options.language === "ms"
        ? `${hook}\n\nMengapa ia relevan:\n${benefits || "- Berdasarkan maklumat produk yang tersedia."}\n\nButiran sokongan:\n${features || "- Semak butiran produk sebelum membeli."}\n\n${cta}`
        : `${hook}\n\nWhy it matters:\n${benefits || "- Based on available product information."}\n\nSupporting details:\n${features || "- Review the product details before buying."}\n\n${cta}`;

    return this.truncate(text, captionLimit(options.platform, "long"));
  }

  public truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    const trimmed = value.slice(0, maxLength + 1);
    const boundary = trimmed.lastIndexOf(" ");
    return `${trimmed.slice(0, boundary > 20 ? boundary : maxLength).trim()}.`;
  }

  private emoji(platform: SocialMediaContentGenerationOptions["platform"]): string {
    return platform === "instagram" ? "✨ " : platform === "tiktok" ? "▶ " : "";
  }
}
