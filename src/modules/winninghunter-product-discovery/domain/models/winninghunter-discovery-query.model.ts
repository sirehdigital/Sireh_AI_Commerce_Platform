export interface WinningHunterDiscoveryQuery {
  readonly countries?: readonly string[];
  readonly niches?: readonly string[];
  readonly language?: string;
  readonly technology?: string;
  readonly keyword?: string;
  readonly keywordField?: string;
  readonly mediaType?: string;
  readonly scaling?: string;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly minActiveAds?: number;
  readonly maxActiveAds?: number;
  readonly minDaysRunning?: number;
  readonly maxDaysRunning?: number;
  readonly minActiveAdsGrowth?: number;
  readonly activeAdsGrowthPeriod?: "1w" | "1m" | "3m";
  readonly sortBy?: string;
  readonly sortOrder?: "asc" | "desc";
  readonly scroll?: string;
}
