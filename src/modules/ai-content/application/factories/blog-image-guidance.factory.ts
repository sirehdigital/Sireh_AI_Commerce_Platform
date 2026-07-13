import type { BlogContentGenerationInput, BlogContentGenerationOptions, BlogImageGuidance } from "../dto/blog-content.types.js";

export class BlogImageGuidanceFactory {
  public create(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): readonly BlogImageGuidance[] {
    if (!options.includeImagePlacementGuidance) {
      return [];
    }

    return [
      {
        placement: "featured-image",
        concept: options.includeFeaturedImageConcept
          ? `Clean editorial image concept for ${input.productTitle} using supplied product visuals.`
          : "Featured image concept disabled by options.",
        altText: `${input.productTitle} product guide visual`,
      },
      {
        placement: "benefits-section",
        concept: `Visual support for ${input.benefits?.[0] ?? input.productTitle} without inventing results.`,
        altText: `${input.productTitle} benefit explanation`,
      },
      {
        placement: "features-section",
        concept: `Feature-detail placement for ${input.features?.[0] ?? input.productTitle}.`,
        altText: `${input.productTitle} feature detail`,
      },
    ];
  }
}
