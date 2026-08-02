import {
  WinningHunterConflictingPipelineStrategyError,
  WinningHunterInvalidPipelineRequestError,
  WinningHunterInvalidPipelineTimestampError,
  WinningHunterMissingPipelineStrategyError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type {
  NormalizedWinningProduct,
} from "../../domain/models/normalized-winning-product.model.js";
import type {
  WinningProductOpportunityAssessment,
  WinningProductOpportunityBatchFailure,
  WinningProductOpportunityScoringConfig,
} from "../../domain/models/winning-product-opportunity-assessment.model.js";
import type {
  WinningProductShortlistConfig,
  WinningProductShortlistEntry,
  WinningProductShortlistFailure,
  WinningProductShortlistInput,
  WinningProductShortlistResult,
} from "../../domain/models/winning-product-shortlist.model.js";
import type {
  WinningHunterDiscoveryCapabilitySummary,
  WinningHunterDiscoveryPipelineFailure,
  WinningHunterDiscoveryPipelineHealthSummary,
  WinningHunterDiscoveryPipelineRequest,
  WinningHunterDiscoveryPipelineResult,
  WinningHunterDiscoveryPipelineStage,
  WinningHunterDiscoveryPipelineStageStatus,
  WinningHunterDiscoveryPipelineStageSummary,
  WinningHunterDiscoveryPipelineStatus,
} from "../../domain/models/winninghunter-discovery-pipeline.model.js";
import type {
  WinningHunterDiscoveryRunResult,
  WinningHunterDiscoveryRunWarning,
  WinningHunterProductDiscoveryStrategy,
} from "../../domain/models/winninghunter-discovery-strategy.model.js";
import { createStableHash } from "../../domain/value-objects/winninghunter-url-normalizer.js";
import { InMemoryWinningHunterProductDiscoveryClient } from "../../infrastructure/clients/in-memory-winninghunter-product-discovery.client.js";
import type { InMemoryWinningHunterClientOptions } from "../../infrastructure/clients/in-memory-winninghunter-product-discovery.client.js";
import type { WinningHunterProductDiscoveryClient } from "../ports/winninghunter-product-discovery-client.js";
import {
  DEFAULT_WINNING_PRODUCT_OPPORTUNITY_SCORING_CONFIG,
  validateScoringConfig,
  WinningHunterProductOpportunityScorer,
} from "../scoring/winninghunter-product-opportunity.scorer.js";
import {
  WinningHunterDiscoveryQueryEngine,
} from "../services/winninghunter-discovery-query-engine.js";
import {
  cloneWinningHunterStrategy,
  validateWinningHunterStrategy,
  WinningHunterDiscoveryStrategyRegistry,
} from "../strategies/winninghunter-discovery-strategy.registry.js";
import { WinningHunterProductNormalizer } from "../normalizers/winninghunter-product.normalizer.js";
import {
  DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG,
  validateShortlistConfig,
  WinningHunterProductShortlistService,
} from "../shortlist/winninghunter-product-shortlist.service.js";

interface DiscoveryEngine {
  discover(strategy: WinningHunterProductDiscoveryStrategy): Promise<WinningHunterDiscoveryRunResult>;
}

export interface WinningHunterDiscoveryPipelineServiceDependencies {
  readonly discoveryEngine: DiscoveryEngine;
  readonly strategyRegistry?: WinningHunterDiscoveryStrategyRegistry;
  readonly normalizer?: WinningHunterProductNormalizer;
  readonly scorer?: WinningHunterProductOpportunityScorer;
  readonly shortlistService?: WinningHunterProductShortlistService;
}

interface ValidatedPipelineRequest {
  readonly strategy: WinningHunterProductDiscoveryStrategy;
  readonly normalizationTimestamp: string;
  readonly scoringTimestamp: string;
  readonly shortlistTimestamp: string;
  readonly scoringConfig: WinningProductOpportunityScoringConfig;
  readonly shortlistConfig: WinningProductShortlistConfig;
}

interface PipelinePairingResult {
  readonly inputs: readonly WinningProductShortlistInput[];
  readonly failures: readonly WinningHunterDiscoveryPipelineFailure[];
  readonly warnings: readonly string[];
}

const STAGE_ORDER: readonly WinningHunterDiscoveryPipelineStage[] = [
  "DISCOVERY",
  "NORMALIZATION",
  "SCORING",
  "SHORTLIST",
];

export class WinningHunterDiscoveryPipelineService {
  private readonly discoveryEngine: DiscoveryEngine;
  private readonly strategyRegistry: WinningHunterDiscoveryStrategyRegistry;
  private readonly normalizer: WinningHunterProductNormalizer;
  private readonly scorer: WinningHunterProductOpportunityScorer;
  private readonly shortlistService: WinningHunterProductShortlistService;

  public constructor(dependencies: WinningHunterDiscoveryPipelineServiceDependencies) {
    this.discoveryEngine = dependencies.discoveryEngine;
    this.strategyRegistry = dependencies.strategyRegistry ?? new WinningHunterDiscoveryStrategyRegistry();
    this.normalizer = dependencies.normalizer ?? new WinningHunterProductNormalizer();
    this.scorer = dependencies.scorer ?? new WinningHunterProductOpportunityScorer();
    this.shortlistService = dependencies.shortlistService ?? new WinningHunterProductShortlistService();
  }

  public async run(
    request: WinningHunterDiscoveryPipelineRequest,
  ): Promise<WinningHunterDiscoveryPipelineResult> {
    const validated = this.validateRequest(request);
    const failures: WinningHunterDiscoveryPipelineFailure[] = [];
    const warnings: string[] = [];
    const stages: WinningHunterDiscoveryPipelineStageSummary[] = [];
    let discoveryRun: WinningHunterDiscoveryRunResult;

    try {
      discoveryRun = await this.discoveryEngine.discover(validated.strategy);
    } catch (error) {
      discoveryRun = createEmptyDiscoveryRun(validated.strategy.id, validated.normalizationTimestamp, "FAILED");
      failures.push(toFailure("DISCOVERY", undefined, error));
      warnings.push("[DISCOVERY] Discovery failed before candidates could be collected.");
    }

    const safeDiscoveryRun = cloneDiscoveryRun({
      ...discoveryRun,
      startedAt: validated.normalizationTimestamp,
      completedAt: validated.normalizationTimestamp,
    });
    const discoveryMessages = discoveryWarningsToMessages(safeDiscoveryRun.warnings);
    warnings.push(...discoveryMessages);
    stages.push(buildStageSummary(
      "DISCOVERY",
      resolveDiscoveryStageStatus(safeDiscoveryRun),
      safeDiscoveryRun.executionUnitsPlanned,
      safeDiscoveryRun.uniqueCandidates,
      safeDiscoveryRun.executionUnitsFailed,
      safeDiscoveryRun.warnings.length,
      discoveryMessages,
    ));

    if (safeDiscoveryRun.status === "FAILED" || safeDiscoveryRun.candidates.length === 0) {
      const result = this.buildFailedAfterDiscovery(validated, safeDiscoveryRun, stages, failures, warnings);

      return clonePipelineResult(result);
    }

    const normalizedBatch = this.normalizer.normalizeRunWithWarnings(
      safeDiscoveryRun,
      validated.normalizationTimestamp,
    );
    const normalizedProducts = normalizedBatch.products;
    const normalizationMessages = normalizedBatch.warnings.map((warning) => `[NORMALIZATION] ${warning}`);
    warnings.push(...normalizationMessages);
    const normalizationFailed = safeDiscoveryRun.candidates.length - normalizedProducts.length;

    if (normalizationFailed > 0) {
      failures.push({
        stage: "NORMALIZATION",
        code: "NORMALIZATION_PARTIAL_FAILURE",
        message: `${normalizationFailed} discovered candidates could not be normalized.`,
      });
    }

    stages.push(buildStageSummary(
      "NORMALIZATION",
      resolveStageStatus(normalizedProducts.length, normalizationFailed, normalizationMessages.length),
      safeDiscoveryRun.candidates.length,
      normalizedProducts.length,
      normalizationFailed,
      normalizationMessages.length,
      normalizationMessages,
    ));

    if (normalizedProducts.length === 0) {
      const result = this.buildFailedAfterNormalization(
        validated,
        safeDiscoveryRun,
        stages,
        failures,
        warnings,
      );

      return clonePipelineResult(result);
    }

    const scoringBatch = this.scorer.scoreBatch(
      normalizedProducts,
      validated.scoringTimestamp,
      validated.scoringConfig,
    );
    const assessments = scoringBatch.assessments;
    failures.push(...scoringBatch.failures.map((failure) => toScoringFailure(failure)));
    const scoringMessages = scoringBatch.failures.map((failure) =>
      `[SCORING] ${failure.productId ?? "unknown"}: ${failure.message}`,
    );
    warnings.push(...scoringMessages);
    stages.push(buildStageSummary(
      "SCORING",
      resolveStageStatus(assessments.length, scoringBatch.failures.length, scoringMessages.length),
      normalizedProducts.length,
      assessments.length,
      scoringBatch.failures.length,
      scoringMessages.length,
      scoringMessages,
    ));

    if (assessments.length === 0) {
      const result = this.buildFailedAfterScoring(
        validated,
        safeDiscoveryRun,
        normalizedProducts,
        stages,
        failures,
        warnings,
      );

      return clonePipelineResult(result);
    }

    const pairing = pairProductsAndAssessments(normalizedProducts, assessments);
    failures.push(...pairing.failures);
    warnings.push(...pairing.warnings);

    const shortlist = this.shortlistService.createShortlist(
      pairing.inputs,
      validated.shortlistTimestamp,
      validated.shortlistConfig,
    );
    failures.push(...shortlist.failures.map((failure) => toShortlistFailure(failure)));
    const shortlistMessages = shortlist.warnings.map((warning) => `[SHORTLIST] ${warning}`);
    warnings.push(...shortlistMessages);
    stages.push(buildStageSummary(
      "SHORTLIST",
      resolveShortlistStageStatus(shortlist),
      pairing.inputs.length,
      shortlist.entries.length,
      shortlist.failures.length,
      shortlist.warnings.length,
      shortlistMessages,
    ));

    const dedupedWarnings = uniqueSorted(warnings);
    const orderedFailures = sortFailures(failures);
    const status = resolvePipelineStatus(
      shortlist.actionableEntries,
      orderedFailures.length,
      dedupedWarnings.length,
      shortlist.status,
    );

    return clonePipelineResult({
      pipelineId: buildPipelineId(validated),
      status,
      strategyId: validated.strategy.id,
      discoveryRun: safeDiscoveryRun,
      normalizedProducts,
      opportunityAssessments: assessments,
      shortlist,
      stages,
      failures: orderedFailures,
      warnings: dedupedWarnings,
      health: buildHealth(status, stages, orderedFailures, dedupedWarnings, validated.shortlistTimestamp),
      capabilities: CAPABILITIES,
      discoveredCandidates: safeDiscoveryRun.uniqueCandidates,
      normalizedProductsCount: normalizedProducts.length,
      assessmentsCount: assessments.length,
      shortlistEntriesCount: shortlist.entries.length,
      actionableEntriesCount: shortlist.actionableEntries,
      startedAt: validated.normalizationTimestamp,
      completedAt: validated.shortlistTimestamp,
      scoringVersion: scoringBatch.scoringVersion,
      shortlistVersion: shortlist.shortlistVersion,
    });
  }

  private validateRequest(request: WinningHunterDiscoveryPipelineRequest): ValidatedPipelineRequest {
    if (request === undefined || request === null) {
      throw new WinningHunterInvalidPipelineRequestError();
    }

    if (request.strategyPreset !== undefined && request.customStrategy !== undefined) {
      throw new WinningHunterConflictingPipelineStrategyError();
    }

    if (request.strategyPreset === undefined && request.customStrategy === undefined) {
      throw new WinningHunterMissingPipelineStrategyError();
    }

    const normalizationTimestamp = validatePipelineTimestamp(
      request.normalizationTimestamp,
      "normalizationTimestamp",
    );
    const scoringTimestamp = validatePipelineTimestamp(request.scoringTimestamp, "scoringTimestamp");
    const shortlistTimestamp = validatePipelineTimestamp(request.shortlistTimestamp, "shortlistTimestamp");

    if (
      Date.parse(normalizationTimestamp) > Date.parse(scoringTimestamp) ||
      Date.parse(scoringTimestamp) > Date.parse(shortlistTimestamp)
    ) {
      throw new WinningHunterInvalidPipelineTimestampError(
        "Pipeline timestamps must be chronologically non-decreasing",
      );
    }

    const strategy = request.customStrategy === undefined
      ? this.strategyRegistry.getPreset(request.strategyPreset!)
      : cloneWinningHunterStrategy(request.customStrategy);
    validateWinningHunterStrategy(strategy);

    const scoringConfig = cloneScoringConfig(
      request.scoringConfig ?? DEFAULT_WINNING_PRODUCT_OPPORTUNITY_SCORING_CONFIG,
    );
    validateScoringConfig(scoringConfig);

    const shortlistConfig = cloneShortlistConfig(
      request.shortlistConfig ?? DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG,
    );
    validateShortlistConfig(shortlistConfig);

    return {
      strategy,
      normalizationTimestamp,
      scoringTimestamp,
      shortlistTimestamp,
      scoringConfig,
      shortlistConfig,
    };
  }

  private buildFailedAfterDiscovery(
    request: ValidatedPipelineRequest,
    discoveryRun: WinningHunterDiscoveryRunResult,
    stages: readonly WinningHunterDiscoveryPipelineStageSummary[],
    failures: readonly WinningHunterDiscoveryPipelineFailure[],
    warnings: readonly string[],
  ): WinningHunterDiscoveryPipelineResult {
    const finalFailures: readonly WinningHunterDiscoveryPipelineFailure[] = failures.length > 0
      ? failures
      : [{ stage: "DISCOVERY", code: "DISCOVERY_EMPTY", message: "Discovery produced no usable candidates." }];
    const allStages = [
      ...stages,
      skippedStage("NORMALIZATION"),
      skippedStage("SCORING"),
      skippedStage("SHORTLIST"),
    ];

    return buildBaseResult(request, discoveryRun, [], [], emptyShortlist(request), allStages, finalFailures, warnings);
  }

  private buildFailedAfterNormalization(
    request: ValidatedPipelineRequest,
    discoveryRun: WinningHunterDiscoveryRunResult,
    stages: readonly WinningHunterDiscoveryPipelineStageSummary[],
    failures: readonly WinningHunterDiscoveryPipelineFailure[],
    warnings: readonly string[],
  ): WinningHunterDiscoveryPipelineResult {
    const finalFailures = [
      ...failures,
      { stage: "NORMALIZATION" as const, code: "NORMALIZATION_EMPTY", message: "No products could be normalized." },
    ];
    const allStages = [...stages, skippedStage("SCORING"), skippedStage("SHORTLIST")];

    return buildBaseResult(request, discoveryRun, [], [], emptyShortlist(request), allStages, finalFailures, warnings);
  }

  private buildFailedAfterScoring(
    request: ValidatedPipelineRequest,
    discoveryRun: WinningHunterDiscoveryRunResult,
    normalizedProducts: readonly NormalizedWinningProduct[],
    stages: readonly WinningHunterDiscoveryPipelineStageSummary[],
    failures: readonly WinningHunterDiscoveryPipelineFailure[],
    warnings: readonly string[],
  ): WinningHunterDiscoveryPipelineResult {
    const finalFailures = [
      ...failures,
      { stage: "SCORING" as const, code: "SCORING_EMPTY", message: "No products could be scored." },
    ];
    const allStages = [...stages, skippedStage("SHORTLIST")];

    return buildBaseResult(
      request,
      discoveryRun,
      normalizedProducts,
      [],
      emptyShortlist(request),
      allStages,
      finalFailures,
      warnings,
    );
  }
}

export function createInMemoryWinningHunterDiscoveryPipeline(
  options: InMemoryWinningHunterClientOptions = {},
): WinningHunterDiscoveryPipelineService {
  return createWinningHunterDiscoveryPipeline(
    new InMemoryWinningHunterProductDiscoveryClient(options),
  );
}

export function createWinningHunterDiscoveryPipeline(
  client: WinningHunterProductDiscoveryClient,
): WinningHunterDiscoveryPipelineService {
  return new WinningHunterDiscoveryPipelineService({
    discoveryEngine: new WinningHunterDiscoveryQueryEngine(client),
  });
}

const CAPABILITIES: WinningHunterDiscoveryCapabilitySummary = Object.freeze({
  discovery: true,
  normalization: true,
  scoring: true,
  shortlist: true,
  supplierMatching: false,
  marginValidation: false,
  autoDsImport: false,
  shopifyDraftCreation: false,
  shopifyPublishing: false,
  automatedApproval: false,
});

function buildBaseResult(
  request: ValidatedPipelineRequest,
  discoveryRun: WinningHunterDiscoveryRunResult,
  normalizedProducts: readonly NormalizedWinningProduct[],
  assessments: readonly WinningProductOpportunityAssessment[],
  shortlist: WinningProductShortlistResult,
  stages: readonly WinningHunterDiscoveryPipelineStageSummary[],
  failures: readonly WinningHunterDiscoveryPipelineFailure[],
  warnings: readonly string[],
): WinningHunterDiscoveryPipelineResult {
  const finalWarnings = uniqueSorted(warnings);
  const finalFailures = sortFailures(failures);

  return {
    pipelineId: buildPipelineId(request),
    status: "FAILED",
    strategyId: request.strategy.id,
    discoveryRun,
    normalizedProducts,
    opportunityAssessments: assessments,
    shortlist,
    stages,
    failures: finalFailures,
    warnings: finalWarnings,
    health: buildHealth("FAILED", stages, finalFailures, finalWarnings, request.shortlistTimestamp),
    capabilities: CAPABILITIES,
    discoveredCandidates: discoveryRun.uniqueCandidates,
    normalizedProductsCount: normalizedProducts.length,
    assessmentsCount: assessments.length,
    shortlistEntriesCount: shortlist.entries.length,
    actionableEntriesCount: shortlist.actionableEntries,
    startedAt: request.normalizationTimestamp,
    completedAt: request.shortlistTimestamp,
    scoringVersion: request.scoringConfig.version,
    shortlistVersion: request.shortlistConfig.version,
  };
}

function validatePipelineTimestamp(value: string, field: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new WinningHunterInvalidPipelineTimestampError(`${field} must be a valid timestamp`);
  }

  return new Date(Date.parse(value)).toISOString();
}

function buildPipelineId(request: ValidatedPipelineRequest): string {
  return `winninghunter-pipeline:${createStableHash([
    request.strategy.id,
    request.normalizationTimestamp,
    request.scoringTimestamp,
    request.shortlistTimestamp,
    request.scoringConfig.version,
    request.shortlistConfig.version,
  ].join("|"))}`;
}

function pairProductsAndAssessments(
  products: readonly NormalizedWinningProduct[],
  assessments: readonly WinningProductOpportunityAssessment[],
): PipelinePairingResult {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const assessmentByProductId = new Map<string, WinningProductOpportunityAssessment>();
  const warnings: string[] = [];

  for (const assessment of assessments) {
    const existing = assessmentByProductId.get(assessment.productId);

    if (existing === undefined) {
      assessmentByProductId.set(assessment.productId, assessment);
      continue;
    }

    assessmentByProductId.set(assessment.productId, preferAssessment(existing, assessment));
    warnings.push(`[SCORING] Duplicate assessment resolved for product ${assessment.productId}.`);
  }

  const inputs: WinningProductShortlistInput[] = [];

  for (const product of products) {
    const assessment = assessmentByProductId.get(product.id);

    if (assessment === undefined) {
      warnings.push(`[SCORING] No opportunity assessment matched normalized product ${product.id}.`);
      continue;
    }

    inputs.push({ product: cloneProduct(product), assessment: cloneAssessment(assessment) });
  }

  for (const assessment of assessmentByProductId.values()) {
    if (!productsById.has(assessment.productId)) {
      warnings.push(`[SCORING] Ignored unmatched assessment for product ${assessment.productId}.`);
    }
  }

  return {
    inputs: inputs.sort((left, right) => left.product.id.localeCompare(right.product.id)),
    failures: [],
    warnings: uniqueSorted(warnings),
  };
}

function preferAssessment(
  left: WinningProductOpportunityAssessment,
  right: WinningProductOpportunityAssessment,
): WinningProductOpportunityAssessment {
  if (left.overallScore !== right.overallScore) {
    return left.overallScore > right.overallScore ? left : right;
  }

  const leftTime = Date.parse(left.evaluatedAt);
  const rightTime = Date.parse(right.evaluatedAt);

  if (leftTime !== rightTime) {
    return leftTime > rightTime ? left : right;
  }

  return left.scoringVersion.localeCompare(right.scoringVersion) >= 0 ? left : right;
}

function resolvePipelineStatus(
  actionableEntries: number,
  failureCount: number,
  warningCount: number,
  shortlistStatus: WinningProductShortlistResult["status"],
): WinningHunterDiscoveryPipelineStatus {
  if (actionableEntries === 0 || shortlistStatus === "FAILED") {
    return "FAILED";
  }

  return failureCount > 0 || warningCount > 0 || shortlistStatus === "COMPLETED_WITH_WARNINGS"
    ? "COMPLETED_WITH_WARNINGS"
    : "COMPLETED";
}

function resolveDiscoveryStageStatus(
  run: WinningHunterDiscoveryRunResult,
): WinningHunterDiscoveryPipelineStageStatus {
  if (run.status === "FAILED" || run.candidates.length === 0) {
    return "FAILED";
  }

  return run.status;
}

function resolveStageStatus(
  outputCount: number,
  failureCount: number,
  warningCount: number,
): WinningHunterDiscoveryPipelineStageStatus {
  if (outputCount === 0) {
    return "FAILED";
  }

  return failureCount > 0 || warningCount > 0 ? "COMPLETED_WITH_WARNINGS" : "COMPLETED";
}

function resolveShortlistStageStatus(
  shortlist: WinningProductShortlistResult,
): WinningHunterDiscoveryPipelineStageStatus {
  return shortlist.status;
}

function buildStageSummary(
  stage: WinningHunterDiscoveryPipelineStage,
  status: WinningHunterDiscoveryPipelineStageStatus,
  inputCount: number,
  outputCount: number,
  failureCount: number,
  warningCount: number,
  messages: readonly string[],
): WinningHunterDiscoveryPipelineStageSummary {
  return {
    stage,
    status,
    inputCount,
    outputCount,
    failureCount,
    warningCount,
    messages: uniqueSorted(messages),
  };
}

function skippedStage(stage: WinningHunterDiscoveryPipelineStage): WinningHunterDiscoveryPipelineStageSummary {
  return buildStageSummary(stage, "SKIPPED", 0, 0, 0, 0, [`[${stage}] Stage skipped.`]);
}

function buildHealth(
  status: WinningHunterDiscoveryPipelineStatus,
  stages: readonly WinningHunterDiscoveryPipelineStageSummary[],
  failures: readonly WinningHunterDiscoveryPipelineFailure[],
  warnings: readonly string[],
  checkedAt: string,
): WinningHunterDiscoveryPipelineHealthSummary {
  const discoveryAvailable = !stages.some((stage) => stage.stage === "DISCOVERY" && stage.status === "FAILED");
  const normalizationOperational = !stages.some((stage) => stage.stage === "NORMALIZATION" && stage.status === "FAILED");
  const scoringOperational = !stages.some((stage) => stage.stage === "SCORING" && stage.status === "FAILED");
  const shortlistOperational = !stages.some((stage) => stage.stage === "SHORTLIST" && stage.status === "FAILED");

  return {
    health: status === "COMPLETED"
      ? "HEALTHY"
      : status === "COMPLETED_WITH_WARNINGS"
        ? "DEGRADED"
        : "UNHEALTHY",
    discoveryAvailable,
    normalizationOperational,
    scoringOperational,
    shortlistOperational,
    totalWarnings: warnings.length,
    totalFailures: failures.length,
    checkedAt,
    messages: uniqueSorted([
      ...warnings,
      ...failures.map((failure) => `[${failure.stage}] ${failure.message}`),
    ]),
  };
}

function createEmptyDiscoveryRun(
  strategyId: string,
  timestamp: string,
  status: WinningHunterDiscoveryRunResult["status"],
): WinningHunterDiscoveryRunResult {
  return {
    strategyId,
    status,
    candidates: [],
    executionUnitsPlanned: 0,
    executionUnitsCompleted: 0,
    executionUnitsFailed: status === "FAILED" ? 1 : 0,
    pagesFetched: 0,
    sourceRowsReceived: 0,
    uniqueCandidates: 0,
    warnings: [],
    startedAt: timestamp,
    completedAt: timestamp,
  };
}

function emptyShortlist(request: ValidatedPipelineRequest): WinningProductShortlistResult {
  return {
    shortlistId: `winninghunter-shortlist:${createStableHash(`empty|${request.shortlistTimestamp}|${request.shortlistConfig.version}`)}`,
    status: "FAILED",
    entries: [],
    priorityReview: [],
    standardReview: [],
    watchlist: [],
    excluded: [],
    inputAssessments: 0,
    includedEntries: 0,
    actionableEntries: 0,
    excludedEntries: 0,
    failures: [],
    warnings: ["Shortlist stage was skipped or produced no valid entries."],
    scoringVersion: request.scoringConfig.version,
    shortlistVersion: request.shortlistConfig.version,
    generatedAt: request.shortlistTimestamp,
  };
}

function discoveryWarningsToMessages(
  warnings: readonly WinningHunterDiscoveryRunWarning[],
): readonly string[] {
  return warnings.map((warning) =>
    `[DISCOVERY] ${warning.executionUnitId}: ${warning.message}`,
  );
}

function toFailure(
  stage: WinningHunterDiscoveryPipelineStage,
  productId: string | undefined,
  error: unknown,
): WinningHunterDiscoveryPipelineFailure {
  const code = error instanceof Error ? error.name : "WinningHunterPipelineUnknownFailure";
  const message = error instanceof Error ? error.message : "WinningHunter pipeline stage failed";

  return {
    stage,
    ...(productId === undefined || productId.trim().length === 0 ? {} : { productId }),
    code,
    message,
  };
}

function toScoringFailure(
  failure: WinningProductOpportunityBatchFailure,
): WinningHunterDiscoveryPipelineFailure {
  return {
    stage: "SCORING",
    ...(failure.productId === undefined ? {} : { productId: failure.productId }),
    code: failure.code,
    message: failure.message,
  };
}

function toShortlistFailure(
  failure: WinningProductShortlistFailure,
): WinningHunterDiscoveryPipelineFailure {
  return {
    stage: "SHORTLIST",
    ...(failure.productId === undefined ? {} : { productId: failure.productId }),
    code: failure.code,
    message: failure.message,
  };
}

function sortFailures(
  failures: readonly WinningHunterDiscoveryPipelineFailure[],
): readonly WinningHunterDiscoveryPipelineFailure[] {
  return [...failures].sort((left, right) => (
    STAGE_ORDER.indexOf(left.stage) - STAGE_ORDER.indexOf(right.stage) ||
    (left.productId ?? "").localeCompare(right.productId ?? "") ||
    left.code.localeCompare(right.code)
  ));
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function cloneScoringConfig(
  config: WinningProductOpportunityScoringConfig,
): WinningProductOpportunityScoringConfig {
  return {
    version: config.version,
    weights: { ...config.weights },
    thresholds: { ...config.thresholds },
  };
}

function cloneShortlistConfig(config: WinningProductShortlistConfig): WinningProductShortlistConfig {
  return {
    version: config.version,
    limits: { ...config.limits },
    ...(config.minimumScores === undefined ? {} : { minimumScores: { ...config.minimumScores } }),
    includeExcluded: config.includeExcluded,
  };
}

function cloneDiscoveryRun(run: WinningHunterDiscoveryRunResult): WinningHunterDiscoveryRunResult {
  return {
    ...run,
    candidates: run.candidates.map((candidate) => ({
      candidate: {
        ...candidate.candidate,
        adSignals: candidate.candidate.adSignals.map((signal) => ({
          ...signal,
          countries: [...signal.countries],
          rankHistory: { ...signal.rankHistory },
        })),
      },
      contexts: candidate.contexts.map((context) => ({ ...context })),
    })),
    warnings: run.warnings.map((warning) => ({ ...warning })),
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

function cloneShortlist(shortlist: WinningProductShortlistResult): WinningProductShortlistResult {
  const entries = shortlist.entries.map((entry) => cloneEntry(entry));

  return {
    ...shortlist,
    entries,
    priorityReview: entries.filter((entry) => entry.bucket === "PRIORITY_REVIEW"),
    standardReview: entries.filter((entry) => entry.bucket === "STANDARD_REVIEW"),
    watchlist: entries.filter((entry) => entry.bucket === "WATCHLIST"),
    excluded: entries.filter((entry) => entry.bucket === "EXCLUDED"),
    failures: shortlist.failures.map((failure) => ({ ...failure })),
    warnings: [...shortlist.warnings],
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

function clonePipelineResult(
  result: WinningHunterDiscoveryPipelineResult,
): WinningHunterDiscoveryPipelineResult {
  return {
    ...result,
    discoveryRun: cloneDiscoveryRun(result.discoveryRun),
    normalizedProducts: result.normalizedProducts.map((product) => cloneProduct(product)),
    opportunityAssessments: result.opportunityAssessments.map((assessment) => cloneAssessment(assessment)),
    shortlist: cloneShortlist(result.shortlist),
    stages: result.stages.map((stage) => ({
      ...stage,
      messages: [...stage.messages],
    })),
    failures: result.failures.map((failure) => ({ ...failure })),
    warnings: [...result.warnings],
    health: {
      ...result.health,
      messages: [...result.health.messages],
    },
    capabilities: { ...result.capabilities },
  };
}
