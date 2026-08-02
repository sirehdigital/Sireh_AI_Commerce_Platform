export type WinningProductEvidenceLevel =
  | "STRONG"
  | "MODERATE"
  | "LIMITED"
  | "INSUFFICIENT";

export type WinningProductMomentum =
  | "RISING"
  | "STABLE"
  | "DECLINING"
  | "MIXED"
  | "UNKNOWN";

export type WinningProductRecency =
  | "CURRENT"
  | "RECENT"
  | "AGING"
  | "STALE"
  | "UNKNOWN";

export interface WinningProductMarketSignal {
  readonly market: string;
  readonly niches: readonly string[];
  readonly discoveryContexts: number;
  readonly adSignals: number;
  readonly latestObservedAt?: string;
}

export interface WinningProductCreativeSignal {
  readonly mediaType: string;
  readonly adCount: number;
  readonly percentageOfAds: number;
}

export interface WinningProductAdvertisingSummary {
  readonly uniqueAds: number;
  readonly uniquePages: number;
  readonly activeSeenTotal: number;
  readonly earliestAdStartedAt?: string;
  readonly latestAdStartedAt?: string;
  readonly latestObservedAt?: string;
  readonly longestObservedRunningDays?: number;
  readonly averageObservedRunningDays?: number;
  readonly minimumAdRank?: number;
  readonly maximumAdRank?: number;
  readonly averageAdRank?: number;
  readonly totalEuAdSpendObserved?: number;
  readonly totalEuViewsObserved?: number;
  readonly highestPageActiveAds?: number;
  readonly highestActiveAdsGrowthOneWeek?: number;
  readonly highestActiveAdsGrowthOneMonth?: number;
  readonly momentum: WinningProductMomentum;
}

export interface NormalizedWinningProduct {
  readonly id: string;
  readonly source: "WINNING_HUNTER";
  readonly externalProductId?: string;
  readonly shopifyProductId?: string;
  readonly title?: string;
  readonly description?: string;
  readonly canonicalProductUrl: string;
  readonly storeDomain?: string;
  readonly productHandle?: string;
  readonly price?: number;
  readonly currency?: string;
  readonly markets: readonly string[];
  readonly niches: readonly string[];
  readonly marketSignals: readonly WinningProductMarketSignal[];
  readonly creativeSignals: readonly WinningProductCreativeSignal[];
  readonly advertisingSummary: WinningProductAdvertisingSummary;
  readonly evidenceLevel: WinningProductEvidenceLevel;
  readonly evidenceReasons: readonly string[];
  readonly evidenceWarnings: readonly string[];
  readonly recency: WinningProductRecency;
  readonly firstDiscoveredAt: string;
  readonly lastObservedAt?: string;
  readonly normalizedAt: string;
}

export interface NormalizedWinningProductBatchResult {
  readonly products: readonly NormalizedWinningProduct[];
  readonly warnings: readonly string[];
}
