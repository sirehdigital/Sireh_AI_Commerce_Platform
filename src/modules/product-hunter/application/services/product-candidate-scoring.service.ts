import { ProductHunterValidationError } from "../../domain/errors/product-hunter.errors.js";
import type {
  ProductCandidate,
  ProductCandidateFinancials,
  ProductCandidateScoreBreakdown,
  ScoredProductCandidate,
} from "../../domain/models/product-candidate.model.js";

const SCORE_MIN = 0;
const SCORE_MAX = 100;

const SCORE_WEIGHTS = {
  profitMargin: 0.3,
  salesDemand: 0.2,
  supplierRating: 0.15,
  deliverySpeed: 0.15,
  trendStrength: 0.1,
  competitionOpportunity: 0.1,
} as const;

const PRODUCT_HUNTER_SOURCES = new Set<ProductCandidate["source"]>([
  "autods",
  "winninghunter",
  "koala",
  "aliexpress",
  "manual",
]);

export class ProductCandidateScoringService {
  public score(candidate: ProductCandidate): ScoredProductCandidate {
    this.validateCandidate(candidate);

    const financials = this.calculateFinancials(candidate);
    const scoreBreakdown = this.calculateScoreBreakdown(candidate, financials);

    return {
      candidate: { ...candidate },
      financials,
      scoreBreakdown,
      winningScore: this.calculateWinningScore(scoreBreakdown),
    };
  }

  private calculateFinancials(candidate: ProductCandidate): ProductCandidateFinancials {
    const totalCost = this.roundMoney(candidate.supplierPrice + candidate.shippingCost);
    const estimatedProfit = this.roundMoney(candidate.suggestedSellingPrice - totalCost);
    const profitMarginPercentage = this.roundPercentage(
      (estimatedProfit / candidate.suggestedSellingPrice) * 100,
    );

    return {
      supplierPrice: {
        amount: this.roundMoney(candidate.supplierPrice),
        currency: candidate.currency,
      },
      shippingCost: {
        amount: this.roundMoney(candidate.shippingCost),
        currency: candidate.currency,
      },
      suggestedSellingPrice: {
        amount: this.roundMoney(candidate.suggestedSellingPrice),
        currency: candidate.currency,
      },
      totalCost: {
        amount: totalCost,
        currency: candidate.currency,
      },
      estimatedProfit: {
        amount: estimatedProfit,
        currency: candidate.currency,
      },
      profitMarginPercentage,
    };
  }

  private calculateScoreBreakdown(
    candidate: ProductCandidate,
    financials: ProductCandidateFinancials,
  ): ProductCandidateScoreBreakdown {
    return {
      profitMargin: this.scoreProfitMargin(financials.profitMarginPercentage),
      salesDemand: this.scoreSalesDemand(candidate.salesOrOrders, candidate.reviewCount),
      supplierRating: this.scoreSupplierRating(candidate.supplierRating),
      deliverySpeed: this.scoreDeliverySpeed(candidate.estimatedDeliveryDays),
      trendStrength: this.clampScore(candidate.trendScore),
      competitionOpportunity: this.clampScore(SCORE_MAX - candidate.competitionScore),
    };
  }

  private calculateWinningScore(scoreBreakdown: ProductCandidateScoreBreakdown): number {
    return this.clampScore(
      scoreBreakdown.profitMargin * SCORE_WEIGHTS.profitMargin +
        scoreBreakdown.salesDemand * SCORE_WEIGHTS.salesDemand +
        scoreBreakdown.supplierRating * SCORE_WEIGHTS.supplierRating +
        scoreBreakdown.deliverySpeed * SCORE_WEIGHTS.deliverySpeed +
        scoreBreakdown.trendStrength * SCORE_WEIGHTS.trendStrength +
        scoreBreakdown.competitionOpportunity * SCORE_WEIGHTS.competitionOpportunity,
    );
  }

  private scoreProfitMargin(profitMarginPercentage: number): number {
    if (profitMarginPercentage <= 0) {
      return 0;
    }

    return this.clampScore((profitMarginPercentage / 60) * SCORE_MAX);
  }

  private scoreSalesDemand(salesOrOrders: number, reviewCount: number): number {
    const orderScore = this.scoreOrderVolume(salesOrOrders);
    const reviewScore = this.scoreReviewVolume(reviewCount);

    return this.clampScore(orderScore * 0.7 + reviewScore * 0.3);
  }

  private scoreOrderVolume(salesOrOrders: number): number {
    if (salesOrOrders >= 10_000) {
      return 100;
    }

    if (salesOrOrders >= 2_500) {
      return 90;
    }

    if (salesOrOrders >= 1_000) {
      return 80;
    }

    if (salesOrOrders >= 250) {
      return 65;
    }

    if (salesOrOrders >= 50) {
      return 45;
    }

    if (salesOrOrders > 0) {
      return 25;
    }

    return 10;
  }

  private scoreReviewVolume(reviewCount: number): number {
    if (reviewCount >= 1_000) {
      return 100;
    }

    if (reviewCount >= 250) {
      return 85;
    }

    if (reviewCount >= 75) {
      return 70;
    }

    if (reviewCount >= 15) {
      return 50;
    }

    if (reviewCount > 0) {
      return 30;
    }

    return 10;
  }

  private scoreSupplierRating(supplierRating: number): number {
    if (supplierRating <= 5) {
      return this.clampScore((supplierRating / 5) * SCORE_MAX);
    }

    return this.clampScore(supplierRating);
  }

  private scoreDeliverySpeed(estimatedDeliveryDays: number): number {
    if (estimatedDeliveryDays <= 3) {
      return 100;
    }

    if (estimatedDeliveryDays <= 7) {
      return 85;
    }

    if (estimatedDeliveryDays <= 14) {
      return 65;
    }

    if (estimatedDeliveryDays <= 30) {
      return 35;
    }

    return 10;
  }

  private validateCandidate(candidate: ProductCandidate): void {
    if (!PRODUCT_HUNTER_SOURCES.has(candidate.source)) {
      throw new ProductHunterValidationError("Product candidate source is not supported.");
    }

    this.validateRequiredText(candidate.sourceProductId, "Product candidate source product ID is required.");
    this.validateRequiredText(candidate.title, "Product candidate title is required.");
    this.validateRequiredText(candidate.productUrl, "Product candidate URL is required.");
    this.validateRequiredText(candidate.imageUrl, "Product candidate image URL is required.");
    this.validateRequiredText(candidate.currency, "Product candidate currency is required.");
    this.validateMoney(candidate.supplierPrice, "Supplier price must be finite and non-negative.");
    this.validateMoney(candidate.shippingCost, "Shipping cost must be finite and non-negative.");
    this.validatePositiveMoney(
      candidate.suggestedSellingPrice,
      "Suggested selling price must be finite and greater than zero.",
    );
    this.validateNonNegativeInteger(
      candidate.estimatedDeliveryDays,
      "Estimated delivery days must be a non-negative integer.",
    );
    this.validateNonNegativeFiniteNumber(candidate.supplierRating, "Supplier rating must be finite and non-negative.");
    this.validateNonNegativeInteger(candidate.salesOrOrders, "Sales or orders must be a non-negative integer.");
    this.validateNonNegativeInteger(candidate.reviewCount, "Review count must be a non-negative integer.");
    this.validateScore(candidate.trendScore, "Trend score must be a finite score from 0 to 100.");
    this.validateScore(candidate.competitionScore, "Competition score must be a finite score from 0 to 100.");
  }

  private validateRequiredText(value: string, message: string): void {
    if (value.trim().length === 0) {
      throw new ProductHunterValidationError(message);
    }
  }

  private validateMoney(value: number, message: string): void {
    this.validateNonNegativeFiniteNumber(value, message);
  }

  private validatePositiveMoney(value: number, message: string): void {
    if (!Number.isFinite(value) || value <= 0) {
      throw new ProductHunterValidationError(message);
    }
  }

  private validateScore(value: number, message: string): void {
    if (!Number.isFinite(value) || value < SCORE_MIN || value > SCORE_MAX) {
      throw new ProductHunterValidationError(message);
    }
  }

  private validateNonNegativeInteger(value: number, message: string): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new ProductHunterValidationError(message);
    }
  }

  private validateNonNegativeFiniteNumber(value: number, message: string): void {
    if (!Number.isFinite(value) || value < 0) {
      throw new ProductHunterValidationError(message);
    }
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) {
      return SCORE_MIN;
    }

    return this.roundPercentage(Math.min(SCORE_MAX, Math.max(SCORE_MIN, value)));
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundPercentage(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
