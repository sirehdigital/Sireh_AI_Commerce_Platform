import type {
  EmailContentGenerationInput,
  EmailContentGenerationOptions,
  EmailContentPackage,
} from "../dto/email-content.types.js";

export interface EmailContentGeneratorPort {
  generate(input: EmailContentGenerationInput, options: EmailContentGenerationOptions): EmailContentPackage;
}
