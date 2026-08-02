import {
  WinningHunterInvalidShortlistConfigurationError,
  WinningHunterInvalidShortlistInputError,
  WinningHunterInvalidShortlistTimestampError,
  WinningHunterMalformedOpportunityAssessmentError,
  WinningHunterProductAssessmentMismatchError,
  WinningHunterUnsupportedShortlistVersionError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type {
  NormalizedWinningProduct,
  WinningProductEvidenceLevel,
  WinningProductRecency,
} from "../../domain/models/normalized-winning-product.model.js";
import type {
  WinningProductOpportunityAssessment,
  WinningProductOpportunityRecommendation,
  WinningProductOpportunityRisk,
} from "../../domain/models/winning-product-opportunity-assessment.model.js";
import type {
  WinningProductMerchantDecision,
  WinningProductShortlistAction,
  WinningProductShortlistActionCode,
  WinningProductShortlistActionPriority,
  WinningProductShortlistBucket,
  WinningProductShortlistConfig,
  WinningProductShortlistEntry,
  WinningProductShortlistFailure,
  WinningProductShortlistInput,
  WinningProductShortlistResult,
  WinningProductShortlistStatus,
} from "../../domain/models/winning-product-shortlist.model.js";
import { createStableHash } from "../../domain/value-objects/winninghunter-url-normalizer.js";

export const DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG: WinningProductShortlistConfig =
  Object.freeze({
    version: "SACP-WH-SHORTLIST-v1",
    limits: Object.freeze({
      priorityReview: 10,
      standardReview: 20,
      watchlist: 20,
      excluded: 20,
      total: 50,
    }),
    includeExcluded: true,
  });

interface ValidatedPair {
  readonly product: NormalizedWinningProduct;
  readonly assessment: WinningProductOpportunityAssessment;
}

interface CandidateEntry {
  readonly product: NormalizedWinningProduct;
  readonly assessment: WinningProductOpportunityAssessment;
  readonly duplicateWarnings: readonly string[];
}

const BUCKET_PRIORITY: Readonly<Record<WinningProductShortlistBucket, number>> = {
  PRIORITY_REVIEW: 0,
  STANDARD_REVIEW: 1,
  WATCHLIST: 2,
  EXCLUDED: 3,
};

const EVIDENCE_PRIORITY: Readonly<Record<WinningProductEvidenceLevel, number>> = {
  STRONG: 0,
  MODERATE: 1,
  LIMITED: 2,
  INSUFFICIENT: 3,
};

const RECENCY_PRIORITY: Readonly<Record<WinningProductRecency, number>> = {
  CURRENT: 0,
  RECENT: 1,
  AGING: 2,
  STALE: 3,
  UNKNOWN: 4,
};

const ACTION_PRIORITY: Readonly<Record<WinningProductShortlistActionCode, number>> = {
  MERCHANT_REVIEW: 0,
  SUPPLIER_MATCHING: 1,
  LANDED_COST_VALIDATION: 2,
  MARGIN_VALIDATION: 3,
  SHIPPING_VALIDATION: 4,
  PRODUCT_SAFETY_REVIEW: 5,
  TRADEMARK_REVIEW: 6,
  PLATFORM_POLICY_REVIEW: 7,
  CREATIVE_REVIEW: 8,
  EVIDENCE_MONITORING: 9,
};

export class WinningHunterProductShortlistService {
  public getDefaultConfig(): WinningProductShortlistConfig {
    return cloneConfig(DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG);
  }

  public createShortlist(
    inputs: readonly WinningProductShortlistInput[],
    generatedAt: string,
    config: WinningProductShortlistConfig = DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG,
  ): WinningProductShortlistResult {
    validateTimestamp(generatedAt);
    const safeConfig = cloneConfig(config);
    validateShortlistConfig(safeConfig);

    const failures: WinningProductShortlistFailure[] = [];
    const warnings: string[] = [];
    const validPairs: ValidatedPair[] = [];

    for (const input of inputs) {
      try {
        validPairs.push(validateInput(input));
      } catch (error) {
        failures.push(toFailure(input?.assessment?.productId ?? input?.product?.id, error));
      }
    }

    const deduped = dedupePairs(validPairs, warnings);
    const ranked = deduped
      .map((candidate) => buildEntry(candidate, generatedAt, safeConfig, warnings))
      .sort(compareEntriesForRanking);
    const limited = applyLimits(ranked, safeConfig, warnings);
    const rankedEntries = limited.map((entry, index) => cloneEntry({ ...entry, rank: index + 1 }));
    const priorityReview = rankedEntries.filter((entry) => entry.bucket === "PRIORITY_REVIEW");
    const standardReview = rankedEntries.filter((entry) => entry.bucket === "STANDARD_REVIEW");
    const watchlist = rankedEntries.filter((entry) => entry.bucket === "WATCHLIST");
    const excluded = rankedEntries.filter((entry) => entry.bucket === "EXCLUDED");
    const actionableEntries = priorityReview.length + standardReview.length + watchlist.length;
    const status = determineStatus(rankedEntries.length, failures, warnings);

    return {
      shortlistId: buildShortlistId(rankedEntries, generatedAt, safeConfig.version),
      status,
      entries: rankedEntries,
      priorityReview,
      standardReview,
      watchlist,
      excluded,
      inputAssessments: inputs.length,
      includedEntries: rankedEntries.length,
      actionableEntries,
      excludedEntries: excluded.length,
      failures,
      warnings: uniqueSorted(warnings),
      scoringVersion: determineScoringVersion(rankedEntries),
      shortlistVersion: safeConfig.version,
      generatedAt,
    };
  }

  public updateMerchantDecision(
    entry: WinningProductShortlistEntry,
    decision: WinningProductMerchantDecision,
  ): WinningProductShortlistEntry {
    if (decision === undefined) {
      throw new WinningHunterInvalidShortlistInputError("Merchant decision must be explicit");
    }

    return cloneEntry({
      ...entry,
      merchantDecision: decision,
    });
  }
}

export function validateShortlistConfig(config: WinningProductShortlistConfig): void {
  if (config.version.trim().length === 0) {
    throw new WinningHunterInvalidShortlistConfigurationError("Shortlist version must not be blank");
  }

  if (config.version !== DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG.version) {
    throw new WinningHunterUnsupportedShortlistVersionError();
  }

  const limits = Object.values(config.limits);

  for (const limit of limits) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new WinningHunterInvalidShortlistConfigurationError(
        "Shortlist limits must be non-negative integers",
      );
    }
  }

  if (config.limits.total < 1 || config.limits.total > 200) {
    throw new WinningHunterInvalidShortlistConfigurationError(
      "Shortlist total limit must be between 1 and 200",
    );
  }

  for (const [key, value] of Object.entries(config.limits)) {
    if (key !== "total" && value > config.limits.total) {
      throw new WinningHunterInvalidShortlistConfigurationError(
        "Shortlist bucket limits must not exceed total limit",
      );
    }
  }

  validateMinimumScores(config);
}

function validateMinimumScores(config: WinningProductShortlistConfig): void {
  const minimumScores = config.minimumScores;

  if (minimumScores === undefined) {
    return;
  }

  const scores = [
    minimumScores.priorityReview,
    minimumScores.standardReview,
    minimumScores.watchlist,
  ].filter((score): score is number => score !== undefined);

  for (const score of scores) {
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      throw new WinningHunterInvalidShortlistConfigurationError(
        "Shortlist minimum score thresholds must be between 0 and 100",
      );
    }
  }

  if (
    minimumScores.priorityReview !== undefined &&
    minimumScores.standardReview !== undefined &&
    minimumScores.priorityReview < minimumScores.standardReview
  ) {
    throw new WinningHunterInvalidShortlistConfigurationError(
      "Shortlist minimum score thresholds must be logically ordered",
    );
  }

  if (
    minimumScores.standardReview !== undefined &&
    minimumScores.watchlist !== undefined &&
    minimumScores.standardReview < minimumScores.watchlist
  ) {
    throw new WinningHunterInvalidShortlistConfigurationError(
      "Shortlist minimum score thresholds must be logically ordered",
    );
  }
}

function validateInput(input: WinningProductShortlistInput): ValidatedPair {
  if (input === undefined || input === null) {
    throw new WinningHunterInvalidShortlistInputError();
  }

  const { product, assessment } = input;

  if (product.id.trim().length === 0) {
    throw new WinningHunterInvalidShortlistInputError("Product ID must not be blank");
  }

  if (
    !Array.isArray(product.markets) ||
    !Array.isArray(product.niches) ||
    !Array.isArray(product.marketSignals) ||
    !Array.isArray(product.creativeSignals) ||
    !Array.isArray(product.evidenceWarnings)
  ) {
    throw new WinningHunterInvalidShortlistInputError("Normalized product shape is invalid");
  }

  if (product.id !== assessment.productId) {
    throw new WinningHunterProductAssessmentMismatchError();
  }

  if (assessment.scoringVersion.trim().length === 0) {
    throw new WinningHunterMalformedOpportunityAssessmentError(
      "Assessment scoring version must not be blank",
    );
  }

  if (
    !Array.isArray(assessment.components) ||
    !Array.isArray(assessment.adjustments) ||
    !Array.isArray(assessment.strengths) ||
    !Array.isArray(assessment.risks) ||
    !Array.isArray(assessment.warnings)
  ) {
    throw new WinningHunterMalformedOpportunityAssessmentError(
      "Assessment evidence arrays are malformed",
    );
  }

  if (!Number.isFinite(assessment.overallScore) || assessment.overallScore < 0 || assessment.overallScore > 100) {
    throw new WinningHunterMalformedOpportunityAssessmentError(
      "Assessment score must be between 0 and 100",
    );
  }

  if (!["STRONG_CANDIDATE", "REVIEW", "WATCHLIST", "REJECT"].includes(assessment.recommendation)) {
    throw new WinningHunterMalformedOpportunityAssessmentError(
      "Assessment recommendation is unsupported",
    );
  }

  return {
    product: cloneProduct(product),
    assessment: cloneAssessment(assessment),
  };
}

function dedupePairs(
  pairs: readonly ValidatedPair[],
  warnings: string[],
): readonly CandidateEntry[] {
  const byProduct = new Map<string, CandidateEntry>();

  for (const pair of pairs) {
    const existing = byProduct.get(pair.product.id);

    if (existing === undefined) {
      byProduct.set(pair.product.id, {
        ...pair,
        duplicateWarnings: [],
      });
      continue;
    }

    warnings.push(`Duplicate shortlist input detected for product ${pair.product.id}.`);
    byProduct.set(pair.product.id, mergeDuplicate(existing, pair));
  }

  return [...byProduct.values()];
}

function mergeDuplicate(existing: CandidateEntry, incoming: ValidatedPair): CandidateEntry {
  const preferred = preferPair(existing, incoming);
  const alternate = preferred.assessment === existing.assessment ? incoming : existing;

  return {
    product: preferred.product,
    assessment: {
      ...preferred.assessment,
      strengths: uniqueSorted([...preferred.assessment.strengths, ...alternate.assessment.strengths]),
      risks: mergeRisks(preferred.assessment.risks, alternate.assessment.risks),
      warnings: uniqueSorted([...preferred.assessment.warnings, ...alternate.assessment.warnings]),
    },
    duplicateWarnings: [
      ...existing.duplicateWarnings,
      `Retained duplicate product ${preferred.product.id} with score ${preferred.assessment.overallScore}.`,
    ],
  };
}

function preferPair(existing: CandidateEntry, incoming: ValidatedPair): ValidatedPair {
  if (incoming.assessment.overallScore !== existing.assessment.overallScore) {
    return incoming.assessment.overallScore > existing.assessment.overallScore ? incoming : existing;
  }

  const incomingTime = Date.parse(incoming.assessment.evaluatedAt);
  const existingTime = Date.parse(existing.assessment.evaluatedAt);

  if (incomingTime !== existingTime) {
    return incomingTime > existingTime ? incoming : existing;
  }

  return incoming.assessment.scoringVersion.localeCompare(existing.assessment.scoringVersion) > 0
    ? incoming
    : existing;
}

function buildEntry(
  candidate: CandidateEntry,
  generatedAt: string,
  config: WinningProductShortlistConfig,
  globalWarnings: string[],
): WinningProductShortlistEntry {
  const warnings = uniqueSorted([
    ...candidate.assessment.warnings,
    ...candidate.duplicateWarnings,
  ]);
  const classification = classifyBucket(candidate.product, candidate.assessment, config);
  const entryWarnings = uniqueSorted([...warnings, ...classification.warnings]);

  for (const warning of classification.warnings) {
    globalWarnings.push(`${candidate.product.id}: ${warning}`);
  }

  return cloneEntry({
    id: `winninghunter-shortlist:${candidate.product.id}:${candidate.assessment.scoringVersion}`,
    productId: candidate.product.id,
    bucket: classification.bucket,
    merchantDecision: "PENDING_REVIEW",
    rank: 0,
    overallScore: candidate.assessment.overallScore,
    recommendation: candidate.assessment.recommendation,
    ...(candidate.product.title === undefined ? {} : { productTitle: candidate.product.title }),
    canonicalProductUrl: candidate.product.canonicalProductUrl,
    ...(candidate.product.storeDomain === undefined ? {} : { storeDomain: candidate.product.storeDomain }),
    ...(candidate.product.productHandle === undefined ? {} : { productHandle: candidate.product.productHandle }),
    ...(candidate.product.price === undefined ? {} : { price: candidate.product.price }),
    ...(candidate.product.currency === undefined ? {} : { currency: candidate.product.currency }),
    markets: [...candidate.product.markets],
    niches: [...candidate.product.niches],
    evidenceLevel: candidate.product.evidenceLevel,
    momentum: candidate.product.advertisingSummary.momentum,
    recency: candidate.product.recency,
    strengths: uniqueSorted(candidate.assessment.strengths),
    risks: mergeRisks(candidate.assessment.risks, []),
    warnings: entryWarnings,
    nextRequiredActions: buildActions(candidate.product, candidate.assessment, classification.bucket),
    assessmentVersion: candidate.assessment.scoringVersion,
    shortlistedAt: generatedAt,
  });
}

function classifyBucket(
  product: NormalizedWinningProduct,
  assessment: WinningProductOpportunityAssessment,
  config: WinningProductShortlistConfig,
): { readonly bucket: WinningProductShortlistBucket; readonly warnings: readonly string[] } {
  const warnings: string[] = [];
  let bucket = mapRecommendation(assessment.recommendation);
  const minimumBucket = minimumBucketForScore(assessment.overallScore, config);

  if (BUCKET_PRIORITY[bucket] < BUCKET_PRIORITY[minimumBucket]) {
    bucket = minimumBucket;
    warnings.push("Shortlist minimum score threshold downgraded bucket.");
  }

  if (!isUsableUrl(product.canonicalProductUrl) || assessment.risks.some((risk) => risk.code === "MISSING_CANONICAL_URL")) {
    bucket = "EXCLUDED";
    warnings.push("Missing or malformed product identity forced shortlist exclusion.");
  }

  if (product.advertisingSummary.uniqueAds === 0) {
    bucket = "EXCLUDED";
    warnings.push("No valid advertising evidence forced shortlist exclusion.");
  }

  if (assessment.risks.some((risk) => risk.severity === "HIGH" && risk.code === "INSUFFICIENT_EVIDENCE")) {
    bucket = downgradeBucket(bucket, "WATCHLIST");
    warnings.push("High insufficient-evidence risk prevents priority review.");
  }

  if (product.evidenceLevel === "INSUFFICIENT") {
    bucket = downgradeBucket(bucket, "WATCHLIST");
    warnings.push("Insufficient evidence cannot exceed watchlist.");
  }

  if (product.recency === "STALE" && bucket === "PRIORITY_REVIEW") {
    bucket = "STANDARD_REVIEW";
    warnings.push("Stale evidence prevents priority review.");
  }

  if (assessment.risks.some((risk) => risk.severity === "HIGH") && bucket === "PRIORITY_REVIEW") {
    bucket = "STANDARD_REVIEW";
    warnings.push("High-risk assessment prevents priority review.");
  }

  if (assessment.warnings.some((warning) => warning.toLowerCase().includes("malformed"))) {
    bucket = "EXCLUDED";
    warnings.push("Malformed evidence forced shortlist exclusion.");
  }

  return { bucket, warnings };
}

function minimumBucketForScore(
  score: number,
  config: WinningProductShortlistConfig,
): WinningProductShortlistBucket {
  const minimumScores = config.minimumScores;

  if (minimumScores === undefined) {
    return "PRIORITY_REVIEW";
  }

  if (minimumScores.priorityReview !== undefined && score < minimumScores.priorityReview) {
    if (minimumScores.standardReview !== undefined && score >= minimumScores.standardReview) {
      return "STANDARD_REVIEW";
    }

    if (minimumScores.watchlist !== undefined && score >= minimumScores.watchlist) {
      return "WATCHLIST";
    }

    return "EXCLUDED";
  }

  if (minimumScores.standardReview !== undefined && score < minimumScores.standardReview) {
    return minimumScores.watchlist !== undefined && score >= minimumScores.watchlist
      ? "WATCHLIST"
      : "EXCLUDED";
  }

  if (minimumScores.watchlist !== undefined && score < minimumScores.watchlist) {
    return "EXCLUDED";
  }

  return "PRIORITY_REVIEW";
}

function mapRecommendation(
  recommendation: WinningProductOpportunityRecommendation,
): WinningProductShortlistBucket {
  if (recommendation === "STRONG_CANDIDATE") {
    return "PRIORITY_REVIEW";
  }

  if (recommendation === "REVIEW") {
    return "STANDARD_REVIEW";
  }

  if (recommendation === "WATCHLIST") {
    return "WATCHLIST";
  }

  return "EXCLUDED";
}

function buildActions(
  product: NormalizedWinningProduct,
  assessment: WinningProductOpportunityAssessment,
  bucket: WinningProductShortlistBucket,
): readonly WinningProductShortlistAction[] {
  const actions = new Map<WinningProductShortlistActionCode, WinningProductShortlistAction>();

  addAction(actions, "MERCHANT_REVIEW", "HIGH", "Merchant must review this shortlist entry.");

  if (bucket !== "EXCLUDED") {
    addAction(actions, "SUPPLIER_MATCHING", "HIGH", "Supplier availability must be validated.");
    addAction(actions, "LANDED_COST_VALIDATION", "HIGH", "Delivered cost must be validated.");
    addAction(actions, "MARGIN_VALIDATION", "HIGH", "Gross margin must be validated.");
    addAction(actions, "SHIPPING_VALIDATION", "HIGH", "Shipping coverage and timing must be validated.");
  }

  if (requiresSafetyReview(product)) {
    addAction(actions, "PRODUCT_SAFETY_REVIEW", "HIGH", "Product safety and usage claims require review.");
  }

  if (requiresTrademarkReview(product)) {
    addAction(actions, "TRADEMARK_REVIEW", "MEDIUM", "Product ownership or branding needs review.");
  }

  if (requiresPolicyReview(product)) {
    addAction(actions, "PLATFORM_POLICY_REVIEW", "HIGH", "Potential platform policy-sensitive claims need review.");
  }

  if (requiresCreativeReview(product, assessment)) {
    addAction(actions, "CREATIVE_REVIEW", "MEDIUM", "Creative evidence needs review before launch planning.");
  }

  if (requiresEvidenceMonitoring(product, bucket)) {
    addAction(actions, "EVIDENCE_MONITORING", "LOW", "Evidence should be monitored before escalation.");
  }

  return [...actions.values()].sort(
    (left, right) => ACTION_PRIORITY[left.code] - ACTION_PRIORITY[right.code],
  );
}

function requiresSafetyReview(product: NormalizedWinningProduct): boolean {
  const text = `${product.title ?? ""} ${product.description ?? ""} ${product.evidenceWarnings.join(" ")}`.toLowerCase();

  return (
    product.niches.some((niche) => ["BY", "SK", "HT"].includes(niche)) ||
    /topical|ingestible|electrical|skin|body|face|hair|scalp|safety/u.test(text)
  );
}

function requiresTrademarkReview(product: NormalizedWinningProduct): boolean {
  const title = product.title;

  if (title === undefined) {
    return true;
  }

  return /[\u00AE\u2122]/u.test(title) || /^[A-Z][a-z]+[A-Z][A-Za-z]+/u.test(title);
}

function requiresPolicyReview(product: NormalizedWinningProduct): boolean {
  const text = `${product.title ?? ""} ${product.description ?? ""} ${product.evidenceWarnings.join(" ")}`.toLowerCase();

  return /health|therapy|cure|treatment|growth|weight loss|before and after|before-and-after|pheromone|anti[- ]?aging|wrinkle/u.test(text);
}

function requiresCreativeReview(
  product: NormalizedWinningProduct,
  assessment: WinningProductOpportunityAssessment,
): boolean {
  return (
    product.creativeSignals.length <= 1 ||
    product.recency === "STALE" ||
    assessment.risks.some((risk) => risk.code === "WEAK_CREATIVE_DIVERSITY") ||
    assessment.warnings.some((warning) => warning.toLowerCase().includes("creative"))
  );
}

function requiresEvidenceMonitoring(
  product: NormalizedWinningProduct,
  bucket: WinningProductShortlistBucket,
): boolean {
  return (
    bucket === "WATCHLIST" ||
    product.advertisingSummary.momentum === "UNKNOWN" ||
    product.advertisingSummary.momentum === "MIXED" ||
    product.recency === "AGING" ||
    product.recency === "STALE" ||
    product.evidenceLevel === "LIMITED" ||
    product.evidenceLevel === "INSUFFICIENT"
  );
}

function addAction(
  actions: Map<WinningProductShortlistActionCode, WinningProductShortlistAction>,
  code: WinningProductShortlistActionCode,
  priority: WinningProductShortlistActionPriority,
  reason: string,
): void {
  if (!actions.has(code)) {
    actions.set(code, { code, priority, reason, completed: false });
  }
}

function applyLimits(
  entries: readonly WinningProductShortlistEntry[],
  config: WinningProductShortlistConfig,
  warnings: string[],
): readonly WinningProductShortlistEntry[] {
  const bucketLimited = [
    ...limitBucket(entries, "PRIORITY_REVIEW", config.limits.priorityReview, warnings),
    ...limitBucket(entries, "STANDARD_REVIEW", config.limits.standardReview, warnings),
    ...limitBucket(entries, "WATCHLIST", config.limits.watchlist, warnings),
    ...(config.includeExcluded ? limitBucket(entries, "EXCLUDED", config.limits.excluded, warnings) : []),
  ].sort(compareEntriesForRanking);

  if (!config.includeExcluded && entries.some((entry) => entry.bucket === "EXCLUDED")) {
    warnings.push("Excluded entries were omitted by shortlist configuration.");
  }

  if (bucketLimited.length > config.limits.total) {
    warnings.push(`${bucketLimited.length - config.limits.total} shortlist entries were omitted by total limit.`);

    return bucketLimited.slice(0, config.limits.total);
  }

  return bucketLimited;
}

function limitBucket(
  entries: readonly WinningProductShortlistEntry[],
  bucket: WinningProductShortlistBucket,
  limit: number,
  warnings: string[],
): readonly WinningProductShortlistEntry[] {
  const bucketEntries = entries.filter((entry) => entry.bucket === bucket);

  if (bucketEntries.length > limit) {
    warnings.push(`${bucketEntries.length - limit} ${bucket} entries were omitted by bucket limit.`);
  }

  return bucketEntries.slice(0, limit);
}

function compareEntriesForRanking(
  left: WinningProductShortlistEntry,
  right: WinningProductShortlistEntry,
): number {
  return (
    BUCKET_PRIORITY[left.bucket] - BUCKET_PRIORITY[right.bucket] ||
    right.overallScore - left.overallScore ||
    EVIDENCE_PRIORITY[left.evidenceLevel] - EVIDENCE_PRIORITY[right.evidenceLevel] ||
    RECENCY_PRIORITY[left.recency] - RECENCY_PRIORITY[right.recency] ||
    right.markets.length - left.markets.length ||
    left.productId.localeCompare(right.productId)
  );
}

function determineStatus(
  entryCount: number,
  failures: readonly WinningProductShortlistFailure[],
  warnings: readonly string[],
): WinningProductShortlistStatus {
  if (entryCount === 0) {
    return "FAILED";
  }

  return failures.length > 0 || warnings.length > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED";
}

function buildShortlistId(
  entries: readonly WinningProductShortlistEntry[],
  generatedAt: string,
  shortlistVersion: string,
): string {
  const scoringVersion = determineScoringVersion(entries);
  const productIds = entries.map((entry) => entry.productId).sort().join("|");

  return `winninghunter-shortlist:${createStableHash(`${generatedAt}|${scoringVersion}|${shortlistVersion}|${productIds}`)}`;
}

function determineScoringVersion(entries: readonly WinningProductShortlistEntry[]): string {
  return uniqueSorted(entries.map((entry) => entry.assessmentVersion)).join("|");
}

function validateTimestamp(value: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new WinningHunterInvalidShortlistTimestampError();
  }
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

function downgradeBucket(
  current: WinningProductShortlistBucket,
  maximum: WinningProductShortlistBucket,
): WinningProductShortlistBucket {
  return BUCKET_PRIORITY[current] < BUCKET_PRIORITY[maximum] ? maximum : current;
}

function mergeRisks(
  left: readonly WinningProductOpportunityRisk[],
  right: readonly WinningProductOpportunityRisk[],
): readonly WinningProductOpportunityRisk[] {
  const byCode = new Map<string, WinningProductOpportunityRisk>();

  for (const risk of [...left, ...right]) {
    byCode.set(risk.code, { ...risk });
  }

  return [...byCode.values()].sort((leftRisk, rightRisk) => leftRisk.code.localeCompare(rightRisk.code));
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function cloneConfig(config: WinningProductShortlistConfig): WinningProductShortlistConfig {
  return {
    version: config.version,
    limits: { ...config.limits },
    ...(config.minimumScores === undefined ? {} : { minimumScores: { ...config.minimumScores } }),
    includeExcluded: config.includeExcluded,
  };
}

function cloneProduct(product: NormalizedWinningProduct): NormalizedWinningProduct {
  return {
    ...product,
    markets: [...product.markets],
    niches: [...product.niches],
    marketSignals: product.marketSignals.map((signal) => ({ ...signal, niches: [...signal.niches] })),
    creativeSignals: product.creativeSignals.map((signal) => ({ ...signal })),
    advertisingSummary: { ...product.advertisingSummary },
    evidenceReasons: [...product.evidenceReasons],
    evidenceWarnings: [...product.evidenceWarnings],
  };
}

function cloneAssessment(
  assessment: WinningProductOpportunityAssessment,
): WinningProductOpportunityAssessment {
  return {
    ...assessment,
    components: assessment.components.map((component) => ({
      ...component,
      reasons: [...component.reasons],
    })),
    adjustments: assessment.adjustments.map((adjustment) => ({ ...adjustment })),
    strengths: [...assessment.strengths],
    risks: assessment.risks.map((risk) => ({ ...risk })),
    warnings: [...assessment.warnings],
  };
}

function cloneEntry(entry: WinningProductShortlistEntry): WinningProductShortlistEntry {
  return {
    ...entry,
    markets: [...entry.markets],
    niches: [...entry.niches],
    strengths: [...entry.strengths],
    risks: entry.risks.map((risk) => ({ ...risk })),
    warnings: [...entry.warnings],
    nextRequiredActions: entry.nextRequiredActions.map((action) => ({ ...action })),
  };
}

function toFailure(productId: string | undefined, error: unknown): WinningProductShortlistFailure {
  return {
    ...(productId === undefined || productId.trim().length === 0 ? {} : { productId }),
    code: error instanceof Error ? error.name : "WinningHunterUnknownShortlistError",
    message: error instanceof Error ? error.message : "WinningHunter shortlist input failed",
  };
}
