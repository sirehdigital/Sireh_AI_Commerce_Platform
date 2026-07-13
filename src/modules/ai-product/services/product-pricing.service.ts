import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCurrency,
  ProductVariant,
} from "../types/product.types.js";
import type { ProductBrandingResult, ProductPositioningTier } from "./product-branding.service.js";

export type PricingStrategy =
  | "cost-plus"
  | "market-entry"
  | "balanced"
  | "premium"
  | "luxury"
  | "specialist";

export type PricingConfidenceLevel = "low" | "medium" | "high";

/** Variant-level internal pricing recommendation for future publishing workflows. */
export interface VariantPricingRecommendation {
  readonly variantId: string;
  readonly sku?: string;
  readonly cost: number;
  readonly currentPrice: number;
  readonly recommendedPrice: number;
  readonly compareAtPrice: number;
  readonly grossProfit: number;
  readonly grossMarginPercentage: number;
  readonly markupPercentage: number;
  readonly available: boolean;
}

/** Product-level pricing recommendation generated from structured SACP product data. */
export interface ProductPricingRecommendation {
  readonly currency: ProductCurrency;
  readonly strategy: PricingStrategy;
  readonly currentCost: number;
  readonly totalLandedCost: number;
  readonly currentSellingPrice: number;
  readonly recommendedSellingPrice: number;
  readonly recommendedCompareAtPrice: number;
  readonly grossProfit: number;
  readonly grossMarginPercentage: number;
  readonly markupPercentage: number;
  readonly minimumViablePrice: number;
  readonly targetProfitPerUnit: number;
  readonly priceIncreasePercentage: number;
  readonly confidenceScore: number;
  readonly confidenceLevel: PricingConfidenceLevel;
  readonly variantRecommendations: readonly VariantPricingRecommendation[];
  readonly reasons: readonly string[];
  readonly warnings: readonly string[];
}

const MINIMUM_MARGIN_FLOORS: Readonly<Record<PricingStrategy, number>> = {
  "cost-plus": 0.25,
  "market-entry": 0.3,
  balanced: 0.4,
  premium: 0.5,
  luxury: 0.6,
  specialist: 0.5,
};

const TARGET_MARGINS: Readonly<Record<PricingStrategy, number>> = {
  "cost-plus": 0.35,
  "market-entry": 0.4,
  balanced: 0.5,
  premium: 0.6,
  luxury: 0.7,
  specialist: 0.6,
};

/**
 * Generates deterministic ecommerce pricing and margin recommendations from structured product data.
 */
export class ProductPricingService {
  /**
   * Recommends sustainable product and variant prices without external market, tax, or gateway data.
   */
  public recommend(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
  ): ProductPricingRecommendation {
    const currency = this.resolveCurrency(product);
    const strategy = this.resolveStrategy(product, analysis, branding);
    const totalLandedCost = this.resolveTotalLandedCost(product);
    const currentCost = this.resolveCurrentCost(product);
    const currentSellingPrice = this.resolveCurrentSellingPrice(product);
    const targetMargin = this.resolveTargetMargin(strategy, product, analysis, branding);
    const minimumViablePrice = this.calculateMinimumViablePrice(
      totalLandedCost,
      MINIMUM_MARGIN_FLOORS[strategy],
      currency,
      strategy,
      branding.positioningTier,
    );
    const variantRecommendations = this.buildVariantRecommendations(
      product,
      strategy,
      targetMargin,
      currency,
      branding.positioningTier,
    );
    const recommendedSellingPrice = this.selectProductPrice(
      variantRecommendations,
      totalLandedCost,
      currentSellingPrice,
      minimumViablePrice,
      strategy,
      currency,
      branding.positioningTier,
    );
    const recommendedCompareAtPrice = this.buildCompareAtPrice(
      product,
      strategy,
      recommendedSellingPrice,
      branding.positioningTier,
    );
    const grossProfit = this.calculateGrossProfit(recommendedSellingPrice, totalLandedCost);
    const grossMarginPercentage = this.calculateGrossMargin(grossProfit, recommendedSellingPrice);
    const markupPercentage = this.calculateMarkup(grossProfit, totalLandedCost);
    const priceIncreasePercentage = this.calculatePriceIncreasePercentage(
      recommendedSellingPrice,
      currentSellingPrice,
    );
    const confidenceScore = this.calculateConfidenceScore(
      product,
      analysis,
      branding,
      totalLandedCost,
      currentSellingPrice,
      variantRecommendations,
    );

    return {
      currency,
      strategy,
      currentCost,
      totalLandedCost,
      currentSellingPrice,
      recommendedSellingPrice,
      recommendedCompareAtPrice,
      grossProfit,
      grossMarginPercentage,
      markupPercentage,
      minimumViablePrice,
      targetProfitPerUnit: grossProfit,
      priceIncreasePercentage,
      confidenceScore,
      confidenceLevel: this.resolveConfidenceLevel(confidenceScore),
      variantRecommendations,
      reasons: this.buildReasons(
        strategy,
        targetMargin,
        totalLandedCost,
        analysis,
        branding,
        variantRecommendations,
      ),
      warnings: this.buildWarnings(
        product,
        analysis,
        totalLandedCost,
        currentSellingPrice,
        recommendedSellingPrice,
        recommendedCompareAtPrice,
        priceIncreasePercentage,
      ),
    };
  }

  private resolveStrategy(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
  ): PricingStrategy {
    if (
      branding.positioningTier === "luxury" &&
      analysis.score.overall >= 85 &&
      branding.confidenceScore >= 80 &&
      analysis.risks.level === "low" &&
      product.images.length >= 3 &&
      branding.differentiationPoints.length >= 3
    ) {
      return "luxury";
    }

    if (
      branding.positioningTier === "specialist" &&
      branding.confidenceScore >= 50 &&
      analysis.score.overall >= 60
    ) {
      return "specialist";
    }

    if (
      branding.positioningTier === "premium" &&
      analysis.score.overall >= 70 &&
      branding.confidenceScore >= 70 &&
      analysis.risks.level !== "high" &&
      analysis.risks.level !== "critical"
    ) {
      return "premium";
    }

    if (
      analysis.score.overall >= 70 &&
      (analysis.risks.level === "low" || analysis.risks.level === "medium")
    ) {
      return "balanced";
    }

    if (
      analysis.score.overall >= 50 &&
      (analysis.risks.level === "low" || analysis.risks.level === "medium") &&
      (branding.positioningTier === "value" || branding.positioningTier === "mass-market")
    ) {
      return "market-entry";
    }

    return "cost-plus";
  }

  private resolveTargetMargin(
    strategy: PricingStrategy,
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
  ): number {
    let margin = TARGET_MARGINS[strategy];

    if (analysis.score.profitability >= 75 && analysis.score.overall >= 75) {
      margin += 0.03;
    }

    if (branding.confidenceScore < 50) {
      margin -= 0.05;
    }

    if (analysis.risks.score >= 50) {
      margin -= 0.05;
    }

    if (product.cost !== undefined && product.cost.shippingCost > product.cost.productCost * 0.35) {
      margin += 0.03;
    }

    return this.clampDecimal(margin, 0.2, 0.75);
  }

  private resolveTotalLandedCost(product: NormalizedProduct): number {
    const total = this.safeNonNegativeNumber(product.cost?.totalLandedCost);

    if (total !== undefined) {
      return this.roundMoney(total);
    }

    const productCost = this.safeNonNegativeNumber(product.cost?.productCost) ?? 0;
    const shippingCost = this.safeNonNegativeNumber(product.cost?.shippingCost) ?? 0;
    const transactionCost = this.safeNonNegativeNumber(product.cost?.transactionCost) ?? 0;
    const advertisingCostEstimate =
      this.safeNonNegativeNumber(product.cost?.advertisingCostEstimate) ?? 0;

    return this.roundMoney(productCost + shippingCost + transactionCost + advertisingCostEstimate);
  }

  private resolveCurrentCost(product: NormalizedProduct): number {
    return this.roundMoney(
      this.safeNonNegativeNumber(product.cost?.productCost) ??
        this.lowestValidNumber(product.variants.map((variant) => variant.cost)) ??
        0,
    );
  }

  private resolveCurrentSellingPrice(product: NormalizedProduct): number {
    return this.roundMoney(
      this.safeNonNegativeNumber(product.pricing?.sellingPrice) ??
        this.lowestValidNumber(product.variants.map((variant) => variant.suggestedPrice)) ??
        0,
    );
  }

  private buildVariantRecommendations(
    product: NormalizedProduct,
    strategy: PricingStrategy,
    targetMargin: number,
    currency: ProductCurrency,
    tier: ProductPositioningTier,
  ): readonly VariantPricingRecommendation[] {
    return product.variants.map((variant) => {
      const cost = this.roundMoney(
        this.safeNonNegativeNumber(variant.cost) ??
          this.safeNonNegativeNumber(product.cost?.productCost) ??
          0,
      );
      const currentPrice = this.roundMoney(this.safeNonNegativeNumber(variant.suggestedPrice) ?? 0);
      const minimumPrice = this.calculateMinimumViablePrice(
        cost,
        MINIMUM_MARGIN_FLOORS[strategy],
        currency,
        strategy,
        tier,
      );
      const basePrice = this.calculateBaseRecommendedPrice(cost, currentPrice, targetMargin, minimumPrice);
      const recommendedPrice = this.applyPsychologicalPricing(basePrice, currency, strategy, tier, minimumPrice);
      const compareAtPrice = this.buildVariantCompareAtPrice(variant, strategy, recommendedPrice);
      const grossProfit = this.calculateGrossProfit(recommendedPrice, cost);

      return {
        variantId: variant.id,
        ...(variant.sku === undefined ? {} : { sku: variant.sku }),
        cost,
        currentPrice,
        recommendedPrice,
        compareAtPrice,
        grossProfit,
        grossMarginPercentage: this.calculateGrossMargin(grossProfit, recommendedPrice),
        markupPercentage: this.calculateMarkup(grossProfit, cost),
        available: variant.available,
      };
    });
  }

  private selectProductPrice(
    variants: readonly VariantPricingRecommendation[],
    totalLandedCost: number,
    currentSellingPrice: number,
    minimumViablePrice: number,
    strategy: PricingStrategy,
    currency: ProductCurrency,
    tier: ProductPositioningTier,
  ): number {
    const availablePrices = variants
      .filter((variant) => variant.available)
      .map((variant) => variant.recommendedPrice);
    const allPrices = variants.map((variant) => variant.recommendedPrice);
    const selected = this.lowestValidNumber(availablePrices) ?? this.lowestValidNumber(allPrices);

    if (selected !== undefined) {
      return selected;
    }

    const basePrice = this.calculateBaseRecommendedPrice(
      totalLandedCost,
      currentSellingPrice,
      TARGET_MARGINS[strategy],
      minimumViablePrice,
    );

    return this.applyPsychologicalPricing(basePrice, currency, strategy, tier, minimumViablePrice);
  }

  private calculateMinimumViablePrice(
    cost: number,
    marginFloor: number,
    currency: ProductCurrency,
    strategy: PricingStrategy,
    tier: ProductPositioningTier,
  ): number {
    if (cost <= 0 || marginFloor >= 1) {
      return 0;
    }

    const price = cost / (1 - marginFloor);
    const minimumPrice = Math.max(price, cost + 0.01);

    return this.applyPsychologicalPricing(minimumPrice, currency, strategy, tier, minimumPrice);
  }

  private calculateBaseRecommendedPrice(
    cost: number,
    currentPrice: number,
    targetMargin: number,
    minimumViablePrice: number,
  ): number {
    if (cost <= 0) {
      return this.roundMoney(currentPrice);
    }

    const marginPrice = cost / (1 - targetMargin);
    const currentMargin = this.calculateGrossMargin(currentPrice - cost, currentPrice);

    if (currentPrice >= minimumViablePrice && currentMargin >= targetMargin * 80) {
      return this.roundMoney(currentPrice);
    }

    const cappedIncrease = currentPrice > 0 ? currentPrice * 1.5 : marginPrice;
    return this.roundMoney(Math.max(minimumViablePrice, Math.min(marginPrice, cappedIncrease)));
  }

  private buildCompareAtPrice(
    product: NormalizedProduct,
    strategy: PricingStrategy,
    recommendedSellingPrice: number,
    tier: ProductPositioningTier,
  ): number {
    const existingCompareAt = this.safeNonNegativeNumber(product.pricing?.compareAtPrice);

    if (existingCompareAt !== undefined && existingCompareAt > recommendedSellingPrice) {
      return this.roundMoney(existingCompareAt);
    }

    if (recommendedSellingPrice <= 0) {
      return 0;
    }

    const uplift = this.compareAtUplift(strategy);
    const candidate = this.applyPsychologicalPricing(
      recommendedSellingPrice * (1 + uplift),
      product.pricing?.currency ?? product.cost?.currency ?? "USD",
      strategy,
      tier,
      recommendedSellingPrice + 0.01,
    );

    return candidate > recommendedSellingPrice ? candidate : 0;
  }

  private buildVariantCompareAtPrice(
    variant: ProductVariant,
    strategy: PricingStrategy,
    recommendedPrice: number,
  ): number {
    const existingCompareAt = this.safeNonNegativeNumber(variant.compareAtPrice);

    if (existingCompareAt !== undefined && existingCompareAt > recommendedPrice) {
      return this.roundMoney(existingCompareAt);
    }

    if (recommendedPrice <= 0 || strategy === "cost-plus") {
      return 0;
    }

    return this.roundMoney(recommendedPrice * (1 + this.compareAtUplift(strategy)));
  }

  private applyPsychologicalPricing(
    value: number,
    currency: ProductCurrency,
    strategy: PricingStrategy,
    tier: ProductPositioningTier,
    minimumPrice: number,
  ): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    const rounded = this.roundMoney(value);
    let candidate: number;

    if (tier === "luxury" || strategy === "luxury") {
      candidate = Math.ceil(rounded);
    } else if (currency === "MYR") {
      candidate = Math.floor(rounded) + 0.9;
    } else if (strategy === "market-entry" || tier === "value") {
      candidate = Math.floor(rounded) + 0.99;
    } else if (strategy === "premium" || strategy === "specialist") {
      candidate = Math.floor(rounded) + 0.95;
    } else {
      candidate = Math.round(rounded);
    }

    while (candidate < minimumPrice) {
      candidate += tier === "luxury" || strategy === "luxury" ? 1 : 0.01;
    }

    return this.roundMoney(candidate);
  }

  private calculateConfidenceScore(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
    totalLandedCost: number,
    currentSellingPrice: number,
    variants: readonly VariantPricingRecommendation[],
  ): number {
    const costVisibility = totalLandedCost > 0 ? 80 : 25;
    const priceVisibility = currentSellingPrice > 0 ? 70 : 25;
    const variantCompleteness = this.variantCostCompleteness(product.variants) * 100;
    const supplierSignal = product.supplier === undefined ? 35 : 65;
    const availabilitySignal = variants.some((variant) => variant.available) ? 75 : 25;
    const shippingSignal = product.cost !== undefined && product.cost.shippingCost >= 0 ? 65 : 35;
    const consistencySignal = this.pricingConsistencyScore(product);

    return this.clampScore(
      costVisibility * 0.18 +
        priceVisibility * 0.12 +
        variantCompleteness * 0.12 +
        supplierSignal * 0.1 +
        analysis.score.overall * 0.18 +
        (100 - analysis.risks.score) * 0.12 +
        branding.confidenceScore * 0.1 +
        availabilitySignal * 0.04 +
        shippingSignal * 0.02 +
        consistencySignal * 0.02,
    );
  }

  private buildReasons(
    strategy: PricingStrategy,
    targetMargin: number,
    totalLandedCost: number,
    analysis: ProductAIAnalysis,
    branding: ProductBrandingResult,
    variants: readonly VariantPricingRecommendation[],
  ): readonly string[] {
    return this.uniqueValues([
      `The ${strategy} strategy protects a ${this.roundPercentage(targetMargin * 100)}% target gross margin.`,
      totalLandedCost > 0
        ? "Total landed cost was used as the pricing floor."
        : "Cost data is limited, so pricing confidence is reduced.",
      `${branding.positioningTier} positioning influenced the margin range.`,
      `Product readiness score is ${analysis.score.overall}.`,
      `Risk level is ${analysis.risks.level}, which constrains pricing confidence.`,
      variants.length > 0 ? "Variant-level costs were used to maintain margin consistency." : "",
    ]).slice(0, 7);
  }

  private buildWarnings(
    product: NormalizedProduct,
    analysis: ProductAIAnalysis,
    totalLandedCost: number,
    currentSellingPrice: number,
    recommendedSellingPrice: number,
    recommendedCompareAtPrice: number,
    priceIncreasePercentage: number,
  ): readonly string[] {
    return this.uniqueValues([
      totalLandedCost <= 0 ? "Total landed cost is unavailable." : "",
      currentSellingPrice > 0 && currentSellingPrice < totalLandedCost
        ? "Existing selling price is below total landed cost."
        : "",
      product.pricing?.compareAtPrice !== undefined &&
      product.pricing.compareAtPrice < product.pricing.sellingPrice
        ? "Compare-at price is below selling price."
        : "",
      this.variantCostCompleteness(product.variants) < 1 ? "One or more variant costs are missing." : "",
      product.cost === undefined ? "Shipping cost is missing." : "",
      product.variants.length > 0 && product.variants.every((variant) => !variant.available)
        ? "Product has no available variants."
        : "",
      analysis.risks.level === "high" || analysis.risks.level === "critical"
        ? "Risk level reduces pricing confidence."
        : "",
      priceIncreasePercentage >= 40 ? "Recommended price increase is substantial." : "",
      recommendedCompareAtPrice > 0 && recommendedCompareAtPrice <= recommendedSellingPrice
        ? "Compare-at price could not be supported above selling price."
        : "",
    ]);
  }

  private resolveCurrency(product: NormalizedProduct): ProductCurrency {
    return product.pricing?.currency ?? product.cost?.currency ?? product.variants[0]?.currency ?? "USD";
  }

  private resolveConfidenceLevel(score: number): PricingConfidenceLevel {
    if (score >= 70) {
      return "high";
    }

    if (score >= 40) {
      return "medium";
    }

    return "low";
  }

  private compareAtUplift(strategy: PricingStrategy): number {
    if (strategy === "market-entry") {
      return 0.12;
    }

    if (strategy === "balanced") {
      return 0.2;
    }

    if (strategy === "premium") {
      return 0.25;
    }

    if (strategy === "luxury") {
      return 0.3;
    }

    if (strategy === "specialist") {
      return 0.2;
    }

    return 0;
  }

  private calculateGrossProfit(price: number, cost: number): number {
    return this.roundMoney(Math.max(0, price - cost));
  }

  private calculateGrossMargin(grossProfit: number, price: number): number {
    if (price <= 0) {
      return 0;
    }

    return this.clampPercentage((grossProfit / price) * 100);
  }

  private calculateMarkup(grossProfit: number, cost: number): number {
    if (cost <= 0) {
      return 0;
    }

    return this.roundPercentage(Math.min(500, (grossProfit / cost) * 100));
  }

  private calculatePriceIncreasePercentage(recommendedPrice: number, currentPrice: number): number {
    if (currentPrice <= 0) {
      return 0;
    }

    return this.roundPercentage(((recommendedPrice - currentPrice) / currentPrice) * 100);
  }

  private variantCostCompleteness(variants: readonly ProductVariant[]): number {
    if (variants.length === 0) {
      return 0;
    }

    const complete = variants.filter((variant) => this.safeNonNegativeNumber(variant.cost) !== undefined).length;
    return complete / variants.length;
  }

  private pricingConsistencyScore(product: NormalizedProduct): number {
    const pricing = product.pricing;

    if (pricing === undefined || pricing.sellingPrice <= 0) {
      return 30;
    }

    if (product.cost !== undefined && pricing.sellingPrice <= product.cost.totalLandedCost) {
      return 20;
    }

    if (pricing.grossMarginPercentage >= 25 && pricing.grossMarginPercentage <= 80) {
      return 75;
    }

    return 45;
  }

  private lowestValidNumber(values: readonly (number | undefined)[]): number | undefined {
    const validValues = values.filter((value): value is number => {
      return this.safeNonNegativeNumber(value) !== undefined;
    });

    return validValues.length > 0 ? Math.min(...validValues) : undefined;
  }

  private safeNonNegativeNumber(value: number | undefined): number | undefined {
    if (value === undefined || !Number.isFinite(value) || value < 0) {
      return undefined;
    }

    return value;
  }

  private clampDecimal(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return this.roundPercentage(Math.min(100, Math.max(0, value)));
  }

  private clampPercentage(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return this.roundPercentage(Math.min(100, Math.max(0, value)));
  }

  private roundMoney(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const rounded = Math.round(Math.max(0, value) * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  private roundPercentage(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const rounded = Math.round(value * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  private uniqueValues(values: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const value of values) {
      const normalized = value.trim();
      const key = normalized.toLowerCase();

      if (normalized.length > 0 && !seen.has(key)) {
        seen.add(key);
        unique.push(normalized);
      }
    }

    return unique;
  }
}
