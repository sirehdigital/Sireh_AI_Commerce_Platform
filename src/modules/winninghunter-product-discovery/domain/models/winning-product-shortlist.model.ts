import type {
  NormalizedWinningProduct,
  WinningProductEvidenceLevel,
  WinningProductMomentum,
  WinningProductRecency,
} from "./normalized-winning-product.model.js";
import type {
  WinningProductOpportunityAssessment,
  WinningProductOpportunityRecommendation,
  WinningProductOpportunityRisk,
} from "./winning-product-opportunity-assessment.model.js";

export type WinningProductShortlistBucket =
  | "PRIORITY_REVIEW"
  | "STANDARD_REVIEW"
  | "WATCHLIST"
  | "EXCLUDED";

export type WinningProductMerchantDecision =
  | "PENDING_REVIEW"
  | "APPROVED_FOR_VALIDATION"
  | "HOLD"
  | "REJECTED";

export type WinningProductShortlistActionCode =
  | "MERCHANT_REVIEW"
  | "SUPPLIER_MATCHING"
  | "LANDED_COST_VALIDATION"
  | "MARGIN_VALIDATION"
  | "SHIPPING_VALIDATION"
  | "PRODUCT_SAFETY_REVIEW"
  | "TRADEMARK_REVIEW"
  | "PLATFORM_POLICY_REVIEW"
  | "CREATIVE_REVIEW"
  | "EVIDENCE_MONITORING";

export type WinningProductShortlistActionPriority = "HIGH" | "MEDIUM" | "LOW";

export type WinningProductShortlistStatus =
  | "COMPLETED"
  | "COMPLETED_WITH_WARNINGS"
  | "FAILED";

export interface WinningProductShortlistAction {
  readonly code: WinningProductShortlistActionCode;
  readonly priority: WinningProductShortlistActionPriority;
  readonly reason: string;
  readonly completed: boolean;
}

export interface WinningProductShortlistEntry {
  readonly id: string;
  readonly productId: string;
  readonly bucket: WinningProductShortlistBucket;
  readonly merchantDecision: WinningProductMerchantDecision;
  readonly rank: number;
  readonly overallScore: number;
  readonly recommendation: WinningProductOpportunityRecommendation;
  readonly productTitle?: string;
  readonly canonicalProductUrl: string;
  readonly storeDomain?: string;
  readonly productHandle?: string;
  readonly price?: number;
  readonly currency?: string;
  readonly markets: readonly string[];
  readonly niches: readonly string[];
  readonly evidenceLevel: WinningProductEvidenceLevel;
  readonly momentum: WinningProductMomentum;
  readonly recency: WinningProductRecency;
  readonly strengths: readonly string[];
  readonly risks: readonly WinningProductOpportunityRisk[];
  readonly warnings: readonly string[];
  readonly nextRequiredActions: readonly WinningProductShortlistAction[];
  readonly assessmentVersion: string;
  readonly shortlistedAt: string;
}

export interface WinningProductShortlistConfig {
  readonly version: string;
  readonly limits: {
    readonly priorityReview: number;
    readonly standardReview: number;
    readonly watchlist: number;
    readonly excluded: number;
    readonly total: number;
  };
  readonly minimumScores?: {
    readonly priorityReview?: number;
    readonly standardReview?: number;
    readonly watchlist?: number;
  };
  readonly includeExcluded: boolean;
}

export interface WinningProductShortlistInput {
  readonly product: NormalizedWinningProduct;
  readonly assessment: WinningProductOpportunityAssessment;
}

export interface WinningProductShortlistFailure {
  readonly productId?: string;
  readonly code: string;
  readonly message: string;
}

export interface WinningProductShortlistResult {
  readonly shortlistId: string;
  readonly status: WinningProductShortlistStatus;
  readonly entries: readonly WinningProductShortlistEntry[];
  readonly priorityReview: readonly WinningProductShortlistEntry[];
  readonly standardReview: readonly WinningProductShortlistEntry[];
  readonly watchlist: readonly WinningProductShortlistEntry[];
  readonly excluded: readonly WinningProductShortlistEntry[];
  readonly inputAssessments: number;
  readonly includedEntries: number;
  readonly actionableEntries: number;
  readonly excludedEntries: number;
  readonly failures: readonly WinningProductShortlistFailure[];
  readonly warnings: readonly string[];
  readonly scoringVersion: string;
  readonly shortlistVersion: string;
  readonly generatedAt: string;
}
