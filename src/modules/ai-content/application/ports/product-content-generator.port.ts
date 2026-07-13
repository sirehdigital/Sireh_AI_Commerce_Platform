import type {
  ProductContentGenerationInput,
  ProductContentGenerationOptions,
  ProductContentPackage,
} from "../dto/product-content.types.js";

export interface ProductContentGeneratorPort {
  generate(
    input: ProductContentGenerationInput,
    options: ProductContentGenerationOptions,
  ): ProductContentPackage;
}
