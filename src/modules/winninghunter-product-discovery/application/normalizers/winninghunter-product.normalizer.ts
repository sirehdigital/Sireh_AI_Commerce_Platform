import {
  WinningHunterInvalidNormalizationInputError,
  WinningHunterInvalidNormalizationTimestampError,
  WinningHunterMalformedCandidateEvidenceError,
  WinningHunterMissingCanonicalIdentityError,
  WinningHunterUnusableDiscoveryContextError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type {
  WinningHunterDiscoveredCandidate,
  WinningHunterDiscoveryRunResult,
} from "../../domain/models/winninghunter-discovery-strategy.model.js";
import type {
  WinningHunterAdSignal,
  WinningHunterProductCandidate,
} from "../../domain/models/winninghunter-product-candidate.model.js";
import type {
  NormalizedWinningProduct,
  NormalizedWinningProductBatchResult,
  WinningProductAdvertisingSummary,
  WinningProductCreativeSignal,
  WinningProductEvidenceLevel,
  WinningProductMarketSignal,
  WinningProductMomentum,
  WinningProductRecency,
} from "../../domain/models/normalized-winning-product.model.js";
import { cloneCandidate } from "../../infrastructure/mappers/winninghunter-product-candidate.mapper.js";

interface DateParseResult {
  readonly value?: string;
  readonly warning?: string;
}

interface AdSignalWithEvidence {
  readonly signal: WinningHunterAdSignal;
  readonly startedAt?: string;
  readonly lastSeenAt?: string;
  readonly updatedAt?: string;
  readonly observedAt?: string;
  readonly runningDays?: number;
  readonly momentum: WinningProductMomentum;
}

interface EvidenceClassificationInput {
  readonly product: NormalizedWinningProduct;
  readonly hasRankEvidence: boolean;
  readonly hasPageActivityEvidence: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_DAYS = 30;

export class WinningHunterProductNormalizer {
  public normalize(
    discovered: WinningHunterDiscoveredCandidate,
    normalizedAt: string,
  ): NormalizedWinningProduct {
    const normalizedTime = parseRequiredTimestamp(normalizedAt);
    const candidate = validateCandidate(discovered);
    const contexts = dedupeContexts(discovered);
    const warnings: string[] = [];
    const candidateDates = parseCandidateDates(candidate, normalizedTime, warnings);
    const adSignals = dedupeAdSignals(candidate.adSignals, normalizedTime, warnings);
    const marketSignals = buildMarketSignals(contexts, adSignals);
    const markets = marketSignals.map((signal) => signal.market);
    const niches = uniqueSorted(contexts.map((context) => context.niche));
    const creativeSignals = buildCreativeSignals(adSignals.map((ad) => ad.signal));
    const advertisingSummary = buildAdvertisingSummary(candidate, adSignals, warnings);
    const lastObservedAt = advertisingSummary.latestObservedAt ?? candidateDates.lastObservedAt;
    const firstDiscoveredAt =
      candidateDates.firstDiscoveredAt ??
      earliestDefined([...adSignals.map((ad) => ad.observedAt), normalizedAt]) ??
      normalizedAt;
    const currency = normalizeCurrency(candidate.currency, warnings);
    const recency = classifyRecency(lastObservedAt, normalizedAt);

    applyEvidenceWarnings(candidate, adSignals, advertisingSummary, recency, warnings, currency);

    const productBase = {
      id: candidate.id,
      source: "WINNING_HUNTER" as const,
      ...(candidate.externalProductId === undefined
        ? {}
        : { externalProductId: candidate.externalProductId }),
      ...(candidate.shopifyProductId === undefined
        ? {}
        : { shopifyProductId: candidate.shopifyProductId }),
      ...(candidate.title === undefined ? {} : { title: candidate.title }),
      ...(candidate.description === undefined ? {} : { description: candidate.description }),
      canonicalProductUrl: candidate.canonicalProductUrl,
      ...(candidate.storeDomain === undefined ? {} : { storeDomain: candidate.storeDomain }),
      ...(candidate.productHandle === undefined ? {} : { productHandle: candidate.productHandle }),
      ...(validNonNegative(candidate.price) === undefined ? {} : { price: candidate.price }),
      ...(currency === undefined ? {} : { currency }),
      markets,
      niches,
      marketSignals,
      creativeSignals,
      advertisingSummary,
      recency,
      firstDiscoveredAt,
      ...(lastObservedAt === undefined ? {} : { lastObservedAt }),
      normalizedAt,
    };
    const classification = classifyEvidence({
      product: {
        ...productBase,
        evidenceLevel: "INSUFFICIENT",
        evidenceReasons: [],
        evidenceWarnings: [],
      },
      hasRankEvidence: advertisingSummary.minimumAdRank !== undefined,
      hasPageActivityEvidence: advertisingSummary.highestPageActiveAds !== undefined,
    });

    return cloneNormalizedProduct({
      ...productBase,
      evidenceLevel: classification.level,
      evidenceReasons: classification.reasons,
      evidenceWarnings: uniqueSorted(warnings),
    });
  }

  public normalizeRun(
    run: WinningHunterDiscoveryRunResult,
    normalizedAt: string,
  ): readonly NormalizedWinningProduct[] {
    return this.normalizeRunWithWarnings(run, normalizedAt).products;
  }

  public normalizeRunWithWarnings(
    run: WinningHunterDiscoveryRunResult,
    normalizedAt: string,
  ): NormalizedWinningProductBatchResult {
    const products: NormalizedWinningProduct[] = [];
    const warnings: string[] = [];

    for (const discovered of run.candidates) {
      try {
        products.push(this.normalize(discovered, normalizedAt));
      } catch (error) {
        warnings.push(toBatchWarning(discovered.candidate?.id, error));
      }
    }

    return {
      products: products.map((product) => cloneNormalizedProduct(product)),
      warnings,
    };
  }
}

function validateCandidate(discovered: WinningHunterDiscoveredCandidate): WinningHunterProductCandidate {
  if (discovered === undefined || discovered === null) {
    throw new WinningHunterInvalidNormalizationInputError();
  }

  const candidate = cloneCandidate(discovered.candidate);

  if (candidate.id.trim().length === 0) {
    throw new WinningHunterMissingCanonicalIdentityError();
  }

  if (!isUsableUrl(candidate.canonicalProductUrl)) {
    throw new WinningHunterMissingCanonicalIdentityError();
  }

  if (!Array.isArray(discovered.contexts)) {
    throw new WinningHunterUnusableDiscoveryContextError();
  }

  if (!Array.isArray(candidate.adSignals)) {
    throw new WinningHunterMalformedCandidateEvidenceError();
  }

  return candidate;
}

function dedupeContexts(
  discovered: WinningHunterDiscoveredCandidate,
): WinningHunterDiscoveredCandidate["contexts"] {
  const contexts = new Map<string, WinningHunterDiscoveredCandidate["contexts"][number]>();

  for (const context of discovered.contexts) {
    if (context.market.trim().length === 0 || context.niche.trim().length === 0) {
      throw new WinningHunterUnusableDiscoveryContextError();
    }

    contexts.set(
      `${context.executionUnitId}:${context.market}:${context.niche}:${context.discoveredPage}`,
      { ...context },
    );
  }

  if (contexts.size === 0) {
    throw new WinningHunterUnusableDiscoveryContextError();
  }

  return [...contexts.values()];
}

function dedupeAdSignals(
  signals: readonly WinningHunterAdSignal[],
  normalizedTime: number,
  warnings: string[],
): readonly AdSignalWithEvidence[] {
  const byId = new Map<string, WinningHunterAdSignal>();
  let blankIds = 0;

  for (const signal of signals) {
    const id = signal.externalAdId.trim();

    if (id.length === 0) {
      blankIds += 1;
      continue;
    }

    const existing = byId.get(id);
    byId.set(id, existing === undefined ? cloneSignal(signal) : mergeDuplicateSignal(existing, signal));
  }

  if (blankIds > 0) {
    warnings.push("Blank advertising signal identifiers were ignored.");
  }

  return [...byId.values()].map((signal) => enrichSignal(signal, normalizedTime, warnings));
}

function mergeDuplicateSignal(
  older: WinningHunterAdSignal,
  newer: WinningHunterAdSignal,
): WinningHunterAdSignal {
  const newerUpdatedAt = parseTimestamp(newer.updatedAt);
  const olderUpdatedAt = parseTimestamp(older.updatedAt);
  const preferred =
    newerUpdatedAt !== undefined &&
    (olderUpdatedAt === undefined || newerUpdatedAt >= olderUpdatedAt)
      ? newer
      : older;
  const fallback = preferred === newer ? older : newer;
  const rankHistory = { ...fallback.rankHistory, ...preferred.rankHistory };

  return {
    ...fallback,
    ...preferred,
    externalAdId: preferred.externalAdId.trim(),
    countries: uniqueSorted([...fallback.countries, ...preferred.countries]),
    ...optionalString("startedAt", earliestDefined([older.startedAt, newer.startedAt])),
    ...optionalString("lastSeenAt", latestDefined([older.lastSeenAt, newer.lastSeenAt])),
    ...optionalString("updatedAt", latestDefined([older.updatedAt, newer.updatedAt])),
    ...optionalNumber("activeSeenCount", maxDefined([older.activeSeenCount, newer.activeSeenCount])),
    ...optionalNumber("adRank", minPositive([older.adRank, newer.adRank])),
    rankHistory,
    ...optionalNumber("euAdSpend", maxDefined([older.euAdSpend, newer.euAdSpend])),
    ...optionalNumber("euViews", maxDefined([older.euViews, newer.euViews])),
  };
}

function enrichSignal(
  signal: WinningHunterAdSignal,
  normalizedTime: number,
  warnings: string[],
): AdSignalWithEvidence {
  const startedAt = parseExternalDate(signal.startedAt, normalizedTime, warnings, "ad start").value;
  const lastSeenAt = parseExternalDate(signal.lastSeenAt, normalizedTime, warnings, "ad observation").value;
  const updatedAt = parseExternalDate(signal.updatedAt, normalizedTime, warnings, "ad update").value;
  const observedAt = latestDefined([lastSeenAt, updatedAt]);
  const runningDays =
    startedAt !== undefined && observedAt !== undefined
      ? calculateRunningDays(startedAt, observedAt, warnings)
      : undefined;

  return {
    signal: cloneSignal(signal),
    ...(startedAt === undefined ? {} : { startedAt }),
    ...(lastSeenAt === undefined ? {} : { lastSeenAt }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
    ...(observedAt === undefined ? {} : { observedAt }),
    ...(runningDays === undefined ? {} : { runningDays }),
    momentum: classifyAdMomentum(signal.rankHistory),
  };
}

function buildMarketSignals(
  contexts: WinningHunterDiscoveredCandidate["contexts"],
  ads: readonly AdSignalWithEvidence[],
): readonly WinningProductMarketSignal[] {
  return uniqueSorted(contexts.map((context) => context.market)).map((market) => {
    const contextForMarket = contexts.filter((context) => context.market === market);
    const relevantAds = ads.filter((ad) => {
      const countries = ad.signal.countries.map((country) => country.toUpperCase());

      return countries.includes(market) || countries.includes("ALL");
    });
    const latestObservedAt = latestDefined(relevantAds.map((ad) => ad.observedAt));

    return {
      market,
      niches: uniqueSorted(contextForMarket.map((context) => context.niche)),
      discoveryContexts: contextForMarket.length,
      adSignals: relevantAds.length,
      ...(latestObservedAt === undefined ? {} : { latestObservedAt }),
    };
  });
}

function buildCreativeSignals(signals: readonly WinningHunterAdSignal[]): readonly WinningProductCreativeSignal[] {
  const counts = new Map<string, number>();

  for (const signal of signals) {
    const mediaType = normalizeMediaType(signal.mediaType);
    counts.set(mediaType, (counts.get(mediaType) ?? 0) + 1);
  }

  const total = signals.length;

  return [...counts.entries()]
    .map(([mediaType, adCount]) => ({
      mediaType,
      adCount,
      percentageOfAds: total === 0 ? 0 : round((adCount / total) * 100),
    }))
    .sort((left, right) => right.adCount - left.adCount || left.mediaType.localeCompare(right.mediaType));
}

function buildAdvertisingSummary(
  candidate: WinningHunterProductCandidate,
  ads: readonly AdSignalWithEvidence[],
  warnings: string[],
): WinningProductAdvertisingSummary {
  const ranks = ads
    .map((ad) => validPositive(ad.signal.adRank))
    .filter((rank): rank is number => rank !== undefined);
  const activeSeenTotal = ads.reduce((total, ad) => total + (validNonNegative(ad.signal.activeSeenCount) ?? 0), 0);
  const spendValues = ads
    .map((ad) => validNonNegative(ad.signal.euAdSpend))
    .filter((value): value is number => value !== undefined);
  const viewValues = ads
    .map((ad) => validNonNegative(ad.signal.euViews))
    .filter((value): value is number => value !== undefined);
  const runningDays = ads
    .map((ad) => ad.runningDays)
    .filter((value): value is number => value !== undefined);
  const pageActiveAds = validNonNegative(candidate.totalActiveAdsOnPage);
  const growthOneWeek = validNonNegative(candidate.activeAdsGrowthOneWeek);
  const growthOneMonth = validNonNegative(candidate.activeAdsGrowthOneMonth);

  if (spendValues.length > 0 || viewValues.length > 0) {
    warnings.push("Provider spend or reach observations may use overlapping measurement windows.");
  }

  if (pageActiveAds !== undefined || growthOneWeek !== undefined || growthOneMonth !== undefined) {
    warnings.push("Advertiser page activity is page-level evidence, not product-level evidence.");
  }

  return {
    uniqueAds: ads.length,
    uniquePages: new Set(
      ads
        .map((ad) => ad.signal.pageId?.trim())
        .filter((pageId): pageId is string => pageId !== undefined && pageId.length > 0),
    ).size,
    activeSeenTotal,
    ...optionalString("earliestAdStartedAt", earliestDefined(ads.map((ad) => ad.startedAt))),
    ...optionalString("latestAdStartedAt", latestDefined(ads.map((ad) => ad.startedAt))),
    ...optionalString("latestObservedAt", latestDefined(ads.map((ad) => ad.observedAt))),
    ...optionalNumber("longestObservedRunningDays", maxDefined(runningDays)),
    ...optionalNumber("averageObservedRunningDays", average(runningDays)),
    ...optionalNumber("minimumAdRank", minPositive(ranks)),
    ...optionalNumber("maximumAdRank", maxDefined(ranks)),
    ...optionalNumber("averageAdRank", average(ranks)),
    ...optionalNumber("totalEuAdSpendObserved", sum(spendValues)),
    ...optionalNumber("totalEuViewsObserved", sum(viewValues)),
    ...optionalNumber("highestPageActiveAds", pageActiveAds),
    ...optionalNumber("highestActiveAdsGrowthOneWeek", growthOneWeek),
    ...optionalNumber("highestActiveAdsGrowthOneMonth", growthOneMonth),
    momentum: classifyProductMomentum(ads.map((ad) => ad.momentum)),
  };
}

function parseCandidateDates(
  candidate: WinningHunterProductCandidate,
  normalizedTime: number,
  warnings: string[],
): { readonly firstDiscoveredAt?: string; readonly lastObservedAt?: string } {
  return {
    ...optionalString(
      "firstDiscoveredAt",
      parseExternalDate(candidate.discoveredAt, normalizedTime, warnings, "candidate discovery").value,
    ),
    ...optionalString(
      "lastObservedAt",
      parseExternalDate(candidate.lastObservedAt, normalizedTime, warnings, "candidate observation").value,
    ),
  };
}

function parseExternalDate(
  value: string | undefined,
  normalizedTime: number,
  warnings: string[],
  label: string,
): DateParseResult {
  if (value === undefined) {
    return {};
  }

  const parsed = parseTimestamp(value);

  if (parsed === undefined) {
    warnings.push(`Ignored malformed ${label} date.`);

    return {};
  }

  if (parsed > normalizedTime) {
    warnings.push(`Ignored future ${label} date.`);

    return {};
  }

  return { value: new Date(parsed).toISOString() };
}

function calculateRunningDays(
  startedAt: string,
  observedAt: string,
  warnings: string[],
): number | undefined {
  const started = parseTimestamp(startedAt);
  const observed = parseTimestamp(observedAt);

  if (started === undefined || observed === undefined) {
    return undefined;
  }

  if (started > observed) {
    warnings.push("Ignored advertising running-day evidence where start date is after observation date.");

    return undefined;
  }

  return Math.max(0, Math.floor((observed - started) / DAY_MS));
}

function classifyAdMomentum(rankHistory: Readonly<Record<string, number>>): WinningProductMomentum {
  const entries = Object.entries(rankHistory)
    .map(([date, rank]) => ({ date, time: parseTimestamp(date), rank: validPositive(rank) }))
    .filter((entry): entry is { readonly date: string; readonly time: number; readonly rank: number } =>
      entry.time !== undefined && entry.rank !== undefined,
    )
    .sort((left, right) => left.time - right.time || left.date.localeCompare(right.date));

  if (entries.length < 2) {
    return "UNKNOWN";
  }

  const earliest = entries[0];
  const latest = entries[entries.length - 1];

  if (earliest === undefined || latest === undefined) {
    return "UNKNOWN";
  }

  // Lower rank values are stronger. A 10% or greater improvement is RISING;
  // a 10% or greater deterioration is DECLINING; changes inside that band are STABLE.
  const change = (earliest.rank - latest.rank) / earliest.rank;

  if (change >= 0.1) {
    return "RISING";
  }

  if (change <= -0.1) {
    return "DECLINING";
  }

  return "STABLE";
}

function classifyProductMomentum(values: readonly WinningProductMomentum[]): WinningProductMomentum {
  const known = values.filter((value) => value !== "UNKNOWN");

  if (known.length === 0) {
    return "UNKNOWN";
  }

  const rising = known.filter((value) => value === "RISING").length;
  const declining = known.filter((value) => value === "DECLINING").length;
  const stable = known.filter((value) => value === "STABLE").length;

  if (rising > 0 && declining > 0) {
    return "MIXED";
  }

  if (rising > known.length / 2) {
    return "RISING";
  }

  if (declining > known.length / 2) {
    return "DECLINING";
  }

  if (stable >= rising + declining) {
    return "STABLE";
  }

  return "MIXED";
}

function classifyRecency(
  latestObservedAt: string | undefined,
  normalizedAt: string,
): WinningProductRecency {
  const latest = parseTimestamp(latestObservedAt);
  const normalized = parseTimestamp(normalizedAt);

  if (latest === undefined || normalized === undefined || latest > normalized) {
    return "UNKNOWN";
  }

  const days = Math.floor((normalized - latest) / DAY_MS);

  if (days <= 4) {
    return "CURRENT";
  }

  if (days <= 14) {
    return "RECENT";
  }

  if (days <= STALE_DAYS) {
    return "AGING";
  }

  return "STALE";
}

function classifyEvidence(input: EvidenceClassificationInput): {
  readonly level: WinningProductEvidenceLevel;
  readonly reasons: readonly string[];
} {
  const { product, hasRankEvidence, hasPageActivityEvidence } = input;
  const uniqueMarkets = product.markets.length;
  const contexts = product.marketSignals.reduce((total, signal) => total + signal.discoveryContexts, 0);
  const uniqueAds = product.advertisingSummary.uniqueAds;
  const longevity = product.advertisingSummary.longestObservedRunningDays ?? 0;
  const hasIdentity = product.id.trim().length > 0 && isUsableUrl(product.canonicalProductUrl);
  const hasEvidence = hasRankEvidence || hasPageActivityEvidence || product.advertisingSummary.momentum !== "UNKNOWN";
  const reasons = buildEvidenceReasons(product);

  if (!hasIdentity || uniqueAds === 0 || uniqueMarkets === 0) {
    return { level: "INSUFFICIENT", reasons };
  }

  if (uniqueAds >= 3 && (uniqueMarkets >= 2 || contexts >= 3) && longevity >= 14 && hasEvidence) {
    return { level: "STRONG", reasons };
  }

  if (uniqueAds >= 2 && uniqueMarkets >= 1 && (longevity > 0 || product.advertisingSummary.momentum !== "UNKNOWN")) {
    return { level: "MODERATE", reasons };
  }

  return { level: "LIMITED", reasons };
}

function buildEvidenceReasons(product: NormalizedWinningProduct): readonly string[] {
  const reasons: string[] = [];

  if (product.markets.length > 0) {
    reasons.push(`Observed across ${product.markets.length} target markets.`);
  }

  if (product.advertisingSummary.uniqueAds > 0) {
    reasons.push(`Contains ${product.advertisingSummary.uniqueAds} unique advertising creatives.`);
  }

  if (product.advertisingSummary.longestObservedRunningDays !== undefined) {
    reasons.push(
      `At least one advertisement was observed across ${product.advertisingSummary.longestObservedRunningDays} days.`,
    );
  }

  if (product.advertisingSummary.momentum !== "UNKNOWN") {
    reasons.push(
      `Advertising rank history indicates ${product.advertisingSummary.momentum.toLowerCase()} momentum.`,
    );
  }

  if (product.advertisingSummary.highestPageActiveAds !== undefined) {
    reasons.push(
      `Advertiser page activity reached ${product.advertisingSummary.highestPageActiveAds} active advertisements.`,
    );
  }

  return reasons;
}

function applyEvidenceWarnings(
  candidate: WinningHunterProductCandidate,
  ads: readonly AdSignalWithEvidence[],
  summary: WinningProductAdvertisingSummary,
  recency: WinningProductRecency,
  warnings: string[],
  currency: string | undefined,
): void {
  if (candidate.title === undefined) {
    warnings.push("Missing product title.");
  }

  if (candidate.description === undefined) {
    warnings.push("Missing product description.");
  }

  if (candidate.price === undefined) {
    warnings.push("Missing product price.");
  }

  if (currency === undefined) {
    warnings.push("Missing valid product currency.");
  }

  if (ads.length === 1) {
    warnings.push("Only one advertising signal is available.");
  }

  if (summary.minimumAdRank === undefined && summary.momentum === "UNKNOWN") {
    warnings.push("No usable rank history is available.");
  }

  if (recency === "STALE") {
    warnings.push("Latest observation is stale.");
  }

  if (summary.momentum === "MIXED") {
    warnings.push("Advertising rank momentum is contradictory.");
  }
}

function normalizeCurrency(value: string | undefined, warnings: string[]): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const currency = value.trim().toUpperCase();
  const currencyCandidates = currency
    .split(/[,|/\s]+/u)
    .filter((candidate) => /^[A-Z]{3}$/u.test(candidate));

  if (new Set(currencyCandidates).size > 1) {
    warnings.push("Conflicting currency observations were detected; retaining the first valid currency.");

    return currencyCandidates[0];
  }

  if (!/^[A-Z]{3}$/u.test(currency)) {
    warnings.push("Malformed product currency was ignored.");

    return undefined;
  }

  return currency;
}

function normalizeMediaType(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "video" || normalized === "videos") {
    return "VIDEO";
  }

  if (normalized === "image" || normalized === "images") {
    return "IMAGE";
  }

  if (normalized === "carousel") {
    return "CAROUSEL";
  }

  if (normalized === "dco") {
    return "DCO";
  }

  return "UNKNOWN";
}

function parseRequiredTimestamp(value: string): number {
  const parsed = parseTimestamp(value);

  if (parsed === undefined) {
    throw new WinningHunterInvalidNormalizationTimestampError();
  }

  return parsed;
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function isUsableUrl(value: string | undefined): boolean {
  if (value === undefined || value.trim().length === 0) {
    return false;
  }

  try {
    const parsed = new URL(value);

    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function earliestDefined(values: readonly (string | undefined)[]): string | undefined {
  return values
    .filter((value): value is string => value !== undefined && parseTimestamp(value) !== undefined)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
}

function latestDefined(values: readonly (string | undefined)[]): string | undefined {
  return values
    .filter((value): value is string => value !== undefined && parseTimestamp(value) !== undefined)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

function validPositive(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;
}

function validNonNegative(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function minPositive(values: readonly (number | undefined)[]): number | undefined {
  const validValues = values.filter((value): value is number => validPositive(value) !== undefined);

  return validValues.length === 0 ? undefined : Math.min(...validValues);
}

function maxDefined(values: readonly (number | undefined)[]): number | undefined {
  const validValues = values.filter((value): value is number => validNonNegative(value) !== undefined);

  return validValues.length === 0 ? undefined : Math.max(...validValues);
}

function sum(values: readonly number[]): number | undefined {
  return values.length === 0 ? undefined : round(values.reduce((total, value) => total + value, 0));
}

function average(values: readonly number[]): number | undefined {
  return values.length === 0 ? undefined : round(values.reduce((total, value) => total + value, 0) / values.length);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function optionalString<Key extends string>(key: Key, value: string | undefined): Partial<Record<Key, string>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<Key, string>>);
}

function optionalNumber<Key extends string>(key: Key, value: number | undefined): Partial<Record<Key, number>> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Record<Key, number>>);
}

function cloneSignal(signal: WinningHunterAdSignal): WinningHunterAdSignal {
  return {
    ...signal,
    countries: [...signal.countries],
    rankHistory: { ...signal.rankHistory },
  };
}

function cloneNormalizedProduct(product: NormalizedWinningProduct): NormalizedWinningProduct {
  return {
    ...product,
    markets: [...product.markets],
    niches: [...product.niches],
    marketSignals: product.marketSignals.map((signal) => ({
      ...signal,
      niches: [...signal.niches],
    })),
    creativeSignals: product.creativeSignals.map((signal) => ({ ...signal })),
    advertisingSummary: { ...product.advertisingSummary },
    evidenceReasons: [...product.evidenceReasons],
    evidenceWarnings: [...product.evidenceWarnings],
  };
}

function toBatchWarning(candidateId: string | undefined, error: unknown): string {
  const trimmedId = candidateId?.trim();
  const id = trimmedId === undefined || trimmedId.length === 0 ? "unknown" : trimmedId;

  if (error instanceof Error) {
    return `Skipped WinningHunter candidate ${id}: ${error.name}.`;
  }

  return `Skipped WinningHunter candidate ${id}: unknown normalization failure.`;
}
