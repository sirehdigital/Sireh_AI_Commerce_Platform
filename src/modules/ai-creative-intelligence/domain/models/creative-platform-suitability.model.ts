import type { CreativeAnalysisDimension, CreativeAnalysisFinding } from "./creative-analysis.model.js";
import type { CreativePlatform } from "./creative-intelligence.model.js";

export const PLATFORM_SUITABILITY_STATUSES = ["SUITABLE", "NEEDS_REVIEW", "NOT_RECOMMENDED"] as const;

export type PlatformSuitabilityStatus = (typeof PLATFORM_SUITABILITY_STATUSES)[number];

export interface PlatformSuitabilityFinding {
  readonly platform: CreativePlatform;
  readonly code: string;
  readonly message: string;
  readonly evidence: readonly CreativeAnalysisFinding[];
}

export interface PlatformSuitabilityAssessment {
  readonly platform: CreativePlatform;
  readonly score: number;
  readonly status: PlatformSuitabilityStatus;
  readonly findings: readonly PlatformSuitabilityFinding[];
}

export type PlatformSuitabilityWeights = Readonly<Record<CreativeAnalysisDimension, number>>;
