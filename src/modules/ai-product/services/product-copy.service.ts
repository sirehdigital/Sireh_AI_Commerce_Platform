import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCopy,
  ProductFaqItem,
} from "../types/product.types.js";
import type { ProductBrandingResult, ProductBrandVoice } from "./product-branding.service.js";

const UNSAFE_CLAIM_TERMS = [
  "guaranteed",
  "cure",
  "cures",
  "treats disease",
  "clinically proven",
  "doctor approved",
  "fda approved",
  "number one",
  "best in the world",
  "risk-free",
  "instant results",
  "permanent results",
  "viral",
  "trending",
  "miracle",
  "100% effective",
] as const;

/**
 * Generates deterministic ecommerce product copy from normalized product, analysis, and branding data.
 */
export class ProductCopyService {
  /**
   * Produces a complete ProductCopy object without external AI, API, database, or runtime side effects.
   */
  public generate(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
  ): ProductCopy {
    const brandedTitle = this.safeBrandedTitle(product, branding);

    return {
      brandedTitle,
      subtitle: this.buildSubtitle(branding),
      shortDescription: this.buildShortDescription(product, analysis, branding),
      fullDescription: this.buildFullDescription(product, analysis, branding),
      benefits: this.buildBenefits(analysis, branding),
      featureHighlights: this.buildFeatureHighlights(product),
      howToUse: this.buildHowToUse(product),
      faq: this.buildFaq(product, analysis),
      callToAction: this.buildCallToAction(product, branding),
      seoTitle: this.buildSeoTitle(product, branding, brandedTitle),
      seoDescription: this.buildSeoDescription(product, branding, brandedTitle),
      seoKeywords: this.buildSeoKeywords(product, analysis, branding),
    };
  }

  private safeBrandedTitle(product: NormalizedProduct, branding: ProductBrandingResult): string {
    const title = this.sanitizeClaim(this.truncateText(this.normalizeText(branding.brandedTitle), 80));
    return title.length > 0 ? title : this.truncateText(this.normalizeText(product.title), 80);
  }

  private buildSubtitle(branding: ProductBrandingResult): string {
    return this.sanitizeClaim(
      this.adaptVoice(
        `A simpler way for ${branding.primaryAudience.toLowerCase()} to enjoy ${branding.corePromise.toLowerCase()}.`,
        branding.brandVoice,
      ),
    );
  }

  private buildShortDescription(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
  ): string {
    const description = `${branding.brandedTitle} is a ${this.safeProductType(product).toLowerCase()} built around ${this.coreBenefit(analysis).toLowerCase()}. It supports ${branding.primaryAudience.toLowerCase()} with ${this.firstDifferentiator(branding).toLowerCase()} while keeping the product offer clear and easy to understand.`;

    return this.sanitizeClaim(this.adaptVoice(description, branding.brandVoice));
  }

  private buildFullDescription(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
  ): string {
    return [
      this.buildAttention(product, branding),
      this.buildInterest(product, analysis, branding),
      this.buildDesire(analysis, branding),
      this.buildAction(product, branding),
    ]
      .map((paragraph) => this.sanitizeClaim(paragraph))
      .filter((paragraph) => paragraph.length > 0)
      .join("\n\n");
  }

  private buildAttention(product: NormalizedProduct, branding: ProductBrandingResult): string {
    return this.adaptVoice(
      `${branding.brandedTitle} helps ${branding.primaryAudience.toLowerCase()} make a clearer choice in the ${this.safeProductType(product).toLowerCase()} category.`,
      branding.brandVoice,
    );
  }

  private buildInterest(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
  ): string {
    return `${this.coreBenefit(analysis)} ${this.firstDifferentiator(branding)} With ${product.variants.length} variant${product.variants.length === 1 ? "" : "s"} and ${product.images.length} product image${product.images.length === 1 ? "" : "s"}, the offer is structured for straightforward ecommerce presentation.`;
  }

  private buildDesire(
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
  ): string {
    const pillar = branding.messagingPillars[0];
    const message = pillar?.message ?? branding.customerTransformation;

    return `${message} ${this.normalizeText(analysis.summary)}`;
  }

  private buildAction(product: NormalizedProduct, branding: ProductBrandingResult): string {
    return `${this.buildCallToAction(product, branding)} Review the available details, choose the option that fits, and use it as intended for the product category.`;
  }

  private buildBenefits(
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
  ): readonly string[] {
    return this.normalizeList([
      ...analysis.keyBenefits,
      ...branding.messagingPillars.map((pillar) => pillar.message),
      branding.corePromise,
      branding.customerTransformation,
    ]).slice(0, 6);
  }

  private buildFeatureHighlights(product: NormalizedProduct): readonly string[] {
    const highlights = [
      `${this.safeProductType(product)} category positioning`,
      product.variants.length > 0 ? `${product.variants.length} product variant${product.variants.length === 1 ? "" : "s"}` : "",
      product.options.length > 0 ? `${product.options.length} clear product option${product.options.length === 1 ? "" : "s"}` : "",
      product.images.length > 0 ? `${product.images.length} image-supported product presentation` : "",
      product.targetMarkets.length > 0 ? `Suitable for selected markets: ${product.targetMarkets.join(", ")}` : "",
      product.pricing !== undefined ? "Pricing data available for merchandising review" : "",
    ];

    return this.normalizeList(highlights).slice(0, 6);
  }

  private buildHowToUse(product: NormalizedProduct): readonly string[] {
    return this.normalizeList([
      product.options.length > 0 ? "Review the selected option before use." : "Review the product details before use.",
      "Follow the included product instructions.",
      `Use only as intended for the ${this.safeProductType(product).toLowerCase()} category.`,
      "Store appropriately after use.",
    ]).slice(0, 5);
  }

  private buildFaq(product: NormalizedProduct, analysis: ProductAIAnalysis): readonly ProductFaqItem[] {
    return [
      {
        question: "Who is this product for?",
        answer: this.sanitizeClaim(`It is intended for ${analysis.audience.primaryAudience.toLowerCase()} looking for ${this.coreBenefit(analysis).toLowerCase()}.`),
      },
      {
        question: "Are there product options available?",
        answer:
          product.options.length > 0
            ? `Yes. Available options include ${product.options.map((option) => option.name).join(", ")}.`
            : "Available options depend on the selected product variant.",
      },
      {
        question: "How should I use this product?",
        answer: `Use it only as intended for the ${this.safeProductType(product).toLowerCase()} category and follow any included product instructions.`,
      },
      {
        question: "Does delivery timing vary?",
        answer: "Delivery expectations can vary by market, shipping origin, and fulfillment setup.",
      },
      {
        question: "Will results be the same for every customer?",
        answer: "Customer experience may vary based on product fit, use case, selected option, and expectations.",
      },
    ];
  }

  private buildCallToAction(product: NormalizedProduct, branding: ProductBrandingResult): string {
    const optionText = product.variants.length > 1 ? "Select your preferred variant" : "Review the product details";
    return this.sanitizeClaim(`${optionText} and make ${branding.brandedTitle} part of your everyday routine.`);
  }

  private buildSeoTitle(
    product: NormalizedProduct,
    branding: ProductBrandingResult,
    brandedTitle: string,
  ): string {
    return this.truncateText(
      this.sanitizeClaim(`${brandedTitle} | ${this.safeProductType(product)} for ${branding.primaryAudience}`),
      60,
    );
  }

  private buildSeoDescription(
    product: NormalizedProduct,
    branding: ProductBrandingResult,
    brandedTitle: string,
  ): string {
    return this.truncateText(
      this.sanitizeClaim(
        `${brandedTitle} offers ${branding.corePromise.toLowerCase()} for ${branding.primaryAudience.toLowerCase()}. Explore the ${this.safeProductType(product).toLowerCase()} details and choose the option that fits.`,
      ),
      160,
    );
  }

  private buildSeoKeywords(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
  ): readonly string[] {
    return this.normalizeList([
      product.title,
      product.category,
      product.productType,
      product.brand,
      branding.primaryAudience,
      this.safeProductType(product),
      ...analysis.keyBenefits.slice(0, 3),
      ...product.tags.slice(0, 4),
    ])
      .map((keyword) => keyword.toLowerCase())
      .filter((keyword) => !this.containsUnsafeClaim(keyword))
      .slice(0, 12);
  }

  private adaptVoice(value: string, voice: ProductBrandVoice): string {
    if (voice === "minimal") {
      return value.replace(/\b(clear and easy to understand|straightforward)\b/giu, "clear");
    }

    if (voice === "premium") {
      return value.replace(/\bsimple\b/giu, "refined").replace(/\beveryday\b/giu, "daily");
    }

    if (voice === "friendly") {
      return value.replace(/\bproduct offer\b/giu, "product choice");
    }

    if (voice === "expert") {
      return value.replace(/\bchoice\b/giu, "selection");
    }

    return value;
  }

  private sanitizeClaim(value: string): string {
    const normalized = this.ensureSentenceEnding(this.normalizeText(value));

    if (!this.containsUnsafeClaim(normalized)) {
      return normalized;
    }

    return this.ensureSentenceEnding(
      normalized
        .replace(/\bguaranteed\b/giu, "intended")
        .replace(/\b(cure|cures|treats disease)\b/giu, "supports general use")
        .replace(/\b(clinically proven|doctor approved|fda approved)\b/giu, "structured")
        .replace(/\b(number one|best in the world)\b/giu, "clear")
        .replace(/\b(risk-free|instant results|permanent results|miracle|100% effective)\b/giu, "practical")
        .replace(/\b(viral|trending)\b/giu, "current"),
    );
  }

  private containsUnsafeClaim(value: string): boolean {
    const normalized = value.toLowerCase();
    return UNSAFE_CLAIM_TERMS.some((term) => normalized.includes(term));
  }

  private normalizeText(value: string | undefined): string {
    return value?.replace(/\r\n?/gu, "\n").replace(/[ \t]+/gu, " ").replace(/\n{3,}/gu, "\n\n").trim() ?? "";
  }

  private normalizeList(values: readonly (string | undefined)[]): readonly string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const value of values) {
      const safeValue = this.sanitizeClaim(value ?? "");
      const key = safeValue.toLowerCase();

      if (safeValue.length > 0 && !seen.has(key)) {
        seen.add(key);
        normalized.push(safeValue);
      }
    }

    return normalized;
  }

  private truncateText(value: string, maxLength: number): string {
    const normalized = this.normalizeText(value);

    if (normalized.length <= maxLength) {
      return normalized;
    }

    const truncated = normalized.slice(0, maxLength).replace(/\s+\S*$/u, "").trim();
    return this.ensureSentenceEnding(truncated);
  }

  private ensureSentenceEnding(value: string): string {
    const normalized = value.replace(/[!]{2,}/gu, "!").replace(/[?]{2,}/gu, "?").replace(/[.]{2,}/gu, ".");

    if (normalized.length === 0 || /[.!?]$/u.test(normalized)) {
      return normalized;
    }

    return `${normalized}.`;
  }

  private safeProductType(product: NormalizedProduct): string {
    return this.normalizeText(product.productType ?? product.category ?? "product");
  }

  private coreBenefit(analysis: ProductAIAnalysis): string {
    return analysis.keyBenefits[0] ?? analysis.audience.customerDesires[0] ?? "clear everyday value";
  }

  private firstDifferentiator(branding: ProductBrandingResult): string {
    return branding.differentiationPoints[0] ?? branding.uniqueSellingProposition;
  }
}
