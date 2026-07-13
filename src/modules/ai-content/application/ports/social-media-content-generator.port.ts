import type {
  SocialMediaContentGenerationInput,
  SocialMediaContentGenerationOptions,
  SocialMediaContentPackage,
} from "../dto/social-media-content.types.js";

export interface SocialMediaContentGeneratorPort {
  generate(
    input: SocialMediaContentGenerationInput,
    options: SocialMediaContentGenerationOptions,
  ): SocialMediaContentPackage;
}
