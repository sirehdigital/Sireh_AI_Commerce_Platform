import { WinningHunterInvalidDiscoveryQueryError } from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type {
  WinningHunterDiscoveryPreset,
  WinningHunterProductDiscoveryStrategy,
  WinningHunterTargetMarket,
} from "../../domain/models/winninghunter-discovery-strategy.model.js";

const SUPPORTED_MARKETS = new Set<WinningHunterTargetMarket>(["US", "GB", "CA", "AU"]);
const SUPPORTED_NICHES = new Set(["BY", "SK", "HH", "PB", "HT", "MG"]);

const BASE_MARKETS = ["US", "GB", "CA", "AU"] as const;

const BUILT_IN_PRESETS: Readonly<Record<WinningHunterDiscoveryPreset, WinningHunterProductDiscoveryStrategy>> = {
  BEAUTY_CORE: {
    id: "beauty-core",
    name: "Beauty Core",
    preset: "BEAUTY_CORE",
    targetMarkets: BASE_MARKETS,
    niches: ["BY"],
    language: "en",
    technology: "SH",
    minimumPrice: 20,
    maximumPrice: 100,
    minimumDaysRunning: 14,
    minimumActiveAds: 20,
    sorting: { field: "toprank", direction: "asc" },
    maximumPages: 3,
    maximumCandidates: 50,
  },
  SKINCARE_CORE: {
    id: "skincare-core",
    name: "Skin Care Core",
    preset: "SKINCARE_CORE",
    targetMarkets: BASE_MARKETS,
    niches: ["SK"],
    language: "en",
    technology: "SH",
    minimumPrice: 20,
    maximumPrice: 120,
    minimumDaysRunning: 14,
    minimumActiveAds: 20,
    sorting: { field: "toprank", direction: "asc" },
    maximumPages: 3,
    maximumCandidates: 50,
  },
  HAIRCARE_CORE: {
    id: "haircare-core",
    name: "Hair Care Core",
    preset: "HAIRCARE_CORE",
    targetMarkets: BASE_MARKETS,
    niches: ["HH"],
    language: "en",
    technology: "SH",
    minimumPrice: 20,
    maximumPrice: 150,
    minimumDaysRunning: 10,
    minimumActiveAds: 20,
    sorting: { field: "toprank", direction: "asc" },
    maximumPages: 3,
    maximumCandidates: 50,
  },
  PROBLEM_SOLVING: {
    id: "problem-solving",
    name: "Problem Solving Everyday Products",
    preset: "PROBLEM_SOLVING",
    targetMarkets: BASE_MARKETS,
    niches: ["PB"],
    language: "en",
    technology: "SH",
    minimumPrice: 15,
    maximumPrice: 100,
    minimumActiveAds: 10,
    sorting: { field: "toprank", direction: "asc" },
    maximumPages: 3,
    maximumCandidates: 50,
  },
  EMERGING_PRODUCTS: {
    id: "emerging-products",
    name: "Emerging Products",
    preset: "EMERGING_PRODUCTS",
    targetMarkets: BASE_MARKETS,
    niches: ["BY", "SK", "HH", "PB"],
    language: "en",
    technology: "SH",
    minimumDaysRunning: 3,
    maximumDaysRunning: 30,
    minimumActiveAdsGrowth: 20,
    activeAdsGrowthPeriod: "1w",
    sorting: { field: "mostrecent", direction: "desc" },
    maximumPages: 3,
    maximumCandidates: 50,
  },
  PROVEN_WINNERS: {
    id: "proven-winners",
    name: "Proven Winners",
    preset: "PROVEN_WINNERS",
    targetMarkets: BASE_MARKETS,
    niches: ["BY", "SK", "HH", "PB"],
    language: "en",
    technology: "SH",
    minimumDaysRunning: 30,
    minimumActiveAds: 50,
    sorting: { field: "longestrunning", direction: "desc" },
    maximumPages: 3,
    maximumCandidates: 50,
  },
};

export class WinningHunterDiscoveryStrategyRegistry {
  public getPreset(preset: WinningHunterDiscoveryPreset): WinningHunterProductDiscoveryStrategy {
    const strategy = BUILT_IN_PRESETS[preset];

    if (strategy === undefined) {
      throw new WinningHunterInvalidDiscoveryQueryError(`Unknown WinningHunter preset: ${preset}`);
    }

    return cloneWinningHunterStrategy(strategy);
  }

  public listPresets(): readonly WinningHunterProductDiscoveryStrategy[] {
    return Object.values(BUILT_IN_PRESETS).map((strategy) => cloneWinningHunterStrategy(strategy));
  }
}

export function validateWinningHunterStrategy(strategy: WinningHunterProductDiscoveryStrategy): void {
  if (strategy.id.trim().length === 0) {
    throw new WinningHunterInvalidDiscoveryQueryError("Strategy ID must not be blank");
  }

  if (strategy.name.trim().length === 0) {
    throw new WinningHunterInvalidDiscoveryQueryError("Strategy name must not be blank");
  }

  if (strategy.targetMarkets.length === 0) {
    throw new WinningHunterInvalidDiscoveryQueryError("At least one target market is required");
  }

  for (const market of strategy.targetMarkets) {
    if (!SUPPORTED_MARKETS.has(market)) {
      throw new WinningHunterInvalidDiscoveryQueryError(`Unsupported target market: ${market}`);
    }
  }

  if (strategy.niches.length === 0) {
    throw new WinningHunterInvalidDiscoveryQueryError("At least one niche is required");
  }

  for (const niche of strategy.niches) {
    if (!SUPPORTED_NICHES.has(niche)) {
      throw new WinningHunterInvalidDiscoveryQueryError(`Unsupported WinningHunter niche: ${niche}`);
    }
  }

  validateRange("price", strategy.minimumPrice, strategy.maximumPrice);
  validateRange("days running", strategy.minimumDaysRunning, strategy.maximumDaysRunning);
  validateRange("active ads", strategy.minimumActiveAds, strategy.maximumActiveAds);

  if (strategy.maximumPages < 1 || strategy.maximumPages > 10) {
    throw new WinningHunterInvalidDiscoveryQueryError("maximumPages must be between 1 and 10");
  }

  if (strategy.maximumCandidates < 1 || strategy.maximumCandidates > 200) {
    throw new WinningHunterInvalidDiscoveryQueryError("maximumCandidates must be between 1 and 200");
  }

  if (strategy.sorting.direction !== "asc" && strategy.sorting.direction !== "desc") {
    throw new WinningHunterInvalidDiscoveryQueryError("Sorting direction must be asc or desc");
  }

  if (strategy.language !== "en") {
    throw new WinningHunterInvalidDiscoveryQueryError("WinningHunter strategies currently support English only");
  }

  if (strategy.technology !== "SH") {
    throw new WinningHunterInvalidDiscoveryQueryError("WinningHunter strategies currently support Shopify only");
  }
}

export function cloneWinningHunterStrategy(
  strategy: WinningHunterProductDiscoveryStrategy,
): WinningHunterProductDiscoveryStrategy {
  return {
    ...strategy,
    targetMarkets: [...strategy.targetMarkets],
    niches: [...strategy.niches],
    ...(strategy.mediaTypes === undefined ? {} : { mediaTypes: [...strategy.mediaTypes] }),
    sorting: { ...strategy.sorting },
  };
}

function validateRange(name: string, minimum: number | undefined, maximum: number | undefined): void {
  for (const value of [minimum, maximum]) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new WinningHunterInvalidDiscoveryQueryError(`${name} range values must be non-negative`);
    }
  }

  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    throw new WinningHunterInvalidDiscoveryQueryError(`${name} minimum cannot exceed maximum`);
  }
}
