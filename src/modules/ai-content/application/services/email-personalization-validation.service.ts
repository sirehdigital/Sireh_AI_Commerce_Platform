import type { PersonalizationToken } from "../dto/email-content.types.js";
import { InvalidPersonalizationTokenError } from "../errors/product-content.errors.js";

const TOKEN_PATTERN = /\{\{[a-z_]+\}\}/gu;

export class EmailPersonalizationValidationService {
  public validateText(value: string, allowedTokens: readonly PersonalizationToken[]): void {
    const tokens = value.match(TOKEN_PATTERN) ?? [];
    const invalid = tokens.filter((token) => !allowedTokens.includes(token as PersonalizationToken));

    if (invalid.length > 0) {
      throw new InvalidPersonalizationTokenError("Email content contains unsupported personalization tokens.", {
        invalid,
      });
    }
  }
}
