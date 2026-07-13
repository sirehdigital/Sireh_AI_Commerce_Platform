import type {
  BlogContentGenerationInput,
  BlogContentGenerationOptions,
  BlogContentPackage,
} from "../dto/blog-content.types.js";

export interface BlogContentGeneratorPort {
  generate(input: BlogContentGenerationInput, options: BlogContentGenerationOptions): BlogContentPackage;
}
