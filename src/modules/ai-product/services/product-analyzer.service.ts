import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductAudienceProfile,
  ProductMarketingAngle,
  ProductRecommendation,
  ProductRiskAssessment,
  ProductScoreBreakdown,
  TargetMarket,
} from "../types/product.types.js";

const MODEL_NAME = "SACP Rule Engine v1";

/**
 * Builds deterministic product intelligence analysis from normalized product data and rule scores.
 */
export class ProductAnalyzerService {
  public analyze(
    product: NormalizedProduct,
    score: ProductScoreBreakdown,
    risk: ProductRiskAssessment,
  ): ProductAIAnalysis {
    return {
      summary: this.buildSummary(product, score, risk),
      keyBenefits: this.buildBenefits(product, score, risk),
      keyFeatures: this.buildFeatures(product),
      audience: this.buildAudience(product),
      marketingAngles: this.buildMarketingAngles(product, score, risk),
      score,
      risks: risk,
      ...(product.pricing === undefined ? {} : { recommendedSellingPrice: product.pricing.sellingPrice }),
      ...(product.pricing?.compareAtPrice === undefined
        ? {}
        : { recommendedCompareAtPrice: product.pricing.compareAtPrice }),
      recommendation: this.buildRecommendation(score, risk),
      reasoning: this.buildReasoning(product, score, risk),
      analyzedAt: new Date(),
      model: MODEL_NAME,
    };
  }

  private buildSummary(
    product: NormalizedProduct,
    score: ProductScoreBreakdown,
    risk: ProductRiskAssessment,
  ): string {
    const productReadiness = score.overall >= 70 ? "strong" : score.overall >= 50 ? "moderate" : "early";
    const pricingReadiness =
      product.pricing !== undefined && product.pricing.sellingPrice > 0 ? "pricing is present" : "pricing is limited";
    const supplierReadiness =
      score.supplierReliability >= 70
        ? "supplier signals are supportive"
        : "supplier signals need further review";
    const marketingReadiness =
      score.marketingPotential >= 70
        ? "marketing assets appear ready for testing"
        : "marketing assets need strengthening";

    return `${product.title} has ${productReadiness} product readiness based on available structured data; ${pricingReadiness}, ${supplierReadiness}, ${marketingReadiness}, and current risk is ${risk.level}.`;
  }

  private buildBenefits(
    product: NormalizedProduct,
    score: ProductScoreBreakdown,
    risk: ProductRiskAssessment,
  ): readonly string[] {
    const benefits: string[] = [];

    if (product.variants.length > 1) {
      benefits.push("Multiple product variants available.");
    }

    if (product.images.length >= 3) {
      benefits.push("Multiple product images support merchandising and ad creative.");
    }

    if (product.targetMarkets.length >= 4) {
      benefits.push("Broad target-market coverage is available.");
    }

    if (product.pricing !== undefined && product.pricing.grossMarginPercentage >= 40) {
      benefits.push("Strong gross margin is present in current pricing data.");
    }

    if (score.supplierReliability >= 70) {
      benefits.push("Supplier confidence signals are favorable.");
    }

    if (risk.level === "low") {
      benefits.push("No major risk concerns were detected by the rule engine.");
    }

    return benefits.length > 0 ? benefits : ["Product has enough structured data for initial review."];
  }

  private buildFeatures(product: NormalizedProduct): readonly string[] {
    return [
      `Brand: ${product.brand ?? "Unbranded"}`,
      `Category: ${product.category ?? "Uncategorized"}`,
      `Product type: ${product.productType ?? product.category ?? "Uncategorized"}`,
      `Variants: ${product.variants.length}`,
      `Images: ${product.images.length}`,
      `Target markets: ${product.targetMarkets.join(", ")}`,
    ];
  }

  private buildAudience(product: NormalizedProduct): ProductAudienceProfile {
    const audience = this.inferAudience(product);

    return {
      primaryAudience: audience,
      ageRanges: ["Broad adult consumer audience"],
      customerProblems: this.buildCustomerProblems(product),
      customerDesires: this.buildCustomerDesires(product),
      purchaseMotivations: ["Convenience", "Practical value", "Product fit"],
      objections: ["Price sensitivity", "Delivery time", "Supplier confidence"],
      recommendedMarkets: this.recommendedMarkets(product.targetMarkets),
    };
  }

  private buildMarketingAngles(
    product: NormalizedProduct,
    score: ProductScoreBreakdown,
    risk: ProductRiskAssessment,
  ): readonly ProductMarketingAngle[] {
    const audience = this.inferAudience(product);
    const confidenceScore = this.confidence(product, score, risk);
    const category = product.category ?? "lifestyle";

    return [
      {
        title: "Practical Value Angle",
        hook: `A simple way to explore ${product.title} for everyday needs.`,
        coreBenefit: "Clear product utility based on available product information.",
        emotionalOutcome: "Confidence in choosing a product that fits the intended use.",
        targetAudience: audience,
        channels: ["shopify", "google", "email"],
        confidenceScore,
      },
      {
        title: "Visual Discovery Angle",
        hook: `${category} product positioning supported by available visuals and variants.`,
        coreBenefit: "Merchandising-ready product presentation.",
        emotionalOutcome: "Interest and curiosity from visual product discovery.",
        targetAudience: audience,
        channels: ["facebook", "instagram", "tiktok", "pinterest", "youtube"],
        confidenceScore: this.clampScore(confidenceScore - (product.images.length === 0 ? 20 : 0)),
      },
    ];
  }

  private buildRecommendation(
    score: ProductScoreBreakdown,
    risk: ProductRiskAssessment,
  ): ProductRecommendation {
    if (risk.level === "critical" || score.overall < 50) {
      return "reject";
    }

    if (score.overall >= 85 && risk.level === "low" && score.profitability >= 75) {
      return "strong-buy";
    }

    if (score.overall >= 70 && (risk.level === "low" || risk.level === "medium")) {
      return "test";
    }

    return "watch";
  }

  private buildReasoning(
    product: NormalizedProduct,
    score: ProductScoreBreakdown,
    risk: ProductRiskAssessment,
  ): string {
    const pricingReason =
      product.pricing === undefined
        ? "Pricing data is not yet ready."
        : `Selling price is ${product.pricing.sellingPrice} with gross margin ${product.pricing.grossMarginPercentage}%.`;
    const supplierReason =
      score.supplierReliability >= 70
        ? "Supplier reliability score is supportive."
        : "Supplier reliability requires review.";

    return `Overall score is ${score.overall}, risk score is ${risk.score} (${risk.level}). ${pricingReason} ${supplierReason} Marketing potential is ${score.marketingPotential}. Recommendation is ${this.buildRecommendation(score, risk)}.`;
  }

  private inferAudience(product: NormalizedProduct): string {
    const searchable = [product.title, product.description, product.category, product.productType, ...product.tags]
      .join(" ")
      .toLowerCase();

    if (this.includesAny(searchable, ["beauty", "skincare", "makeup", "cosmetic"])) {
      return "Beauty enthusiasts";
    }

    if (this.includesAny(searchable, ["baby", "kids", "parent", "child"])) {
      return "Parents";
    }

    if (this.includesAny(searchable, ["home", "kitchen", "decor", "garden"])) {
      return "Home owners";
    }

    if (this.includesAny(searchable, ["fitness", "gym", "workout", "sport"])) {
      return "Fitness consumers";
    }

    if (this.includesAny(searchable, ["pet", "dog", "cat"])) {
      return "Pet owners";
    }

    return "General online shoppers";
  }

  private buildCustomerProblems(product: NormalizedProduct): readonly string[] {
    const problems = ["Finding a product that matches the intended use."];

    if (product.variants.length > 1) {
      problems.push("Choosing the right variant or option.");
    }

    return problems;
  }

  private buildCustomerDesires(product: NormalizedProduct): readonly string[] {
    const desires = ["A clear, trustworthy product presentation."];

    if (product.images.length > 0) {
      desires.push("Enough visual detail to make a confident buying decision.");
    }

    return desires;
  }

  private recommendedMarkets(markets: readonly TargetMarket[]): readonly TargetMarket[] {
    return markets.length > 0 ? markets : ["US", "UK", "AU", "CA"];
  }

  private confidence(
    product: NormalizedProduct,
    score: ProductScoreBreakdown,
    risk: ProductRiskAssessment,
  ): number {
    const completeness = this.completeness(product);
    return this.clampScore(completeness * 0.35 + score.overall * 0.45 + (100 - risk.score) * 0.2);
  }

  private completeness(product: NormalizedProduct): number {
    const checks = [
      product.title.trim().length > 0,
      product.description.trim().length > 0,
      product.images.length > 0,
      product.variants.length > 0,
      product.pricing !== undefined,
      product.supplier !== undefined,
      product.targetMarkets.length > 0,
      product.category !== undefined && product.category.trim().length > 0,
    ];

    return this.clampScore((checks.filter(Boolean).length / checks.length) * 100);
  }

  private includesAny(value: string, keywords: readonly string[]): boolean {
    return keywords.some((keyword) => value.includes(keyword));
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(Math.min(100, Math.max(0, value)) * 100) / 100;
  }
}
