import type { EmailContentGenerationInput, EmailContentGenerationOptions, EmailContentPackage } from "../dto/email-content.types.js";
import { EmailComplianceError } from "../errors/product-content.errors.js";

export class EmailComplianceValidationService {
  public validate(
    input: EmailContentGenerationInput,
    options: EmailContentGenerationOptions,
    contentPackage: EmailContentPackage,
  ): void {
    const errors = [
      ...(contentPackage.unsubscribePlaceholderGuidance.includes("{{unsubscribe_url}}") ? [] : ["missing_unsubscribe_placeholder"]),
      ...(contentPackage.footerGuidance.length === 0 ? ["missing_footer_guidance"] : []),
      ...(options.campaignType === "review-request-framework" && /positive review|5-star/iu.test(contentPackage.mainBody)
        ? ["review_manipulation"]
        : []),
      ...(options.campaignType === "back-in-stock-framework" && input.stockContext?.verifiedBackInStock !== true
        ? ["missing_verified_stock_context"]
        : []),
    ];

    if (errors.length > 0) {
      throw new EmailComplianceError("Email content does not meet compliance requirements.", { errors });
    }
  }
}
