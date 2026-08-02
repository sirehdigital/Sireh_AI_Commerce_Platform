export type {
  WinningHunterDiscoveryQuery,
} from "./domain/models/winninghunter-discovery-query.model.js";
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
  buildProductIdentity,
  extractWinningHunterCurrency,
  parseWinningHunterNumber,
  WinningHunterProductCandidateMapper,
} from "./infrastructure/mappers/winninghunter-product-candidate.mapper.js";
export {
  InMemoryWinningHunterProductDiscoveryClient,
} from "./infrastructure/clients/in-memory-winninghunter-product-discovery.client.js";
