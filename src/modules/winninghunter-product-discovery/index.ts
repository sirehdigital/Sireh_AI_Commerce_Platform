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
  WinningHunterAdSignal,
  WinningHunterDiscoveryPage,
  WinningHunterDiscoveryProvider,
  WinningHunterDiscoverySource,
  WinningHunterHealthStatus,
  WinningHunterProductCandidate,
} from "./domain/models/winninghunter-product-candidate.model.js";
export {
  WinningHunterClientUnavailableError,
  WinningHunterInvalidDiscoveryQueryError,
  WinningHunterInvalidProductIdentityError,
  WinningHunterMalformedExternalResponseError,
  WinningHunterRateLimitedError,
  WinningHunterRequestTimeoutError,
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
