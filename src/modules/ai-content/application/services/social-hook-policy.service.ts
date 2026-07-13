import type {
  SocialHookStyle,
  SocialMediaContentGenerationInput,
  SocialMediaContentGenerationOptions,
} from "../dto/social-media-content.types.js";

export class SocialHookPolicyService {
  public build(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): string {
    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const audience = input.targetAudience?.primaryAudience ?? input.customerPersona ?? "customers";
    const hookStyle = this.safeStyle(options.hookStyle, input);

    if (options.language === "ms") {
      return this.malayHook(input.productTitle, benefit, audience, hookStyle);
    }

    return this.englishHook(input.productTitle, benefit, audience, hookStyle);
  }

  private englishHook(productTitle: string, benefit: string, audience: string, style: SocialHookStyle): string {
    const hooks: Record<SocialHookStyle, string> = {
      question: `Looking for a smarter way to choose ${productTitle}?`,
      problem: `Choosing the right ${productTitle} should feel clear, not complicated.`,
      benefit: `${productTitle} helps ${audience} focus on ${benefit}.`,
      curiosity: `A closer look at what makes ${productTitle} worth exploring.`,
      educational: `Here is what to know before choosing ${productTitle}.`,
      direct: `Meet ${productTitle}: built around ${benefit}.`,
      lifestyle: `${productTitle} brings practical value into everyday routines.`,
      contrarian: `More features are not always better. The right fit matters most.`,
    };

    return hooks[style];
  }

  private malayHook(productTitle: string, benefit: string, audience: string, style: SocialHookStyle): string {
    const hooks: Record<SocialHookStyle, string> = {
      question: `Sedang mencari pilihan yang lebih sesuai untuk ${productTitle}?`,
      problem: `Memilih ${productTitle} patut mudah difahami, bukan mengelirukan.`,
      benefit: `${productTitle} membantu ${audience} memberi tumpuan kepada ${benefit}.`,
      curiosity: `Lihat mengapa ${productTitle} wajar dipertimbangkan.`,
      educational: `Ini perkara penting sebelum memilih ${productTitle}.`,
      direct: `Kenali ${productTitle}: direka untuk ${benefit}.`,
      lifestyle: `${productTitle} membawa nilai praktikal dalam rutin harian.`,
      contrarian: `Lebih banyak ciri tidak semestinya lebih baik. Kesesuaian lebih penting.`,
    };

    return hooks[style];
  }

  private safeStyle(
    style: SocialHookStyle,
    input: SocialMediaContentGenerationInput,
  ): SocialHookStyle {
    if (style === "contrarian" && input.features?.length === undefined) {
      return "benefit";
    }

    return style;
  }
}
