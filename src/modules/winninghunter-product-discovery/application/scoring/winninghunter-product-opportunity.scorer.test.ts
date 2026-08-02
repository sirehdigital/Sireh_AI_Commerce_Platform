import { describe, expect, it } from "vitest";

import {
  WinningHunterInvalidScoringConfigurationError,
  WinningHunterInvalidScoringTimestampError,
  WinningHunterInvalidScoringWeightTotalError,
  WinningHunterMalformedNormalizedProductError,
  WinningHunterMissingScoringProductIdentityError,
  WinningHunterUnsupportedScoringVersionError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type { NormalizedWinningProduct } from "../../domain/models/normalized-winning-product.model.js";
import type { WinningProductOpportunityScoringConfig } from "../../domain/models/winning-product-opportunity-assessment.model.js";
import {
  DEFAULT_WINNING_PRODUCT_OPPORTUNITY_SCORING_CONFIG,
  validateScoringConfig,
  WinningHunterProductOpportunityScorer,
} from "./winninghunter-product-opportunity.scorer.js";

const EVALUATED_AT = "2026-08-02T00:00:00.000Z";

const buildProduct = (overrides: Partial<NormalizedWinningProduct> = {}): NormalizedWinningProduct => ({
  id: "winninghunter:shopify:111",
  source: "WINNING_HUNTER",
  externalProductId: "external-111",
  shopifyProductId: "111",
  title: "Travel Brush Capsule",
  description: "Compact travel holder for beauty brushes.",
  canonicalProductUrl: "https://example-beauty.test/products/travel-brush-capsule",
  storeDomain: "example-beauty.test",
  productHandle: "travel-brush-capsule",
  price: 24.95,
  currency: "USD",
  markets: ["AU", "CA", "GB", "US"],
  niches: ["BY"],
  marketSignals: [
    { market: "AU", niches: ["BY"], discoveryContexts: 1, adSignals: 1 },
    { market: "CA", niches: ["BY"], discoveryContexts: 1, adSignals: 1 },
    { market: "GB", niches: ["BY"], discoveryContexts: 1, adSignals: 2 },
    { market: "US", niches: ["BY"], discoveryContexts: 1, adSignals: 2 },
  ],
  creativeSignals: [
    { mediaType: "IMAGE", adCount: 3, percentageOfAds: 50 },
    { mediaType: "VIDEO", adCount: 3, percentageOfAds: 50 },
  ],
  advertisingSummary: {
    uniqueAds: 6,
    uniquePages: 2,
    activeSeenTotal: 18,
    earliestAdStartedAt: "2026-06-10T00:00:00.000Z",
    latestAdStartedAt: "2026-07-01T00:00:00.000Z",
    latestObservedAt: "2026-07-18T00:00:00.000Z",
    longestObservedRunningDays: 38,
    averageObservedRunningDays: 20,
    minimumAdRank: 2,
    maximumAdRank: 8,
    averageAdRank: 4,
    totalEuAdSpendObserved: 100,
    totalEuViewsObserved: 1000,
    highestPageActiveAds: 120,
    highestActiveAdsGrowthOneWeek: 12,
    highestActiveAdsGrowthOneMonth: 30,
    momentum: "RISING",
  },
  evidenceLevel: "STRONG",
  evidenceReasons: ["Observed across 4 target markets."],
  evidenceWarnings: [
    "Advertiser page activity is page-level evidence, not product-level evidence.",
    "Provider spend or reach observations may use overlapping measurement windows.",
  ],
  recency: "RECENT",
  firstDiscoveredAt: "2026-06-10T00:00:00.000Z",
  lastObservedAt: "2026-07-18T00:00:00.000Z",
  normalizedAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const buildConfig = (
  overrides: Partial<WinningProductOpportunityScoringConfig> = {},
): WinningProductOpportunityScoringConfig => ({
  version: "SACP-WH-SCORE-v1",
  weights: {
    advertisingDemand: 25,
    marketBreadth: 15,
    longevity: 15,
    momentum: 15,
    advertiserScaling: 10,
    creativeValidation: 10,
    evidenceQuality: 10,
  },
  thresholds: {
    strongCandidate: 80,
    review: 60,
    watchlist: 40,
  },
  ...overrides,
});

const scoreProduct = (product: NormalizedWinningProduct) =>
  new WinningHunterProductOpportunityScorer().score(product, EVALUATED_AT);

const componentScore = (product: NormalizedWinningProduct, key: string) =>
  scoreProduct(product).components.find((component) => component.key === key)?.score;

const withoutField = (product: NormalizedWinningProduct, field: keyof NormalizedWinningProduct) => {
  const copy: Record<string, unknown> = { ...product };
  delete copy[field];

  return copy as unknown as NormalizedWinningProduct;
};

const summaryWithoutFields = (
  fields: readonly string[],
  overrides: Readonly<Record<string, unknown>>,
) => {
  const copy: Record<string, unknown> = { ...buildProduct().advertisingSummary };

  for (const field of fields) {
    delete copy[field];
  }

  return { ...copy, ...overrides } as unknown as NormalizedWinningProduct["advertisingSummary"];
};

describe("WinningHunter Product Opportunity Scorer", () => {
  it("provides a defensive default config with weights totaling 100", () => {
    const scorer = new WinningHunterProductOpportunityScorer();
    const config = scorer.getDefaultConfig();

    expect(Object.values(config.weights).reduce((total, value) => total + value, 0)).toBe(100);
    (config.weights as Record<string, number>).advertisingDemand = 1;

    expect(scorer.getDefaultConfig().weights.advertisingDemand).toBe(25);
    expect(DEFAULT_WINNING_PRODUCT_OPPORTUNITY_SCORING_CONFIG.version).toBe("SACP-WH-SCORE-v1");
  });

  it("validates scoring configuration version, weights and thresholds", () => {
    expect(() => validateScoringConfig(buildConfig())).not.toThrow();
    expect(() => validateScoringConfig(buildConfig({ version: " " }))).toThrow(
      WinningHunterInvalidScoringConfigurationError,
    );
    expect(() => validateScoringConfig(buildConfig({ version: "SACP-WH-SCORE-v2" }))).toThrow(
      WinningHunterUnsupportedScoringVersionError,
    );
    expect(() =>
      validateScoringConfig(
        buildConfig({
          weights: {
            ...buildConfig().weights,
            advertisingDemand: -1,
          },
        }),
      ),
    ).toThrow(WinningHunterInvalidScoringConfigurationError);
    expect(() =>
      validateScoringConfig(
        buildConfig({
          weights: {
            ...buildConfig().weights,
            advertisingDemand: Number.NaN,
          },
        }),
      ),
    ).toThrow(WinningHunterInvalidScoringConfigurationError);
    expect(() =>
      validateScoringConfig(
        buildConfig({
          weights: {
            ...buildConfig().weights,
            advertisingDemand: 24,
          },
        }),
      ),
    ).toThrow(WinningHunterInvalidScoringWeightTotalError);
    expect(() =>
      validateScoringConfig(
        buildConfig({
          thresholds: {
            strongCandidate: 60,
            review: 80,
            watchlist: 40,
          },
        }),
      ),
    ).toThrow(WinningHunterInvalidScoringConfigurationError);
  });

  it("scores advertising demand across zero, one, multiple and maximum ad bands", () => {
    expect(componentScore(buildProduct({ advertisingSummary: { ...buildProduct().advertisingSummary, uniqueAds: 0 } }), "advertisingDemand")).toBe(0);
    expect(componentScore(buildProduct({ advertisingSummary: { ...buildProduct().advertisingSummary, uniqueAds: 1 } }), "advertisingDemand")).toBe(5);
    expect(componentScore(buildProduct({ advertisingSummary: { ...buildProduct().advertisingSummary, uniqueAds: 4 } }), "advertisingDemand")).toBe(16);
    expect(componentScore(buildProduct({ advertisingSummary: { ...buildProduct().advertisingSummary, uniqueAds: 12 } }), "advertisingDemand")).toBe(25);
  });

  it("scores market breadth from provenance and does not count ALL as a market", () => {
    expect(componentScore(buildProduct({ markets: ["US"], marketSignals: [{ market: "US", niches: ["BY"], discoveryContexts: 1, adSignals: 1 }] }), "marketBreadth")).toBe(5);
    expect(componentScore(buildProduct(), "marketBreadth")).toBe(15);
    expect(buildProduct().markets).not.toContain("ALL");
  });

  it("scores longevity bands and applies single-ad or stale/date reductions", () => {
    const summary = buildProduct().advertisingSummary;

    expect(
      componentScore(
        buildProduct({
          advertisingSummary: summaryWithoutFields(["longestObservedRunningDays"], {}),
        }),
        "longevity",
      ),
    ).toBe(0);
    expect(componentScore(buildProduct({ advertisingSummary: { ...summary, longestObservedRunningDays: 3 } }), "longevity")).toBe(2);
    expect(componentScore(buildProduct({ advertisingSummary: { ...summary, longestObservedRunningDays: 80 } }), "longevity")).toBe(15);
    expect(
      componentScore(
        buildProduct({
          advertisingSummary: { ...summary, uniqueAds: 1, longestObservedRunningDays: 80 },
          recency: "STALE",
          evidenceWarnings: ["Ignored malformed ad start date."],
        }),
        "longevity",
      ),
    ).toBe(12);
  });

  it("scores rising, stable, mixed, declining and unknown momentum", () => {
    const summary = buildProduct().advertisingSummary;

    expect(componentScore(buildProduct({ advertisingSummary: { ...summary, momentum: "RISING" } }), "momentum")).toBe(15);
    expect(componentScore(buildProduct({ advertisingSummary: { ...summary, momentum: "STABLE" } }), "momentum")).toBe(10);
    expect(componentScore(buildProduct({ advertisingSummary: { ...summary, momentum: "MIXED" } }), "momentum")).toBe(7);
    expect(componentScore(buildProduct({ advertisingSummary: { ...summary, momentum: "DECLINING" } }), "momentum")).toBe(2);
    expect(componentScore(buildProduct({ advertisingSummary: { ...summary, momentum: "UNKNOWN" } }), "momentum")).toBe(4);
  });

  it("scores advertiser activity and growth bonus with a visible advertiser-level risk", () => {
    const assessment = scoreProduct(buildProduct());

    expect(assessment.components.find((component) => component.key === "advertiserScaling")?.score).toBe(10);
    expect(assessment.risks.map((risk) => risk.code)).toContain("ADVERTISER_LEVEL_METRICS");
  });

  it("scores creative diversity and video-plus-format bonus", () => {
    expect(componentScore(buildProduct({ creativeSignals: [{ mediaType: "IMAGE", adCount: 1, percentageOfAds: 100 }], advertisingSummary: { ...buildProduct().advertisingSummary, uniqueAds: 1 } }), "creativeValidation")).toBe(2);
    expect(componentScore(buildProduct({ creativeSignals: [{ mediaType: "IMAGE", adCount: 3, percentageOfAds: 100 }] }), "creativeValidation")).toBe(5);
    expect(componentScore(buildProduct(), "creativeValidation")).toBe(8);
    expect(componentScore(buildProduct({ creativeSignals: [{ mediaType: "CAROUSEL", adCount: 2, percentageOfAds: 34 }, { mediaType: "IMAGE", adCount: 2, percentageOfAds: 33 }, { mediaType: "VIDEO", adCount: 2, percentageOfAds: 33 }] }), "creativeValidation")).toBe(10);
  });

  it("scores evidence quality levels and critical field deductions", () => {
    expect(componentScore(buildProduct({ evidenceLevel: "STRONG" }), "evidenceQuality")).toBe(10);
    expect(componentScore(buildProduct({ evidenceLevel: "MODERATE" }), "evidenceQuality")).toBe(7);
    expect(componentScore(buildProduct({ evidenceLevel: "LIMITED" }), "evidenceQuality")).toBe(4);
    expect(componentScore(buildProduct({ evidenceLevel: "INSUFFICIENT" }), "evidenceQuality")).toBe(0);
    expect(componentScore(withoutField(buildProduct({ evidenceLevel: "STRONG", recency: "UNKNOWN" }), "price"), "evidenceQuality")).toBe(8);
  });

  it("applies visible risk adjustments without double penalties", () => {
    const product = withoutField(
      buildProduct({
        recency: "STALE",
        evidenceWarnings: ["Ignored malformed ad start date.", "Ignored malformed ad start date."],
        advertisingSummary: {
          ...buildProduct().advertisingSummary,
          uniqueAds: 1,
          momentum: "DECLINING",
        },
      }),
      "currency",
    );
    const assessment = scoreProduct(withoutField(product, "price"));

    expect(assessment.adjustments.map((adjustment) => adjustment.code)).toEqual([
      "STALE_EVIDENCE",
      "ONLY_ONE_AD",
      "MISSING_PRICE",
      "MISSING_CURRENCY",
      "DECLINING_MOMENTUM",
      "SEVERE_MALFORMED_EVIDENCE",
    ]);
    expect(assessment.adjustments.filter((adjustment) => adjustment.code === "SEVERE_MALFORMED_EVIDENCE")).toHaveLength(1);
  });

  it("clamps scores between zero and 100", () => {
    const bad = scoreProduct(
      withoutField(
        withoutField(
          buildProduct({
            evidenceLevel: "INSUFFICIENT",
            recency: "STALE",
            markets: [],
            marketSignals: [],
            creativeSignals: [],
            advertisingSummary: summaryWithoutFields(
              [
                "longestObservedRunningDays",
                "highestPageActiveAds",
                "highestActiveAdsGrowthOneWeek",
                "highestActiveAdsGrowthOneMonth",
              ],
              {
                uniqueAds: 0,
                momentum: "UNKNOWN",
              },
            ),
          }),
          "price",
        ),
        "currency",
      ),
    );
    const excellent = new WinningHunterProductOpportunityScorer().score(
      buildProduct(),
      EVALUATED_AT,
      buildConfig({
        thresholds: { strongCandidate: 80, review: 60, watchlist: 40 },
      }),
    );

    expect(bad.overallScore).toBe(0);
    expect(excellent.overallScore).toBeLessThanOrEqual(100);
  });

  it("classifies recommendation thresholds and mandatory overrides", () => {
    const scorer = new WinningHunterProductOpportunityScorer();

    expect(scoreProduct(buildProduct()).recommendation).toBe("STRONG_CANDIDATE");
    expect(scorer.score(buildProduct(), EVALUATED_AT, buildConfig({ thresholds: { strongCandidate: 95, review: 60, watchlist: 40 } })).recommendation).toBe("REVIEW");
    expect(scorer.score(buildProduct(), EVALUATED_AT, buildConfig({ thresholds: { strongCandidate: 95, review: 94, watchlist: 40 } })).recommendation).toBe("WATCHLIST");
    expect(scorer.score(buildProduct(), EVALUATED_AT, buildConfig({ thresholds: { strongCandidate: 100, review: 99, watchlist: 98 } })).recommendation).toBe("REJECT");
    expect(scoreProduct(buildProduct({ evidenceLevel: "INSUFFICIENT" })).recommendation).toBe("WATCHLIST");
    expect(scoreProduct(buildProduct({ advertisingSummary: { ...buildProduct().advertisingSummary, uniqueAds: 0 } })).recommendation).toBe("REJECT");
    expect(scoreProduct(buildProduct({ canonicalProductUrl: "not-a-url" })).recommendation).toBe("REJECT");
  });

  it("generates deterministic strengths, risks and risk ordering", () => {
    const assessment = scoreProduct(
      withoutField(
        buildProduct({
          recency: "UNKNOWN",
          creativeSignals: [{ mediaType: "IMAGE", adCount: 1, percentageOfAds: 100 }],
          markets: ["US"],
          marketSignals: [{ market: "US", niches: ["BY"], discoveryContexts: 1, adSignals: 1 }],
          advertisingSummary: {
            ...buildProduct().advertisingSummary,
            uniqueAds: 1,
            momentum: "MIXED",
          },
        }),
        "description",
      ),
    );

    expect(assessment.strengths).toEqual([
      "Observed through 1 unique advertisements.",
      "Discovered across 1 target markets.",
      "Advertising evidence was observed over 38 days.",
      "Rank history indicates mixed momentum.",
    ]);
    expect(assessment.risks.map((risk) => `${risk.severity}:${risk.code}`)).toEqual([
      "MEDIUM:LIMITED_AD_COUNT",
      "MEDIUM:MIXED_MOMENTUM",
      "MEDIUM:SINGLE_MARKET_DEPENDENCE",
      "MEDIUM:UNKNOWN_RECENCY",
      "LOW:ADVERTISER_LEVEL_METRICS",
      "LOW:MISSING_DESCRIPTION",
      "LOW:OVERLAPPING_PROVIDER_METRICS",
      "LOW:WEAK_CREATIVE_DIVERSITY",
    ]);
  });

  it("keeps component and adjustment explainability verifiable", () => {
    const assessment = scoreProduct(buildProduct({ advertisingSummary: { ...buildProduct().advertisingSummary, uniqueAds: 1 } }));
    const componentTotal = assessment.components.reduce((total, component) => total + component.score, 0);
    const adjustmentTotal = assessment.adjustments.reduce((total, adjustment) => total + adjustment.points, 0);

    expect(assessment.components).toHaveLength(7);
    expect(assessment.adjustments.map((adjustment) => adjustment.code)).toContain("ONLY_ONE_AD");
    expect(assessment.overallScore).toBe(Math.max(0, Math.min(100, componentTotal + adjustmentTotal)));
  });

  it("returns defensive assessment copies and does not mutate input", () => {
    const scorer = new WinningHunterProductOpportunityScorer();
    const product = buildProduct();
    const before = JSON.stringify(product);
    const first = scorer.score(product, EVALUATED_AT);
    const second = scorer.score(product, EVALUATED_AT);

    expect(first).toEqual(second);
    expect(first.components).not.toBe(second.components);
    expect(first.risks).not.toBe(second.risks);
    expect(JSON.stringify(product)).toBe(before);
  });

  it("scores batches with malformed-product isolation and deterministic ordering", () => {
    const scorer = new WinningHunterProductOpportunityScorer();
    const strong = buildProduct({ id: "winninghunter:shopify:c" });
    const review = buildProduct({
      id: "winninghunter:shopify:a",
      evidenceLevel: "MODERATE",
      markets: ["US"],
      marketSignals: [{ market: "US", niches: ["BY"], discoveryContexts: 1, adSignals: 2 }],
      advertisingSummary: { ...buildProduct().advertisingSummary, uniqueAds: 2, highestPageActiveAds: 20 },
    });
    const tie = buildProduct({ id: "winninghunter:shopify:b" });
    const malformed = { ...buildProduct({ id: "broken" }), markets: undefined } as unknown as NormalizedWinningProduct;

    const result = scorer.scoreBatch([review, strong, malformed, tie], EVALUATED_AT);

    expect(result.assessments.map((assessment) => assessment.productId)).toEqual([
      "winninghunter:shopify:b",
      "winninghunter:shopify:c",
      "winninghunter:shopify:a",
    ]);
    expect(result.failures).toEqual([
      {
        productId: "broken",
        code: "WinningHunterMalformedNormalizedProductError",
        message: "WinningHunter normalized product is malformed",
      },
    ]);
    expect(result.scoringVersion).toBe("SACP-WH-SCORE-v1");
  });

  it("rejects invalid scoring inputs and invalid evaluatedAt timestamps", () => {
    const scorer = new WinningHunterProductOpportunityScorer();

    expect(() => scorer.score(buildProduct(), "not-a-date")).toThrow(
      WinningHunterInvalidScoringTimestampError,
    );
    expect(() => scorer.score(buildProduct({ id: " " }), EVALUATED_AT)).toThrow(
      WinningHunterMissingScoringProductIdentityError,
    );
    expect(() =>
      scorer.score({ ...buildProduct(), creativeSignals: undefined } as unknown as NormalizedWinningProduct, EVALUATED_AT),
    ).toThrow(WinningHunterMalformedNormalizedProductError);
  });

  it("accepts custom valid config values and includes the scoring version", () => {
    const scorer = new WinningHunterProductOpportunityScorer();
    const assessment = scorer.score(
      buildProduct(),
      EVALUATED_AT,
      buildConfig({
        weights: {
          advertisingDemand: 20,
          marketBreadth: 20,
          longevity: 15,
          momentum: 15,
          advertiserScaling: 10,
          creativeValidation: 10,
          evidenceQuality: 10,
        },
      }),
    );

    expect(assessment.scoringVersion).toBe("SACP-WH-SCORE-v1");
    expect(assessment.maximumScore).toBe(100);
  });
});
