import { captionLimit, maxHashtags } from "../factories/social-media-content-options.factory.js";
import type {
  SocialMediaContentGenerationOptions,
  SocialMediaContentPackage,
} from "../dto/social-media-content.types.js";
import { SocialPlatformCompatibilityError } from "../errors/product-content.errors.js";

export class SocialPlatformCompatibilityService {
  public validate(
    contentPackage: SocialMediaContentPackage,
    options: SocialMediaContentGenerationOptions,
  ): void {
    const errors = [
      ...(contentPackage.primaryCaption.length > captionLimit(options.platform, options.captionLength)
        ? ["primary_caption_too_long"]
        : []),
      ...(contentPackage.hashtags.length > maxHashtags(options.platform) ? ["too_many_hashtags"] : []),
      ...(options.platform === "x" && contentPackage.primaryCaption.length > 280 ? ["x_caption_too_long"] : []),
      ...(options.platform === "linkedin" && contentPackage.hashtags.length > 3 ? ["linkedin_hashtag_limit"] : []),
      ...(options.language !== "en" && options.language !== "ms" ? ["unsupported_language"] : []),
    ];

    if (errors.length > 0) {
      throw new SocialPlatformCompatibilityError("Social content is incompatible with the selected platform.", {
        errors,
      });
    }
  }
}
