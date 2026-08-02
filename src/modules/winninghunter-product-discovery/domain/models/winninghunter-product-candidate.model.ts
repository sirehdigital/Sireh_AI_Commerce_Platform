export type WinningHunterDiscoveryProvider = "WINNING_HUNTER";

export type WinningHunterDiscoverySource = "META_ADS" | "TIKTOK_SHOP";

export interface WinningHunterAdSignal {
  readonly externalAdId: string;
  readonly pageId?: string;
  readonly pageName?: string;
  readonly countries: readonly string[];
  readonly startedAt?: string;
  readonly lastSeenAt?: string;
  readonly updatedAt?: string;
  readonly mediaType?: string;
  readonly caption?: string;
  readonly adCopy?: string;
  readonly activeSeenCount?: number;
  readonly adRank?: number;
  readonly rankHistory: Readonly<Record<string, number>>;
  readonly euAdSpend?: number;
  readonly euViews?: number;
}

export interface WinningHunterProductCandidate {
  readonly id: string;
  readonly source: WinningHunterDiscoveryProvider;
  readonly discoverySource: WinningHunterDiscoverySource;
  readonly externalProductId?: string;
  readonly shopifyProductId?: string;
  readonly title?: string;
  readonly description?: string;
  readonly productUrl: string;
  readonly canonicalProductUrl: string;
  readonly storeUrl?: string;
  readonly storeDomain?: string;
  readonly productHandle?: string;
  readonly price?: number;
  readonly currency?: string;
  readonly totalActiveAdsOnPage?: number;
  readonly activeAdsGrowthOneWeek?: number;
  readonly activeAdsGrowthOneMonth?: number;
  readonly adSignals: readonly WinningHunterAdSignal[];
  readonly discoveredAt: string;
  readonly lastObservedAt?: string;
}

export interface WinningHunterDiscoveryPage {
  readonly candidates: readonly WinningHunterProductCandidate[];
  readonly nextScroll?: string;
  readonly hasMore: boolean;
  readonly sourceResultCount: number;
}

export interface WinningHunterHealthStatus {
  readonly status: "AVAILABLE" | "DEGRADED" | "UNAVAILABLE";
  readonly checkedAt: string;
  readonly message?: string;
}
