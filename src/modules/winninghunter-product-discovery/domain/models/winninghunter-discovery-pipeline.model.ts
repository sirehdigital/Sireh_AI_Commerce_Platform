import type {
  NormalizedWinningProduct,
} from "./normalized-winning-product.model.js";
import type {
  WinningProductOpportunityAssessment,
  WinningProductOpportunityScoringConfig,
} from "./winning-product-opportunity-assessment.model.js";
import type {
  WinningProductShortlistConfig,
  WinningProductShortlistResult,
} from "./winning-product-shortlist.model.js";
import type {
  WinningHunterDiscoveryPreset,
  WinningHunterDiscoveryRunResult,
  WinningHunterProductDiscoveryStrategy,
} from "./winninghunter-discovery-strategy.model.js";

export interface WinningHunterDiscoveryPipelineRequest {
  readonly strategyPreset?: WinningHunterDiscoveryPreset;
  readonly customStrategy?: WinningHunterProductDiscoveryStrategy;
  readonly normalizationTimestamp: string;
  readonly scoringTimestamp: string;
  readonly shortlistTimestamp: string;
  readonly scoringConfig?: WinningProductOpportunityScoringConfig;
  readonly shortlistConfig?: WinningProductShortlistConfig;
}

export type WinningHunterDiscoveryPipelineStage =
  | "DISCOVERY"
  | "NORMALIZATION"
  | "SCORING"
  | "SHORTLIST";

export type WinningHunterDiscoveryPipelineStageStatus =
  | "COMPLETED"
  | "COMPLETED_WITH_WARNINGS"
  | "FAILED"
  | "SKIPPED";

export interface WinningHunterDiscoveryPipelineStageSummary {
  readonly stage: WinningHunterDiscoveryPipelineStage;
  readonly status: WinningHunterDiscoveryPipelineStageStatus;
  readonly inputCount: number;
  readonly outputCount: number;
  readonly failureCount: number;
  readonly warningCount: number;
  readonly durationMs?: number;
  readonly messages: readonly string[];
}

export type WinningHunterDiscoveryPipelineStatus =
  | "COMPLETED"
  | "COMPLETED_WITH_WARNINGS"
  | "FAILED";

export interface WinningHunterDiscoveryPipelineFailure {
  readonly stage: WinningHunterDiscoveryPipelineStage;
  readonly productId?: string;
  readonly code: string;
  readonly message: string;
}

export type WinningHunterPipelineHealth =
  | "HEALTHY"
  | "DEGRADED"
  | "UNHEALTHY";

export interface WinningHunterDiscoveryPipelineHealthSummary {
  readonly health: WinningHunterPipelineHealth;
  readonly discoveryAvailable: boolean;
  readonly normalizationOperational: boolean;
  readonly scoringOperational: boolean;
  readonly shortlistOperational: boolean;
  readonly totalWarnings: number;
  readonly totalFailures: number;
  readonly checkedAt: string;
  readonly messages: readonly string[];
}

export interface WinningHunterDiscoveryCapabilitySummary {
  readonly discovery: true;
  readonly normalization: true;
  readonly scoring: true;
  readonly shortlist: true;
  readonly supplierMatching: false;
  readonly marginValidation: false;
  readonly autoDsImport: false;
  readonly shopifyDraftCreation: false;
  readonly shopifyPublishing: false;
  readonly automatedApproval: false;
}

export interface WinningHunterDiscoveryPipelineResult {
  readonly pipelineId: string;
  readonly status: WinningHunterDiscoveryPipelineStatus;
  readonly strategyId: string;
  readonly discoveryRun: WinningHunterDiscoveryRunResult;
  readonly normalizedProducts: readonly NormalizedWinningProduct[];
  readonly opportunityAssessments: readonly WinningProductOpportunityAssessment[];
  readonly shortlist: WinningProductShortlistResult;
  readonly stages: readonly WinningHunterDiscoveryPipelineStageSummary[];
  readonly failures: readonly WinningHunterDiscoveryPipelineFailure[];
  readonly warnings: readonly string[];
  readonly health: WinningHunterDiscoveryPipelineHealthSummary;
  readonly capabilities: WinningHunterDiscoveryCapabilitySummary;
  readonly discoveredCandidates: number;
  readonly normalizedProductsCount: number;
  readonly assessmentsCount: number;
  readonly shortlistEntriesCount: number;
  readonly actionableEntriesCount: number;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly discoveryVersion?: string;
  readonly scoringVersion: string;
  readonly shortlistVersion: string;
}
