export type {
  WinningHunterDiscoveryQuery,
} from "./domain/models/winninghunter-discovery-query.model.js";
export type {
  WinningHunterCandidateDiscoveryContext,
  WinningHunterDiscoveredCandidate,
  WinningHunterDiscoveryExecutionPlan,
  WinningHunterDiscoveryExecutionUnit,
  WinningHunterDiscoveryPreset,
  WinningHunterDiscoveryRunResult,
  WinningHunterDiscoveryRunStatus,
  WinningHunterDiscoveryRunWarning,
  WinningHunterMediaType,
  WinningHunterProductDiscoveryStrategy,
  WinningHunterTargetMarket,
} from "./domain/models/winninghunter-discovery-strategy.model.js";
export type {
  NormalizedWinningProduct,
  NormalizedWinningProductBatchResult,
  WinningProductAdvertisingSummary,
  WinningProductCreativeSignal,
  WinningProductEvidenceLevel,
  WinningProductMarketSignal,
  WinningProductMomentum,
  WinningProductRecency,
} from "./domain/models/normalized-winning-product.model.js";
export type {
  WinningProductOpportunityAssessment,
  WinningProductOpportunityBatchFailure,
  WinningProductOpportunityBatchResult,
  WinningProductOpportunityRecommendation,
  WinningProductOpportunityRisk,
  WinningProductOpportunityScoringConfig,
  WinningProductRiskSeverity,
  WinningProductScoreAdjustment,
  WinningProductScoreComponent,
} from "./domain/models/winning-product-opportunity-assessment.model.js";
export type {
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
} from "./domain/models/winning-product-shortlist.model.js";
export type {
  WinningHunterDiscoveryCapabilitySummary,
  WinningHunterDiscoveryPipelineFailure,
  WinningHunterDiscoveryPipelineHealthSummary,
  WinningHunterDiscoveryPipelineRequest,
  WinningHunterDiscoveryPipelineResult,
  WinningHunterDiscoveryPipelineStage,
  WinningHunterDiscoveryPipelineStageStatus,
  WinningHunterDiscoveryPipelineStageSummary,
  WinningHunterDiscoveryPipelineStatus,
  WinningHunterPipelineHealth,
} from "./domain/models/winninghunter-discovery-pipeline.model.js";
export type {
  WinningHunterAdSignal,
  WinningHunterDiscoveryPage,
  WinningHunterDiscoveryProvider,
  WinningHunterDiscoverySource,
  WinningHunterHealthStatus,
  WinningHunterProductCandidate,
} from "./domain/models/winninghunter-product-candidate.model.js";
export {
  WinningHunterClientUnavailableError,
  WinningHunterConflictingPipelineStrategyError,
  WinningHunterInvalidDiscoveryQueryError,
  WinningHunterInvalidNormalizationInputError,
  WinningHunterInvalidPipelineRequestError,
  WinningHunterInvalidPipelineTimestampError,
  WinningHunterInvalidNormalizationTimestampError,
  WinningHunterInvalidProductIdentityError,
  WinningHunterInvalidScoringConfigurationError,
  WinningHunterInvalidScoringInputError,
  WinningHunterInvalidScoringTimestampError,
  WinningHunterInvalidScoringWeightTotalError,
  WinningHunterInvalidShortlistConfigurationError,
  WinningHunterInvalidShortlistInputError,
  WinningHunterInvalidShortlistTimestampError,
  WinningHunterMalformedCandidateEvidenceError,
  WinningHunterMalformedExternalResponseError,
  WinningHunterMalformedNormalizedProductError,
  WinningHunterMalformedOpportunityAssessmentError,
  WinningHunterMalformedPipelineResultError,
  WinningHunterMissingPipelineStrategyError,
  WinningHunterMissingCanonicalIdentityError,
  WinningHunterMissingScoringProductIdentityError,
  WinningHunterPipelineCompositionFailureError,
  WinningHunterProductAssessmentMismatchError,
  WinningHunterRateLimitedError,
  WinningHunterRequestTimeoutError,
  WinningHunterUnrecoverablePipelineStageError,
  WinningHunterUnusableDiscoveryContextError,
  WinningHunterUnsupportedScoringVersionError,
  WinningHunterUnsupportedShortlistVersionError,
  WinningHunterUnsupportedUrlError,
} from "./domain/errors/winninghunter-product-discovery.errors.js";
export {
  createStableHash,
  normalizeWinningHunterUrl,
} from "./domain/value-objects/winninghunter-url-normalizer.js";
export type {
  WinningHunterProductDiscoveryClient,
} from "./application/ports/winninghunter-product-discovery-client.js";
export {
  groupWinningHunterCandidates,
  validateWinningHunterDiscoveryQuery,
  WinningHunterProductDiscoveryService,
} from "./application/services/winninghunter-product-discovery.service.js";
export {
  buildQueryForUnit,
  WinningHunterDiscoveryQueryEngine,
} from "./application/services/winninghunter-discovery-query-engine.js";
export {
  WinningHunterProductNormalizer,
} from "./application/normalizers/winninghunter-product.normalizer.js";
export {
  DEFAULT_WINNING_PRODUCT_OPPORTUNITY_SCORING_CONFIG,
  validateScoringConfig,
  WinningHunterProductOpportunityScorer,
} from "./application/scoring/winninghunter-product-opportunity.scorer.js";
export {
  DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG,
  validateShortlistConfig,
  WinningHunterProductShortlistService,
} from "./application/shortlist/winninghunter-product-shortlist.service.js";
export {
  createInMemoryWinningHunterDiscoveryPipeline,
  createWinningHunterDiscoveryPipeline,
  WinningHunterDiscoveryPipelineService,
} from "./application/orchestration/winninghunter-discovery-pipeline.service.js";
export {
  cloneWinningHunterStrategy,
  validateWinningHunterStrategy,
  WinningHunterDiscoveryStrategyRegistry,
} from "./application/strategies/winninghunter-discovery-strategy.registry.js";
export {
  buildProductIdentity,
  extractWinningHunterCurrency,
  parseWinningHunterNumber,
  WinningHunterProductCandidateMapper,
} from "./infrastructure/mappers/winninghunter-product-candidate.mapper.js";
export {
  InMemoryWinningHunterProductDiscoveryClient,
} from "./infrastructure/clients/in-memory-winninghunter-product-discovery.client.js";
export type {
  InMemoryWinningHunterClientOptions,
  InMemoryWinningHunterClientRoute,
} from "./infrastructure/clients/in-memory-winninghunter-product-discovery.client.js";
