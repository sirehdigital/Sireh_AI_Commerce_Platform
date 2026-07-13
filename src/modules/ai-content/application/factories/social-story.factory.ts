import type {
  SocialMediaContentGenerationInput,
  SocialMediaContentGenerationOptions,
  SocialStoryFrame,
} from "../dto/social-media-content.types.js";

export class SocialStoryFactory {
  public create(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): readonly SocialStoryFrame[] {
    if (!options.includeStoryContent) {
      return [];
    }

    const benefit = input.benefits?.[0] ?? input.valueProposition ?? input.productTitle;
    const frames = [
      frame(1, input.productTitle, options.language === "ms" ? "Paparan produk ringkas." : "Simple product reveal."),
      frame(2, input.targetAudience?.customerProblems?.[0] ?? "Everyday product choice made simpler."),
      frame(3, benefit),
      frame(4, input.highlights?.[0] ?? input.features?.[0] ?? "Review the key product details."),
      frame(5, options.language === "ms" ? "Apa yang paling penting untuk anda?" : "What matters most to you?"),
      frame(6, options.language === "ms" ? "Lihat butiran produk." : "Explore the product details."),
    ];

    return frames.slice(0, options.storyFrameLimit);
  }
}

function frame(sequence: number, text: string, guidance?: string): SocialStoryFrame {
  return {
    sequence,
    text: text.length <= 72 ? text : `${text.slice(0, 69).trim()}...`,
    ...(guidance === undefined ? {} : { guidance }),
  };
}
