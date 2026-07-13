import type { EmailContentGenerationInput, EmailContentGenerationOptions } from "../dto/email-content.types.js";
import { InvalidEmailOfferContextError, MissingEmailCampaignContextError } from "../errors/product-content.errors.js";

export class EmailOfferContextFactory {
  public validate(input: EmailContentGenerationInput, options: EmailContentGenerationOptions): void {
    if (options.campaignType === "abandoned-cart" && input.cartContext?.cartUrl === undefined) {
      throw new MissingEmailCampaignContextError("Abandoned-cart email requires cart context with cart_url placeholder.");
    }

    if (options.campaignType === "post-purchase" && input.orderContext?.orderNumber === undefined) {
      throw new MissingEmailCampaignContextError("Post-purchase email requires verified order context.");
    }

    if (options.campaignType === "back-in-stock-framework" && input.stockContext?.verifiedBackInStock !== true) {
      throw new MissingEmailCampaignContextError("Back-in-stock email requires verified stock context.");
    }

    if (options.campaignType === "limited-offer-framework") {
      if (input.offerContext?.verified !== true) {
        throw new InvalidEmailOfferContextError("Limited-offer email requires verified offer context.");
      }
      if (input.offerContext.discountDescription === undefined || input.offerContext.expiryContext === undefined) {
        throw new InvalidEmailOfferContextError("Limited-offer email requires discount and expiry context.");
      }
    }
  }
}
