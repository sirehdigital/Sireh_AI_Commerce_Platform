import type { WinningHunterDiscoveryQuery } from "./winninghunter-discovery-query.model.js";
import type { WinningHunterProductCandidate } from "./winninghunter-product-candidate.model.js";

export type WinningHunterTargetMarket = "US" | "GB" | "CA" | "AU";

export type WinningHunterDiscoveryPreset =
  | "BEAUTY_CORE"
  | "SKINCARE_CORE"
  | "HAIRCARE_CORE"
  | "PROBLEM_SOLVING"
  | "EMERGING_PRODUCTS"
  | "PROVEN_WINNERS";

export type WinningHunterMediaType = "videos" | "images" | "carousel" | "dco";

export interface WinningHunterProductDiscoveryStrategy {
  readonly id: string;
  readonly name: string;
  readonly preset: WinningHunterDiscoveryPreset;
  readonly targetMarkets: readonly WinningHunterTargetMarket[];
  readonly niches: readonly string[];
  readonly language: "en";
  readonly technology: "SH";
  readonly minimumPrice?: number;
  readonly maximumPrice?: number;
  readonly minimumDaysRunning?: number;
  readonly maximumDaysRunning?: number;
  readonly minimumActiveAds?: number;
  readonly maximumActiveAds?: number;
  readonly minimumActiveAdsGrowth?: number;
  readonly activeAdsGrowthPeriod?: "1w" | "1m" | "3m";
  readonly mediaTypes?: readonly WinningHunterMediaType[];
  readonly sorting: {
    readonly field: string;
    readonly direction: "asc" | "desc";
  };
  readonly maximumPages: number;
  readonly maximumCandidates: number;
}

export interface WinningHunterDiscoveryExecutionUnit {
  readonly id: string;
  readonly market: WinningHunterTargetMarket;
  readonly niche: string;
  readonly query: WinningHunterDiscoveryQuery;
}

export interface WinningHunterDiscoveryExecutionPlan {
  readonly strategyId: string;
  readonly units: readonly WinningHunterDiscoveryExecutionUnit[];
  readonly maximumPagesPerUnit: number;
  readonly maximumCandidates: number;
}

export interface WinningHunterCandidateDiscoveryContext {
  readonly market: WinningHunterTargetMarket;
  readonly niche: string;
  readonly executionUnitId: string;
  readonly discoveredPage: number;
}

export interface WinningHunterDiscoveredCandidate {
  readonly candidate: WinningHunterProductCandidate;
  readonly contexts: readonly WinningHunterCandidateDiscoveryContext[];
}

export type WinningHunterDiscoveryRunStatus =
  | "COMPLETED"
  | "COMPLETED_WITH_WARNINGS"
  | "FAILED";

export interface WinningHunterDiscoveryRunWarning {
  readonly executionUnitId: string;
  readonly code: string;
  readonly message: string;
}

export interface WinningHunterDiscoveryRunResult {
  readonly strategyId: string;
  readonly status: WinningHunterDiscoveryRunStatus;
  readonly candidates: readonly WinningHunterDiscoveredCandidate[];
  readonly executionUnitsPlanned: number;
  readonly executionUnitsCompleted: number;
  readonly executionUnitsFailed: number;
  readonly pagesFetched: number;
  readonly sourceRowsReceived: number;
  readonly uniqueCandidates: number;
  readonly warnings: readonly WinningHunterDiscoveryRunWarning[];
  readonly startedAt: string;
  readonly completedAt: string;
}
