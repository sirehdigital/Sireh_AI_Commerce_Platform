import type { PersonalizationToken } from "../dto/email-content.types.js";
import { InvalidPersonalizationTokenError } from "../errors/product-content.errors.js";

const ALLOWED_TOKENS: readonly PersonalizationToken[] = [
  "{{first_name}}",
  "{{brand_name}}",
  "{{product_name}}",
  "{{cart_url}}",
  "{{product_url}}",
  "{{order_number}}",
  "{{support_url}}",
  "{{unsubscribe_url}}",
];

export class PersonalizationTokenFactory {
  public create(tokens: readonly string[] | undefined): readonly PersonalizationToken[] {
    const requested = tokens ?? ["{{first_name}}", "{{product_name}}", "{{product_url}}", "{{unsubscribe_url}}"];
    const invalid = requested.filter((token) => !ALLOWED_TOKENS.includes(token as PersonalizationToken));

    if (invalid.length > 0) {
      throw new InvalidPersonalizationTokenError("Email personalization tokens must use the allowlist.", { invalid });
    }

    return [...new Set(requested)] as readonly PersonalizationToken[];
  }
}
