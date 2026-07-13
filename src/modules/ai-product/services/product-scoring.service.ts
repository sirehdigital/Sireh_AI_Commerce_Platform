import type {
  NormalizedProduct,
  ProductScoreBreakdown,
  ProductVariant,
  SupplierInformation,
} from "../types/product.types.js";

const SCORE_MIN = 0;
const SCORE_MAX = 100;

const OVERALL_WEIGHTS = {
  demand: 0.15,
  competition: 0.1,
  profitability: 0.2,
  trend: 0.1,
  supplierReliability: 0.15,
  shipping: 0.1,
  marketingPotential: 0.1,
  brandability: 0.1,
} as const;

/**
 * Provides deterministic, rule-based product readiness and commercial potential scoring.
 */
export class ProductScoringService {
  /**
   * Scores a normalized product using provider-neutral heuristic signals only.
   */
  public score(product: NormalizedProduct): ProductScoreBreakdown {
    const completeness = this.calculateCompleteness(product);
    const demand = this.scoreDemand(product, completeness);
    const competition = this.scoreCompetition(product, completeness);
    const profitability = this.scoreProfitability(product);
    const trend = this.scoreTrend(product, completeness);
    const supplierReliability = this.scoreSupplierReliability(product.supplier);
    const shipping = this.scoreShipping(product);
    const marketingPotential = this.scoreMarketingPotential(product, completeness);
    const brandability = this.scoreBrandability(product, completeness);

    return {
      demand,
      competition,
      profitability,
      trend,
      supplierReliability,
      shipping,
      marketingPotential,
      brandability,
      overall: this.calculateOverall({
        demand,
        competition,
        profitability,
        trend,
        supplierReliability,
        shipping,
        marketingPotential,
        brandability,
      }),
    };
  }

  private scoreDemand(product: NormalizedProduct, completeness: number): number {
    const orderSignal = this.scoreOrderCount(product.supplier?.orderCount);
    const availableVariantRatio = this.availableVariantRatio(product.variants);
    const imageScore = this.scaleCount(product.images.length, 5);
    const marketScore = this.scaleCount(product.targetMarkets.length, 4);
    const descriptionScore = this.textLengthScore(product.description, 80, 500);
    const titleScore = this.isGenericTitle(product.title) ? 25 : this.textLengthScore(product.title, 12, 80);

    return this.averageScores([
      45,
      orderSignal,
      titleScore,
      descriptionScore,
      imageScore,
      marketScore,
      availableVariantRatio * 100,
      completeness * 0.7,
    ]);
  }

  private scoreCompetition(product: NormalizedProduct, completeness: number): number {
    const titleScore = this.isGenericTitle(product.title) ? 25 : this.textLengthScore(product.title, 15, 90);
    const brandScore = this.isDistinctBrand(product.brand) ? 75 : 35;
    const categoryScore = this.isUsableCategory(product.category) ? 70 : 35;
    const optionScore = this.scaleCount(product.options.length, 3);
    const variantScore = this.scaleCount(product.variants.length, 5);

    return this.averageScores([
      50,
      titleScore,
      brandScore,
      categoryScore,
      optionScore,
      variantScore,
      completeness * 0.5,
    ]);
  }

  private scoreProfitability(product: NormalizedProduct): number {
    const pricing = product.pricing;
    const cost = product.cost;

    if (pricing === undefined || cost === undefined || pricing.sellingPrice <= 0) {
      return 40;
    }

    if (pricing.sellingPrice <= cost.totalLandedCost) {
      return 20;
    }

    const grossProfitScore = this.clampScore((pricing.grossProfit / pricing.sellingPrice) * 100 * 1.4);
    const marginScore = this.clampScore(pricing.grossMarginPercentage * 1.25);
    const markupScore = this.clampScore(Math.min(pricing.markupPercentage, 300) / 3);
    const priceSignal = pricing.sellingPrice > 0 ? 65 : 35;

    return this.averageScores([grossProfitScore, marginScore, markupScore, priceSignal]);
  }

  private scoreTrend(product: NormalizedProduct, completeness: number): number {
    const orderSignal = this.scoreOrderCount(product.supplier?.orderCount);
    const imageReadiness = this.scaleCount(product.images.length, 4);
    const marketCoverage = this.scaleCount(product.targetMarkets.length, 4);
    const tagSignal = this.scaleCount(product.tags.length, 8);
    const commercialTagSignal = this.hasCommercialTags(product.tags) ? 70 : 50;

    return this.averageScores([
      50,
      orderSignal * 0.8,
      imageReadiness,
      marketCoverage,
      tagSignal,
      commercialTagSignal,
      completeness * 0.45,
    ]);
  }

  private scoreSupplierReliability(supplier: SupplierInformation | undefined): number {
    if (supplier === undefined) {
      return 40;
    }

    const ratingScore = this.scoreSupplierRating(supplier.supplierRating);
    const orderScore = this.scoreOrderCount(supplier.orderCount);
    const identityScore = this.hasText(supplier.supplierName) ? 70 : 35;
    const productUrlScore = this.hasText(supplier.supplierProductUrl) ? 70 : 40;
    const deliveryScore = this.scoreDeliveryWindow(
      supplier.estimatedDeliveryDaysMin,
      supplier.estimatedDeliveryDaysMax,
    );

    return this.averageScores([ratingScore, orderScore, identityScore, productUrlScore, deliveryScore]);
  }

  private scoreShipping(product: NormalizedProduct): number {
    const supplier = product.supplier;

    if (supplier === undefined) {
      return 42;
    }

    const deliveryScore = this.scoreDeliveryWindow(
      supplier.estimatedDeliveryDaysMin,
      supplier.estimatedDeliveryDaysMax,
    );
    const originScore = this.hasText(supplier.shippingOrigin) ? 65 : 45;
    const shippingCostScore = this.scoreShippingCost(product);

    return this.averageScores([deliveryScore, originScore, shippingCostScore]);
  }

  private scoreMarketingPotential(product: NormalizedProduct, completeness: number): number {
    const imageScore = this.scaleCount(product.images.length, 6);
    const descriptionScore = this.textLengthScore(product.description, 120, 700);
    const titleScore = this.isGenericTitle(product.title) ? 25 : this.textLengthScore(product.title, 15, 90);
    const tagScore = this.scaleCount(product.tags.length, 8);
    const availabilityScore = this.availableVariantRatio(product.variants) * 100;
    const marketScore = this.scaleCount(product.targetMarkets.length, 4);
    const priceScore = product.pricing !== undefined && product.pricing.sellingPrice > 0 ? 70 : 35;

    return this.averageScores([
      imageScore,
      descriptionScore,
      titleScore,
      tagScore,
      availabilityScore,
      marketScore,
      priceScore,
      completeness * 0.6,
    ]);
  }

  private scoreBrandability(product: NormalizedProduct, completeness: number): number {
    const brandScore = this.isDistinctBrand(product.brand) ? 75 : 30;
    const titleScore = this.isGenericTitle(product.title) ? 25 : this.textLengthScore(product.title, 15, 90);
    const categoryScore = this.isUsableCategory(product.category) ? 70 : 35;
    const productTypeScore = this.isUsableCategory(product.productType) ? 65 : 35;
    const imageScore = this.scaleCount(product.images.length, 5);
    const optionScore = this.scaleCount(product.options.length + product.variants.length, 6);

    return this.averageScores([
      brandScore,
      titleScore,
      categoryScore,
      productTypeScore,
      imageScore,
      optionScore,
      completeness * 0.5,
    ]);
  }

  private calculateCompleteness(product: NormalizedProduct): number {
    const checks = [
      this.hasText(product.title) && !this.isGenericTitle(product.title),
      this.hasText(product.description),
      this.isDistinctBrand(product.brand),
      this.isUsableCategory(product.category),
      product.images.length > 0,
      product.variants.length > 0,
      product.pricing !== undefined && product.pricing.sellingPrice > 0,
      product.supplier !== undefined,
      product.targetMarkets.length > 0,
    ];

    const passed = checks.filter(Boolean).length;
    return this.clampScore((passed / checks.length) * 100);
  }

  private calculateOverall(scores: Omit<ProductScoreBreakdown, "overall">): number {
    return this.clampScore(
      scores.demand * OVERALL_WEIGHTS.demand +
        scores.competition * OVERALL_WEIGHTS.competition +
        scores.profitability * OVERALL_WEIGHTS.profitability +
        scores.trend * OVERALL_WEIGHTS.trend +
        scores.supplierReliability * OVERALL_WEIGHTS.supplierReliability +
        scores.shipping * OVERALL_WEIGHTS.shipping +
        scores.marketingPotential * OVERALL_WEIGHTS.marketingPotential +
        scores.brandability * OVERALL_WEIGHTS.brandability,
    );
  }

  private scoreOrderCount(orderCount: number | undefined): number {
    const value = this.safeNonNegativeNumber(orderCount);

    if (value === undefined) {
      return 45;
    }

    if (value >= 10_000) {
      return 90;
    }

    if (value >= 1_000) {
      return 80;
    }

    if (value >= 250) {
      return 68;
    }

    if (value >= 50) {
      return 58;
    }

    if (value > 0) {
      return 50;
    }

    return 42;
  }

  private scoreSupplierRating(rating: number | undefined): number {
    const value = this.safeNonNegativeNumber(rating);

    if (value === undefined) {
      return 45;
    }

    if (value <= 5) {
      return this.clampScore((value / 5) * 100);
    }

    return this.clampScore(value);
  }

  private scoreDeliveryWindow(minDays: number | undefined, maxDays: number | undefined): number {
    const min = this.safeNonNegativeNumber(minDays);
    const max = this.safeNonNegativeNumber(maxDays);
    const deliveryDays = max ?? min;

    if (deliveryDays === undefined) {
      return 45;
    }

    const safeDeliveryDays = min !== undefined && max !== undefined && min > max ? min : deliveryDays;

    if (safeDeliveryDays <= 3) {
      return 95;
    }

    if (safeDeliveryDays <= 7) {
      return 82;
    }

    if (safeDeliveryDays <= 14) {
      return 68;
    }

    if (safeDeliveryDays <= 30) {
      return 48;
    }

    return 30;
  }

  private scoreShippingCost(product: NormalizedProduct): number {
    const cost = product.cost;

    if (cost === undefined) {
      return 45;
    }

    if (cost.shippingCost <= 0) {
      return 70;
    }

    if (cost.productCost <= 0) {
      return 45;
    }

    const ratio = cost.shippingCost / cost.productCost;

    if (!Number.isFinite(ratio)) {
      return 45;
    }

    if (ratio <= 0.1) {
      return 80;
    }

    if (ratio <= 0.25) {
      return 65;
    }

    if (ratio <= 0.5) {
      return 45;
    }

    return 30;
  }

  private availableVariantRatio(variants: readonly ProductVariant[]): number {
    if (variants.length === 0) {
      return 0;
    }

    const available = variants.filter((variant) => variant.available).length;
    return available / variants.length;
  }

  private scaleCount(count: number, target: number): number {
    if (target <= 0) {
      return 0;
    }

    return this.clampScore((Math.max(0, count) / target) * 100);
  }

  private textLengthScore(value: string | undefined, minimumUsefulLength: number, strongLength: number): number {
    if (!this.hasText(value)) {
      return 25;
    }

    const length = value.trim().length;

    if (length < minimumUsefulLength) {
      return 40;
    }

    return this.clampScore(55 + ((length - minimumUsefulLength) / (strongLength - minimumUsefulLength)) * 35);
  }

  private averageScores(scores: readonly number[]): number {
    if (scores.length === 0) {
      return 0;
    }

    const total = scores.reduce((sum, score) => sum + this.clampScore(score), 0);
    return this.clampScore(total / scores.length);
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return SCORE_MIN;
    }

    const clamped = Math.min(SCORE_MAX, Math.max(SCORE_MIN, value));
    return Math.round(clamped * 100) / 100;
  }

  private safeNonNegativeNumber(value: number | undefined): number | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (!Number.isFinite(value) || value < 0) {
      return undefined;
    }

    return value;
  }

  private hasText(value: string | undefined): value is string {
    return value !== undefined && value.trim().length > 0;
  }

  private isDistinctBrand(brand: string | undefined): boolean {
    return this.hasText(brand) && brand.trim().toLowerCase() !== "unbranded";
  }

  private isUsableCategory(category: string | undefined): boolean {
    return this.hasText(category) && category.trim().toLowerCase() !== "uncategorized";
  }

  private isGenericTitle(title: string | undefined): boolean {
    if (!this.hasText(title)) {
      return true;
    }

    const normalized = title.trim().toLowerCase().replace(/\s+/gu, " ");
    const genericTitles = new Set(["product", "item", "new product", "best product", "untitled product"]);

    return genericTitles.has(normalized);
  }

  private hasCommercialTags(tags: readonly string[]): boolean {
    const commercialKeywords = ["gift", "home", "beauty", "fitness", "kitchen", "pet", "travel", "tech"];

    return tags.some((tag) => {
      const normalized = tag.toLowerCase();
      return commercialKeywords.some((keyword) => normalized.includes(keyword));
    });
  }
}
