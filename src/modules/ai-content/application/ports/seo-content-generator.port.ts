import type {
  SEOContentGenerationInput,
  SEOContentGenerationOptions,
  SEOContentPackage,
} from "../dto/seo-content.types.js";

export interface SEOContentGeneratorPort {
  generate(input: SEOContentGenerationInput, options: SEOContentGenerationOptions): SEOContentPackage;
}
