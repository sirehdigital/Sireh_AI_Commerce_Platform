import { describe, expect, it } from "vitest";

import { ProductHunterValidationError } from "../../domain/errors/product-hunter.errors.js";
import type { ProductCandidate } from "../../domain/models/product-candidate.model.js";
import { ProductCandidateScoringService } from "./product-candidate-scoring.service.js";
import { ProductHunterRankingService } from "./product-hunter-ranking.service.js";

const buildCandidate = (overrides: Partial<ProductCandidate> = {}): ProductCandidate => ({
  source: "manual",
  sourceProductId: "candidate-001",
  title: "Portable Skin Cooling Wand",
  productUrl: "https://supplier.test/products/candidate-001",
  imageUrl: "https://supplier.test/images/candidate-001.jpg",
  supplierPrice: 12,
  shippingCost: 3,
  suggestedSellingPrice: 39,
  currency: "USD",
  estimatedDeliveryDays: 6,
  supplierRating: 4.8,
  salesOrOrders: 3_500,
  reviewCount: 420,
  trendScore: 88,
  competitionScore: 25,
  ...overrides,
});

describe("Product Hunter ranking", () => {
  it("gives a strong product a high winning score", () => {
    const scoringService = new ProductCandidateScoringService();

    const result = scoringService.score(buildCandidate());

    expect(result.winningScore).toBeGreaterThanOrEqual(80);
    expect(result.scoreBreakdown.profitMargin).toBeGreaterThan(90);
    expect(result.scoreBreakdown.competitionOpportunity).toBe(75);
  });

  it("gives a weak product a low winning score", () => {
    const scoringService = new ProductCandidateScoringService();

    const result = scoringService.score(
      buildCandidate({
        sourceProductId: "candidate-weak",
        supplierPrice: 18,
        shippingCost: 7,
        suggestedSellingPrice: 24,
        estimatedDeliveryDays: 45,
        supplierRating: 2.2,
        salesOrOrders: 3,
        reviewCount: 0,
        trendScore: 15,
        competitionScore: 92,
      }),
    );

    expect(result.winningScore).toBeLessThan(35);
  });

  it("ranks products from highest to lowest score", () => {
    const rankingService = new ProductHunterRankingService();
    const strongCandidate = buildCandidate({ sourceProductId: "strong" });
    const weakCandidate = buildCandidate({
      sourceProductId: "weak",
      supplierPrice: 18,
      shippingCost: 8,
      suggestedSellingPrice: 29,
      estimatedDeliveryDays: 32,
      supplierRating: 2,
      salesOrOrders: 0,
      reviewCount: 0,
      trendScore: 10,
      competitionScore: 95,
    });
    const mediumCandidate = buildCandidate({
      sourceProductId: "medium",
      supplierPrice: 14,
      shippingCost: 4,
      suggestedSellingPrice: 34,
      estimatedDeliveryDays: 12,
      supplierRating: 4.1,
      salesOrOrders: 500,
      reviewCount: 60,
      trendScore: 62,
      competitionScore: 48,
    });

    const results = rankingService.rank([mediumCandidate, weakCandidate, strongCandidate]);

    expect(results.map((result) => result.candidate.sourceProductId)).toEqual(["strong", "medium", "weak"]);
  });

  it("calculates total cost, profit, and margin", () => {
    const scoringService = new ProductCandidateScoringService();

    const result = scoringService.score(
      buildCandidate({
        supplierPrice: 10.1,
        shippingCost: 4.2,
        suggestedSellingPrice: 30,
      }),
    );

    expect(result.financials.totalCost.amount).toBe(14.3);
    expect(result.financials.estimatedProfit.amount).toBe(15.7);
    expect(result.financials.profitMarginPercentage).toBe(52.33);
  });

  it("rejects invalid financial values", () => {
    const scoringService = new ProductCandidateScoringService();
    const invalidCandidates: readonly ProductCandidate[] = [
      buildCandidate({ supplierPrice: -1 }),
      buildCandidate({ shippingCost: Number.NaN }),
      buildCandidate({ suggestedSellingPrice: 0 }),
    ];

    for (const invalidCandidate of invalidCandidates) {
      expect(() => scoringService.score(invalidCandidate)).toThrow(ProductHunterValidationError);
    }
  });

  it("does not mutate input data while ranking", () => {
    const rankingService = new ProductHunterRankingService();
    const inputCandidates = [
      buildCandidate({ sourceProductId: "middle", salesOrOrders: 250 }),
      buildCandidate({ sourceProductId: "top", salesOrOrders: 10_000 }),
    ] as const;
    const originalInputSnapshot = JSON.stringify(inputCandidates);

    const results = rankingService.rank(inputCandidates);

    expect(JSON.stringify(inputCandidates)).toBe(originalInputSnapshot);
    expect(results).not.toBe(inputCandidates);
    expect(results[0]?.candidate).not.toBe(inputCandidates[0]);
  });
});
