import type { WinningProductEvidenceLevel } from "./normalized-winning-product.model.js";

export type WinningProductOpportunityRecommendation =
  | "STRONG_CANDIDATE"
  | "REVIEW"
  | "WATCHLIST"
  | "REJECT";

export type WinningProductRiskSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface WinningProductScoreComponent {
  readonly key: string;
  readonly label: string;
  readonly rawValue?: number | string;
  readonly score: number;
  readonly maximumScore: number;
  readonly reasons: readonly string[];
}

export interface WinningProductScoreAdjustment {
  readonly code: string;
  readonly points: number;
  readonly reason: string;
}

export interface WinningProductOpportunityRisk {
  readonly code: string;
  readonly severity: WinningProductRiskSeverity;
  readonly message: string;
}

export interface WinningProductOpportunityAssessment {
  readonly productId: string;
  readonly overallScore: number;
  readonly maximumScore: 100;
  readonly recommendation: WinningProductOpportunityRecommendation;
  readonly components: readonly WinningProductScoreComponent[];
  readonly adjustments: readonly WinningProductScoreAdjustment[];
  readonly strengths: readonly string[];
  readonly risks: readonly WinningProductOpportunityRisk[];
  readonly warnings: readonly string[];
  readonly evidenceLevel: WinningProductEvidenceLevel;
  readonly evaluatedAt: string;
  readonly scoringVersion: string;
}

export interface WinningProductOpportunityScoringConfig {
  readonly version: string;
  readonly weights: {
    readonly advertisingDemand: number;
    readonly marketBreadth: number;
    readonly longevity: number;
    readonly momentum: number;
    readonly advertiserScaling: number;
    readonly creativeValidation: number;
    readonly evidenceQuality: number;
  };
  readonly thresholds: {
    readonly strongCandidate: number;
    readonly review: number;
    readonly watchlist: number;
  };
}

export interface WinningProductOpportunityBatchFailure {
  readonly productId?: string;
  readonly code: string;
  readonly message: string;
}

export interface WinningProductOpportunityBatchResult {
  readonly assessments: readonly WinningProductOpportunityAssessment[];
  readonly failures: readonly WinningProductOpportunityBatchFailure[];
  readonly evaluatedAt: string;
  readonly scoringVersion: string;
}
