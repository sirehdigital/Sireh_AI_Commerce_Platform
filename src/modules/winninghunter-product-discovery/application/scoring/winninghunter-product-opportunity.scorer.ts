import {
  WinningHunterInvalidScoringConfigurationError,
  WinningHunterInvalidScoringInputError,
  WinningHunterInvalidScoringTimestampError,
  WinningHunterInvalidScoringWeightTotalError,
  WinningHunterMalformedNormalizedProductError,
  WinningHunterMissingScoringProductIdentityError,
  WinningHunterUnsupportedScoringVersionError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type { NormalizedWinningProduct } from "../../domain/models/normalized-winning-product.model.js";
import type {
  WinningProductOpportunityAssessment,
  WinningProductOpportunityBatchFailure,
  WinningProductOpportunityBatchResult,
  WinningProductOpportunityRecommendation,
  WinningProductOpportunityRisk,
  WinningProductOpportunityScoringConfig,
  WinningProductRiskSeverity,
  WinningProductScoreAdjustment,
  WinningProductScoreComponent,
} from "../../domain/models/winning-product-opportunity-assessment.model.js";

export const DEFAULT_WINNING_PRODUCT_OPPORTUNITY_SCORING_CONFIG: WinningProductOpportunityScoringConfig =
  Object.freeze({
    version: "SACP-WH-SCORE-v1",
    weights: Object.freeze({
      advertisingDemand: 25,
      marketBreadth: 15,
      longevity: 15,
      momentum: 15,
      advertiserScaling: 10,
      creativeValidation: 10,
      evidenceQuality: 10,
    }),
    thresholds: Object.freeze({
      strongCandidate: 80,
      review: 60,
      watchlist: 40,
    }),
  });

const RECOMMENDATION_PRIORITY: Readonly<Record<WinningProductOpportunityRecommendation, number>> = {
  STRONG_CANDIDATE: 0,
  REVIEW: 1,
  WATCHLIST: 2,
  REJECT: 3,
};

const RISK_PRIORITY: Readonly<Record<WinningProductRiskSeverity, number>> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export class WinningHunterProductOpportunityScorer {
  public getDefaultConfig(): WinningProductOpportunityScoringConfig {
    return cloneConfig(DEFAULT_WINNING_PRODUCT_OPPORTUNITY_SCORING_CONFIG);
  }

  public score(
    product: NormalizedWinningProduct,
    evaluatedAt: string,
    config: WinningProductOpportunityScoringConfig = DEFAULT_WINNING_PRODUCT_OPPORTUNITY_SCORING_CONFIG,
  ): WinningProductOpportunityAssessment {
    validateEvaluatedAt(evaluatedAt);
    const safeConfig = cloneConfig(config);
    validateScoringConfig(safeConfig);
    validateProduct(product);

    const components = [
      scoreAdvertisingDemand(product, safeConfig),
      scoreMarketBreadth(product, safeConfig),
      scoreLongevity(product, safeConfig),
      scoreMomentum(product, safeConfig),
      scoreAdvertiserScaling(product, safeConfig),
      scoreCreativeValidation(product, safeConfig),
      scoreEvidenceQuality(product, safeConfig),
    ];
    const adjustments = buildAdjustments(product);
    const componentTotal = components.reduce((total, component) => total + component.score, 0);
    const adjustmentTotal = adjustments.reduce((total, adjustment) => total + adjustment.points, 0);
    const overallScore = clampScore(componentTotal + adjustmentTotal);
    const recommendation = applyRecommendationOverrides(
      product,
      recommendationForScore(overallScore, safeConfig),
    );

    return cloneAssessment({
      productId: product.id,
      overallScore,
      maximumScore: 100,
      recommendation,
      components,
      adjustments,
      strengths: buildStrengths(product),
      risks: buildRisks(product),
      warnings: [...product.evidenceWarnings],
      evidenceLevel: product.evidenceLevel,
      evaluatedAt,
      scoringVersion: safeConfig.version,
    });
  }

  public scoreBatch(
    products: readonly NormalizedWinningProduct[],
    evaluatedAt: string,
    config: WinningProductOpportunityScoringConfig = DEFAULT_WINNING_PRODUCT_OPPORTUNITY_SCORING_CONFIG,
  ): WinningProductOpportunityBatchResult {
    validateEvaluatedAt(evaluatedAt);
    const safeConfig = cloneConfig(config);
    validateScoringConfig(safeConfig);
    const assessments: WinningProductOpportunityAssessment[] = [];
    const failures: WinningProductOpportunityBatchFailure[] = [];

    for (const product of products) {
      try {
        assessments.push(this.score(product, evaluatedAt, safeConfig));
      } catch (error) {
        failures.push(toBatchFailure(product?.id, error));
      }
    }

    return {
      assessments: assessments.sort(compareAssessments).map((assessment) => cloneAssessment(assessment)),
      failures,
      evaluatedAt,
      scoringVersion: safeConfig.version,
    };
  }
}

export function validateScoringConfig(config: WinningProductOpportunityScoringConfig): void {
  if (config.version.trim().length === 0) {
    throw new WinningHunterInvalidScoringConfigurationError("Scoring version must not be blank");
  }

  if (config.version !== DEFAULT_WINNING_PRODUCT_OPPORTUNITY_SCORING_CONFIG.version) {
    throw new WinningHunterUnsupportedScoringVersionError();
  }

  const weights = Object.values(config.weights);

  for (const weight of weights) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new WinningHunterInvalidScoringConfigurationError(
        "Scoring weights must be finite non-negative numbers",
      );
    }
  }

  if (weights.reduce((total, weight) => total + weight, 0) !== 100) {
    throw new WinningHunterInvalidScoringWeightTotalError();
  }

  const { strongCandidate, review, watchlist } = config.thresholds;

  for (const threshold of [strongCandidate, review, watchlist]) {
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      throw new WinningHunterInvalidScoringConfigurationError(
        "Scoring thresholds must be between 0 and 100",
      );
    }
  }

  if (!(strongCandidate > review && review > watchlist)) {
    throw new WinningHunterInvalidScoringConfigurationError(
      "Scoring thresholds must be ordered strongCandidate > review > watchlist",
    );
  }
}

function scoreAdvertisingDemand(
  product: NormalizedWinningProduct,
  config: WinningProductOpportunityScoringConfig,
): WinningProductScoreComponent {
  const uniqueAds = product.advertisingSummary.uniqueAds;
  const score = scaleScore(
    uniqueAds === 0
      ? 0
      : uniqueAds === 1
        ? 5
        : uniqueAds === 2
          ? 10
          : uniqueAds <= 4
            ? 16
            : uniqueAds <= 9
              ? 21
              : 25,
    25,
    config.weights.advertisingDemand,
  );

  return component("advertisingDemand", "Advertising Demand Signal", uniqueAds, score, 25, [
    `Observed through ${uniqueAds} unique advertisements.`,
  ]);
}

function scoreMarketBreadth(
  product: NormalizedWinningProduct,
  config: WinningProductOpportunityScoringConfig,
): WinningProductScoreComponent {
  const markets = product.markets.length;
  const base = markets === 0 ? 0 : markets === 1 ? 5 : markets === 2 ? 9 : markets === 3 ? 12 : 15;
  const contexts = product.marketSignals.reduce((total, signal) => total + signal.discoveryContexts, 0);
  const contextBonus = markets < 4 && contexts >= 3 ? 1 : 0;
  const score = scaleScore(Math.min(15, base + contextBonus), 15, config.weights.marketBreadth);

  return component("marketBreadth", "Market Breadth", markets, score, 15, [
    `Discovered across ${markets} target markets.`,
  ]);
}

function scoreLongevity(
  product: NormalizedWinningProduct,
  config: WinningProductOpportunityScoringConfig,
): WinningProductScoreComponent {
  const days = product.advertisingSummary.longestObservedRunningDays;
  const base =
    days === undefined
      ? 0
      : days <= 3
        ? 2
        : days <= 7
          ? 5
          : days <= 14
            ? 8
            : days <= 30
              ? 11
              : days <= 60
                ? 13
                : 15;
  const reduction =
    (product.advertisingSummary.uniqueAds === 1 ? 1 : 0) +
    (product.recency === "STALE" ? 1 : 0) +
    (hasDateWarning(product) ? 1 : 0);
  const score = scaleScore(Math.max(0, base - reduction), 15, config.weights.longevity);

  return component("longevity", "Advertising Longevity", days ?? "UNKNOWN", score, 15, [
    days === undefined
      ? "No usable observed advertising longevity evidence."
      : `Longest observed advertising window is ${days} days.`,
  ]);
}

function scoreMomentum(
  product: NormalizedWinningProduct,
  config: WinningProductOpportunityScoringConfig,
): WinningProductScoreComponent {
  const base = {
    RISING: 15,
    STABLE: 10,
    MIXED: 7,
    UNKNOWN: 4,
    DECLINING: 2,
  }[product.advertisingSummary.momentum];
  const score = scaleScore(base, 15, config.weights.momentum);

  return component("momentum", "Momentum", product.advertisingSummary.momentum, score, 15, [
    `Rank-history momentum is ${product.advertisingSummary.momentum}.`,
  ]);
}

function scoreAdvertiserScaling(
  product: NormalizedWinningProduct,
  config: WinningProductOpportunityScoringConfig,
): WinningProductScoreComponent {
  const activity = product.advertisingSummary.highestPageActiveAds;
  const activityScore =
    activity === undefined
      ? 0
      : activity <= 9
        ? 1
        : activity <= 24
          ? 3
          : activity <= 49
            ? 5
            : activity <= 99
              ? 7
              : 8;
  const growthBonus =
    (product.advertisingSummary.highestActiveAdsGrowthOneWeek ?? 0) > 0 ||
    (product.advertisingSummary.highestActiveAdsGrowthOneMonth ?? 0) > 0
      ? 2
      : 0;
  const score = scaleScore(Math.min(10, activityScore + growthBonus), 10, config.weights.advertiserScaling);

  return component("advertiserScaling", "Advertiser Scaling Signal", activity ?? "UNKNOWN", score, 10, [
    "Advertiser page activity is treated as supporting evidence only.",
  ]);
}

function scoreCreativeValidation(
  product: NormalizedWinningProduct,
  config: WinningProductOpportunityScoringConfig,
): WinningProductScoreComponent {
  const creativeTypes = product.creativeSignals.length;
  const uniqueAds = product.advertisingSummary.uniqueAds;
  const hasVideo = product.creativeSignals.some((signal) => signal.mediaType === "VIDEO");
  const base =
    creativeTypes === 0 ? 0 : creativeTypes === 1 && uniqueAds === 1 ? 2 : creativeTypes === 1 ? 5 : creativeTypes === 2 ? 7 : 9;
  const score = scaleScore(Math.min(10, base + (hasVideo && creativeTypes > 1 ? 1 : 0)), 10, config.weights.creativeValidation);

  return component("creativeValidation", "Creative Validation", creativeTypes, score, 10, [
    `Detected ${creativeTypes} creative format groups.`,
  ]);
}

function scoreEvidenceQuality(
  product: NormalizedWinningProduct,
  config: WinningProductOpportunityScoringConfig,
): WinningProductScoreComponent {
  const base = {
    STRONG: 10,
    MODERATE: 7,
    LIMITED: 4,
    INSUFFICIENT: 0,
  }[product.evidenceLevel];
  const deductions =
    (isUsableUrl(product.canonicalProductUrl) ? 0 : 4) +
    (product.title === undefined ? 1 : 0) +
    (product.price === undefined ? 1 : 0) +
    (product.currency === undefined ? 1 : 0) +
    (product.recency === "UNKNOWN" ? 1 : 0) +
    (product.markets.length === 0 ? 2 : 0);
  const score = scaleScore(Math.max(0, base - deductions), 10, config.weights.evidenceQuality);

  return component("evidenceQuality", "Evidence Quality", product.evidenceLevel, score, 10, [
    `Normalizer evidence level is ${product.evidenceLevel}.`,
  ]);
}

function buildAdjustments(product: NormalizedWinningProduct): readonly WinningProductScoreAdjustment[] {
  const adjustments: WinningProductScoreAdjustment[] = [];

  addAdjustment(adjustments, product.recency === "STALE", "STALE_EVIDENCE", -10, "Latest observation is stale.");
  addAdjustment(
    adjustments,
    product.evidenceLevel === "INSUFFICIENT",
    "INSUFFICIENT_EVIDENCE",
    -15,
    "Normalized evidence level is insufficient.",
  );
  addAdjustment(
    adjustments,
    !isUsableUrl(product.canonicalProductUrl),
    "MISSING_CANONICAL_URL",
    -20,
    "Canonical product URL is missing or malformed.",
  );
  addAdjustment(
    adjustments,
    product.advertisingSummary.uniqueAds === 0,
    "NO_VALID_ADS",
    -20,
    "No valid unique advertisements are available.",
  );
  addAdjustment(
    adjustments,
    product.advertisingSummary.uniqueAds === 1,
    "ONLY_ONE_AD",
    -5,
    "Only one valid advertisement is available.",
  );
  addAdjustment(adjustments, product.price === undefined, "MISSING_PRICE", -3, "Product price is missing.");
  addAdjustment(
    adjustments,
    product.currency === undefined,
    "MISSING_CURRENCY",
    -2,
    "Product currency is missing.",
  );
  addAdjustment(
    adjustments,
    product.advertisingSummary.momentum === "UNKNOWN",
    "UNKNOWN_MOMENTUM",
    -2,
    "Rank-history momentum is unknown.",
  );
  addAdjustment(
    adjustments,
    product.advertisingSummary.momentum === "DECLINING",
    "DECLINING_MOMENTUM",
    -5,
    "Rank-history momentum is declining.",
  );
  addAdjustment(
    adjustments,
    product.advertisingSummary.momentum === "MIXED",
    "CONTRADICTORY_SIGNALS",
    -3,
    "Rank-history momentum contains contradictory signals.",
  );
  addAdjustment(
    adjustments,
    product.evidenceWarnings.some((warning) => warning.toLowerCase().includes("malformed")),
    "SEVERE_MALFORMED_EVIDENCE",
    -10,
    "Malformed evidence was detected during normalization.",
  );

  return adjustments;
}

function buildStrengths(product: NormalizedWinningProduct): readonly string[] {
  const strengths: string[] = [];

  if (product.advertisingSummary.uniqueAds > 0) {
    strengths.push(`Observed through ${product.advertisingSummary.uniqueAds} unique advertisements.`);
  }

  if (product.markets.length > 0) {
    strengths.push(`Discovered across ${product.markets.length} target markets.`);
  }

  if (product.advertisingSummary.longestObservedRunningDays !== undefined) {
    strengths.push(
      `Advertising evidence was observed over ${product.advertisingSummary.longestObservedRunningDays} days.`,
    );
  }

  if (product.advertisingSummary.momentum !== "UNKNOWN") {
    strengths.push(`Rank history indicates ${product.advertisingSummary.momentum.toLowerCase()} momentum.`);
  }

  if (product.creativeSignals.length > 1) {
    strengths.push("Multiple creative formats are being tested.");
  }

  return strengths;
}

function buildRisks(product: NormalizedWinningProduct): readonly WinningProductOpportunityRisk[] {
  const risks: WinningProductOpportunityRisk[] = [];

  addRisk(risks, product.recency === "STALE", "STALE_OBSERVATIONS", "HIGH", "Latest product observation is stale.");
  addRisk(
    risks,
    product.evidenceLevel === "INSUFFICIENT",
    "INSUFFICIENT_EVIDENCE",
    "HIGH",
    "Normalized evidence is insufficient for confident review.",
  );
  addRisk(
    risks,
    product.advertisingSummary.uniqueAds <= 1,
    "LIMITED_AD_COUNT",
    "MEDIUM",
    "Product evidence is based on one or fewer unique advertisements.",
  );
  addRisk(
    risks,
    product.markets.length === 1,
    "SINGLE_MARKET_DEPENDENCE",
    "MEDIUM",
    "Product evidence is currently limited to one target market.",
  );
  addRisk(
    risks,
    product.advertisingSummary.momentum === "DECLINING",
    "DECLINING_MOMENTUM",
    "HIGH",
    "Rank-history momentum is declining.",
  );
  addRisk(
    risks,
    product.advertisingSummary.momentum === "MIXED",
    "MIXED_MOMENTUM",
    "MEDIUM",
    "Rank-history momentum is mixed across advertisements.",
  );
  addRisk(risks, product.price === undefined, "MISSING_PRICE", "MEDIUM", "Product price is missing.");
  addRisk(risks, product.currency === undefined, "MISSING_CURRENCY", "MEDIUM", "Product currency is missing.");
  addRisk(risks, product.title === undefined, "MISSING_TITLE", "LOW", "Product title is missing.");
  addRisk(
    risks,
    product.description === undefined,
    "MISSING_DESCRIPTION",
    "LOW",
    "Product description is missing.",
  );
  addRisk(
    risks,
    product.advertisingSummary.highestPageActiveAds !== undefined,
    "ADVERTISER_LEVEL_METRICS",
    "LOW",
    "Advertiser page activity may include unrelated products.",
  );
  addRisk(
    risks,
    product.evidenceWarnings.some((warning) => warning.toLowerCase().includes("overlap")),
    "OVERLAPPING_PROVIDER_METRICS",
    "LOW",
    "Provider spend or reach observations may overlap.",
  );
  addRisk(
    risks,
    product.recency === "UNKNOWN",
    "UNKNOWN_RECENCY",
    "MEDIUM",
    "Latest product observation recency is unknown.",
  );
  addRisk(
    risks,
    product.creativeSignals.length <= 1,
    "WEAK_CREATIVE_DIVERSITY",
    "LOW",
    "Creative evidence has limited format diversity.",
  );

  return risks.sort(
    (left, right) =>
      RISK_PRIORITY[left.severity] - RISK_PRIORITY[right.severity] ||
      left.code.localeCompare(right.code),
  );
}

function applyRecommendationOverrides(
  product: NormalizedWinningProduct,
  recommendation: WinningProductOpportunityRecommendation,
): WinningProductOpportunityRecommendation {
  if (!isUsableUrl(product.canonicalProductUrl)) {
    return "REJECT";
  }

  if (product.advertisingSummary.uniqueAds === 0) {
    return "REJECT";
  }

  if (product.evidenceWarnings.some((warning) => warning.toLowerCase().includes("malformed"))) {
    return "REJECT";
  }

  if (product.evidenceLevel === "INSUFFICIENT" && recommendationPriority(recommendation) < recommendationPriority("WATCHLIST")) {
    return "WATCHLIST";
  }

  return recommendation;
}

function recommendationForScore(
  score: number,
  config: WinningProductOpportunityScoringConfig,
): WinningProductOpportunityRecommendation {
  if (score >= config.thresholds.strongCandidate) {
    return "STRONG_CANDIDATE";
  }

  if (score >= config.thresholds.review) {
    return "REVIEW";
  }

  if (score >= config.thresholds.watchlist) {
    return "WATCHLIST";
  }

  return "REJECT";
}

function validateProduct(product: NormalizedWinningProduct): void {
  if (product === undefined || product === null) {
    throw new WinningHunterInvalidScoringInputError();
  }

  if (product.id.trim().length === 0) {
    throw new WinningHunterMissingScoringProductIdentityError();
  }

  if (
    !Array.isArray(product.markets) ||
    !Array.isArray(product.niches) ||
    !Array.isArray(product.marketSignals) ||
    !Array.isArray(product.creativeSignals) ||
    !Array.isArray(product.evidenceWarnings)
  ) {
    throw new WinningHunterMalformedNormalizedProductError();
  }
}

function validateEvaluatedAt(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new WinningHunterInvalidScoringTimestampError();
  }
}

function compareAssessments(
  left: WinningProductOpportunityAssessment,
  right: WinningProductOpportunityAssessment,
): number {
  return (
    right.overallScore - left.overallScore ||
    RECOMMENDATION_PRIORITY[left.recommendation] - RECOMMENDATION_PRIORITY[right.recommendation] ||
    left.productId.localeCompare(right.productId)
  );
}

function recommendationPriority(recommendation: WinningProductOpportunityRecommendation): number {
  return RECOMMENDATION_PRIORITY[recommendation];
}

function component(
  key: string,
  label: string,
  rawValue: number | string,
  score: number,
  maximumScore: number,
  reasons: readonly string[],
): WinningProductScoreComponent {
  return {
    key,
    label,
    rawValue,
    score,
    maximumScore,
    reasons,
  };
}

function addAdjustment(
  adjustments: WinningProductScoreAdjustment[],
  condition: boolean,
  code: string,
  points: number,
  reason: string,
): void {
  if (condition && adjustments.every((adjustment) => adjustment.code !== code)) {
    adjustments.push({ code, points, reason });
  }
}

function addRisk(
  risks: WinningProductOpportunityRisk[],
  condition: boolean,
  code: string,
  severity: WinningProductRiskSeverity,
  message: string,
): void {
  if (condition && risks.every((risk) => risk.code !== code)) {
    risks.push({ code, severity, message });
  }
}

function hasDateWarning(product: NormalizedWinningProduct): boolean {
  return product.evidenceWarnings.some((warning) => warning.toLowerCase().includes("date"));
}

function scaleScore(score: number, baseMaximum: number, configuredMaximum: number): number {
  return roundInteger((score / baseMaximum) * configuredMaximum);
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, roundInteger(score)));
}

function roundInteger(value: number): number {
  // All component and final scores are rounded to whole numbers for reproducible review math.
  return Math.round(value);
}

function isUsableUrl(value: string | undefined): boolean {
  if (value === undefined || value.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(value);

    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function cloneConfig(config: WinningProductOpportunityScoringConfig): WinningProductOpportunityScoringConfig {
  return {
    version: config.version,
    weights: { ...config.weights },
    thresholds: { ...config.thresholds },
  };
}

function cloneAssessment(assessment: WinningProductOpportunityAssessment): WinningProductOpportunityAssessment {
  return {
    ...assessment,
    components: assessment.components.map((componentValue) => ({
      ...componentValue,
      reasons: [...componentValue.reasons],
    })),
    adjustments: assessment.adjustments.map((adjustment) => ({ ...adjustment })),
    strengths: [...assessment.strengths],
    risks: assessment.risks.map((risk) => ({ ...risk })),
    warnings: [...assessment.warnings],
  };
}

function toBatchFailure(productId: string | undefined, error: unknown): WinningProductOpportunityBatchFailure {
  const code = error instanceof Error ? error.name : "WinningHunterUnknownScoringError";
  const message = error instanceof Error ? error.message : "WinningHunter scoring failed";

  return {
    ...(productId === undefined || productId.trim().length === 0 ? {} : { productId }),
    code,
    message,
  };
}
