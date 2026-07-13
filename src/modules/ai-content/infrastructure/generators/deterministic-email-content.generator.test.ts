import { describe, expect, it } from "vitest";
import type { EmailContentGenerationInput } from "../../application/dto/index.js";
import { EmailContentOptionsFactory } from "../../application/factories/index.js";
import { DeterministicEmailContentGenerator } from "./deterministic-email-content.generator.js";

export function buildEmailInput(): EmailContentGenerationInput {
  return {
    productId: "email-product-001",
    productTitle: "Glow Daily Serum",
    brand: "Sireh Beauty",
    category: "Beauty",
    productType: "Face serum",
    productDescription: "A lightweight daily serum for simple skincare routines.",
    benefits: ["supports a smoother daily routine", "fits clean morning and evening use"],
    features: ["lightweight texture", "daily-use format"],
    highlights: ["Simple routine support", "Lightweight product format"],
    productRisks: ["Avoid unsupported medical claims."],
    usageGuidance: ["Apply as part of a normal skincare routine."],
    targetAudience: {
      primaryAudience: "beauty enthusiasts",
      customerProblems: ["finding a simple skincare step"],
      purchaseMotivations: ["easy daily use"],
      objections: ["needs clear product details"],
    },
    valueProposition: "A clear skincare step for everyday routines.",
    campaignId: "email-campaign-001",
    correlationId: "email-correlation-001",
  };
}

describe("DeterministicEmailContentGenerator", () => {
  const generator = new DeterministicEmailContentGenerator();
  const optionsFactory = new EmailContentOptionsFactory();

  it("generates deterministic email content", () => {
    const options = optionsFactory.create({ campaignType: "promotional" });
    const first = generator.generate(buildEmailInput(), options);
    const second = generator.generate(buildEmailInput(), options);

    expect(first.recommendedSubjectLine).toBe(second.recommendedSubjectLine);
    expect(first.mainBody).toBe(second.mainBody);
  });

  it.each(["promotional", "product-launch", "welcome", "abandoned-cart", "browse-abandonment", "post-purchase", "win-back", "educational-nurture", "re-engagement", "feedback-request", "review-request-framework"] as const)(
    "generates %s campaign output",
    (campaignType) => {
      const input = {
        ...buildEmailInput(),
        cartContext: { cartUrl: "{{cart_url}}", productInCart: true },
        orderContext: { orderNumber: "{{order_number}}", supportUrl: "{{support_url}}" },
      };
      const result = generator.generate(input, optionsFactory.create({ campaignType }));

      expect(result.campaignType).toBe(campaignType);
      expect(result.subjectLines.length).toBeGreaterThan(0);
      expect(result.contents.length).toBeGreaterThan(2);
    },
  );

  it("generates Malay copy", () => {
    const result = generator.generate(buildEmailInput(), optionsFactory.create({ language: "ms" }));

    expect(result.openingParagraph).toContain("direka");
    expect(result.unsubscribePlaceholderGuidance).toContain("{{unsubscribe_url}}");
  });

  it("supports verified offer and stock frameworks", () => {
    const offer = generator.generate(
      { ...buildEmailInput(), offerContext: { verified: true, discountDescription: "Verified bundle offer", expiryContext: "Ends when supplied campaign context says so" } },
      optionsFactory.create({ campaignType: "limited-offer-framework" }),
    );
    const stock = generator.generate(
      { ...buildEmailInput(), stockContext: { verifiedBackInStock: true, stockContext: "Verified restock notice" } },
      optionsFactory.create({ campaignType: "back-in-stock-framework" }),
    );

    expect(offer.campaignType).toBe("limited-offer-framework");
    expect(stock.campaignType).toBe("back-in-stock-framework");
  });

  it("creates deterministic sequences when enabled", () => {
    const result = generator.generate(
      buildEmailInput(),
      optionsFactory.create({ includeSequence: true, sequenceLength: 5 }),
    );

    expect(result.sequence).toHaveLength(5);
    expect(result.sequence.map((item) => item.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it("does not mutate source input", () => {
    const input = buildEmailInput();
    const before = JSON.stringify(input);

    generator.generate(input, optionsFactory.create());

    expect(JSON.stringify(input)).toBe(before);
  });
});
