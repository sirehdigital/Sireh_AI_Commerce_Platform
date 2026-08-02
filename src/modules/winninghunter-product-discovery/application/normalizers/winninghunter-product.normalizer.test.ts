import { describe, expect, it } from "vitest";

import {
  WinningHunterInvalidNormalizationTimestampError,
  WinningHunterMissingCanonicalIdentityError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type {
  WinningHunterCandidateDiscoveryContext,
  WinningHunterDiscoveredCandidate,
  WinningHunterDiscoveryRunResult,
} from "../../domain/models/winninghunter-discovery-strategy.model.js";
import type {
  WinningHunterAdSignal,
  WinningHunterProductCandidate,
} from "../../domain/models/winninghunter-product-candidate.model.js";
import { WinningHunterProductNormalizer } from "./winninghunter-product.normalizer.js";

const NORMALIZED_AT = "2026-08-02T00:00:00.000Z";

const buildAd = (overrides: Partial<WinningHunterAdSignal> = {}): WinningHunterAdSignal => ({
  externalAdId: "ad-001",
  pageId: "page-001",
  pageName: "Beauty Store",
  countries: ["US"],
  startedAt: "2026-07-01T00:00:00.000Z",
  lastSeenAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-21T00:00:00.000Z",
  mediaType: "video",
  caption: "Organize beauty essentials.",
  adCopy: "Travel-ready self-care accessory.",
  activeSeenCount: 4,
  adRank: 2,
  rankHistory: {
    "2026-07-10T00:00:00.000Z": 10,
    "2026-07-20T00:00:00.000Z": 8,
  },
  euAdSpend: 10,
  euViews: 100,
  ...overrides,
});

const buildCandidate = (
  overrides: Partial<WinningHunterProductCandidate> = {},
): WinningHunterProductCandidate => ({
  id: "winninghunter:shopify:111",
  source: "WINNING_HUNTER",
  discoverySource: "META_ADS",
  externalProductId: "external-111",
  shopifyProductId: "111",
  title: "Travel Brush Capsule",
  description: "Compact travel holder for beauty brushes.",
  productUrl: "https://example-beauty.test/products/travel-brush-capsule",
  canonicalProductUrl: "https://example-beauty.test/products/travel-brush-capsule",
  storeUrl: "https://example-beauty.test",
  storeDomain: "example-beauty.test",
  productHandle: "travel-brush-capsule",
  price: 24.95,
  currency: "usd",
  totalActiveAdsOnPage: 120,
  activeAdsGrowthOneWeek: 12,
  activeAdsGrowthOneMonth: 30,
  adSignals: [buildAd()],
  discoveredAt: "2026-07-02T00:00:00.000Z",
  lastObservedAt: "2026-07-21T00:00:00.000Z",
  ...overrides,
});

const context = (
  market: "US" | "GB" | "CA" | "AU",
  niche = "BY",
  page = 1,
): WinningHunterCandidateDiscoveryContext => ({
  market,
  niche,
  executionUnitId: `strategy:${market}:${niche}`,
  discoveredPage: page,
});

const discovered = (
  candidate: WinningHunterProductCandidate = buildCandidate(),
  contexts: readonly WinningHunterCandidateDiscoveryContext[] = [context("US")],
): WinningHunterDiscoveredCandidate => ({
  candidate,
  contexts,
});

const buildCandidateWithoutPageActivity = (
  overrides: Partial<WinningHunterProductCandidate> = {},
): WinningHunterProductCandidate => ({
  id: "winninghunter:shopify:111",
  source: "WINNING_HUNTER",
  discoverySource: "META_ADS",
  externalProductId: "external-111",
  shopifyProductId: "111",
  title: "Travel Brush Capsule",
  description: "Compact travel holder for beauty brushes.",
  productUrl: "https://example-beauty.test/products/travel-brush-capsule",
  canonicalProductUrl: "https://example-beauty.test/products/travel-brush-capsule",
  storeUrl: "https://example-beauty.test",
  storeDomain: "example-beauty.test",
  productHandle: "travel-brush-capsule",
  price: 24.95,
  currency: "usd",
  adSignals: [buildAd()],
  discoveredAt: "2026-07-02T00:00:00.000Z",
  lastObservedAt: "2026-07-21T00:00:00.000Z",
  ...overrides,
});

describe("WinningHunter Product Normalizer", () => {
  it("normalizes a valid candidate into a defensive product-intelligence record", () => {
    const normalizer = new WinningHunterProductNormalizer();
    const input = discovered();

    const product = normalizer.normalize(input, NORMALIZED_AT);

    expect(product).toMatchObject({
      id: "winninghunter:shopify:111",
      source: "WINNING_HUNTER",
      shopifyProductId: "111",
      canonicalProductUrl: "https://example-beauty.test/products/travel-brush-capsule",
      price: 24.95,
      currency: "USD",
      markets: ["US"],
      niches: ["BY"],
      recency: "RECENT",
      normalizedAt: NORMALIZED_AT,
    });
    expect(product.firstDiscoveredAt).toBe("2026-07-02T00:00:00.000Z");
    expect(product.lastObservedAt).toBe("2026-07-21T00:00:00.000Z");
    expect(input.candidate.adSignals[0]?.rankHistory).toEqual({
      "2026-07-10T00:00:00.000Z": 10,
      "2026-07-20T00:00:00.000Z": 8,
    });
  });

  it("aggregates markets and niches deterministically without duplicate context inflation", () => {
    const product = new WinningHunterProductNormalizer().normalize(
      discovered(buildCandidate(), [
        context("GB", "SK", 2),
        context("US", "BY", 1),
        context("GB", "SK", 2),
        context("CA", "BY", 1),
      ]),
      NORMALIZED_AT,
    );

    expect(product.markets).toEqual(["CA", "GB", "US"]);
    expect(product.niches).toEqual(["BY", "SK"]);
    expect(product.marketSignals.map((signal) => signal.market)).toEqual(["CA", "GB", "US"]);
    expect(product.marketSignals.find((signal) => signal.market === "GB")?.discoveryContexts).toBe(1);
  });

  it("uses ALL country targeting as support only for discovered markets", () => {
    const product = new WinningHunterProductNormalizer().normalize(
      discovered(
        buildCandidate({ adSignals: [buildAd({ countries: ["ALL"] })] }),
        [context("US"), context("AU")],
      ),
      NORMALIZED_AT,
    );

    expect(product.markets).toEqual(["AU", "US"]);
    expect(product.marketSignals.map((signal) => signal.adSignals)).toEqual([1, 1]);
  });

  it("normalizes creative media types and percentages in deterministic order", () => {
    const product = new WinningHunterProductNormalizer().normalize(
      discovered(
        buildCandidate({
          adSignals: [
            buildAd({ externalAdId: "video", mediaType: "videos" }),
            buildAd({ externalAdId: "image", mediaType: "image" }),
            buildAd({ externalAdId: "carousel", mediaType: "carousel" }),
            buildAd({ externalAdId: "dco", mediaType: "dco" }),
            buildAd({ externalAdId: "unknown", mediaType: " " }),
          ],
        }),
      ),
      NORMALIZED_AT,
    );

    expect(product.creativeSignals).toEqual([
      { mediaType: "CAROUSEL", adCount: 1, percentageOfAds: 20 },
      { mediaType: "DCO", adCount: 1, percentageOfAds: 20 },
      { mediaType: "IMAGE", adCount: 1, percentageOfAds: 20 },
      { mediaType: "UNKNOWN", adCount: 1, percentageOfAds: 20 },
      { mediaType: "VIDEO", adCount: 1, percentageOfAds: 20 },
    ]);
  });

  it("deduplicates ads, ignores blank IDs, and merges duplicate ad evidence", () => {
    const product = new WinningHunterProductNormalizer().normalize(
      discovered(
        buildCandidate({
          adSignals: [
            buildAd({
              externalAdId: "dupe",
              startedAt: "2026-07-10T00:00:00.000Z",
              lastSeenAt: "2026-07-15T00:00:00.000Z",
              updatedAt: "2026-07-15T00:00:00.000Z",
              activeSeenCount: 2,
              adRank: 5,
              rankHistory: { "2026-07-12T00:00:00.000Z": 5 },
              euAdSpend: 3,
              euViews: 30,
            }),
            buildAd({
              externalAdId: "dupe",
              startedAt: "2026-07-01T00:00:00.000Z",
              lastSeenAt: "2026-07-25T00:00:00.000Z",
              updatedAt: "2026-07-25T00:00:00.000Z",
              activeSeenCount: 8,
              adRank: 2,
              rankHistory: { "2026-07-25T00:00:00.000Z": 2 },
              euAdSpend: 5,
              euViews: 50,
            }),
            buildAd({ externalAdId: " " }),
          ],
        }),
      ),
      NORMALIZED_AT,
    );

    expect(product.advertisingSummary.uniqueAds).toBe(1);
    expect(product.advertisingSummary.activeSeenTotal).toBe(8);
    expect(product.advertisingSummary.earliestAdStartedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(product.advertisingSummary.latestObservedAt).toBe("2026-07-25T00:00:00.000Z");
    expect(product.advertisingSummary.minimumAdRank).toBe(2);
    expect(product.advertisingSummary.totalEuAdSpendObserved).toBe(5);
    expect(product.evidenceWarnings).toContain("Blank advertising signal identifiers were ignored.");
  });

  it("aggregates valid dates, ignores invalid/future dates, and calculates observed running days", () => {
    const product = new WinningHunterProductNormalizer().normalize(
      discovered(
        buildCandidate({
          adSignals: [
            buildAd({
              externalAdId: "old",
              startedAt: "2026-07-01T00:00:00.000Z",
              lastSeenAt: "2026-07-21T00:00:00.000Z",
            }),
            {
              externalAdId: "bad",
              countries: ["US"],
              startedAt: "not-a-date",
              lastSeenAt: "2026-09-01T00:00:00.000Z",
              updatedAt: "2026-07-05T00:00:00.000Z",
              rankHistory: {},
            },
            {
              externalAdId: "sequence",
              countries: ["US"],
              startedAt: "2026-07-20T00:00:00.000Z",
              lastSeenAt: "2026-07-10T00:00:00.000Z",
              rankHistory: {},
            },
          ],
        }),
      ),
      NORMALIZED_AT,
    );

    expect(product.advertisingSummary.earliestAdStartedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(product.advertisingSummary.latestAdStartedAt).toBe("2026-07-20T00:00:00.000Z");
    expect(product.advertisingSummary.latestObservedAt).toBe("2026-07-21T00:00:00.000Z");
    expect(product.advertisingSummary.longestObservedRunningDays).toBe(20);
    expect(product.advertisingSummary.averageObservedRunningDays).toBe(20);
    expect(product.evidenceWarnings).toContain("Ignored malformed ad start date.");
    expect(product.evidenceWarnings).toContain("Ignored future ad observation date.");
    expect(product.evidenceWarnings).toContain(
      "Ignored advertising running-day evidence where start date is after observation date.",
    );
  });

  it("aggregates rank metrics while ignoring invalid rank values", () => {
    const product = new WinningHunterProductNormalizer().normalize(
      discovered(
        buildCandidate({
          adSignals: [
            buildAd({ externalAdId: "a", adRank: 1 }),
            buildAd({ externalAdId: "b", adRank: 5 }),
            buildAd({ externalAdId: "c", adRank: 0 }),
            buildAd({ externalAdId: "d", adRank: Number.POSITIVE_INFINITY }),
          ],
        }),
      ),
      NORMALIZED_AT,
    );

    expect(product.advertisingSummary.minimumAdRank).toBe(1);
    expect(product.advertisingSummary.maximumAdRank).toBe(5);
    expect(product.advertisingSummary.averageAdRank).toBe(3);
  });

  it("classifies rising, declining, stable, mixed and unknown momentum", () => {
    const normalizer = new WinningHunterProductNormalizer();
    const run = (signals: readonly WinningHunterAdSignal[]) =>
      normalizer.normalize(discovered(buildCandidate({ adSignals: signals })), NORMALIZED_AT)
        .advertisingSummary.momentum;

    expect(
      run([
        buildAd({
          rankHistory: {
            "2026-07-01T00:00:00.000Z": 10,
            "2026-07-10T00:00:00.000Z": 8,
          },
        }),
      ]),
    ).toBe("RISING");
    expect(
      run([
        buildAd({
          rankHistory: {
            "2026-07-01T00:00:00.000Z": 10,
            "2026-07-10T00:00:00.000Z": 12,
          },
        }),
      ]),
    ).toBe("DECLINING");
    expect(
      run([
        buildAd({
          rankHistory: {
            "2026-07-01T00:00:00.000Z": 10,
            "2026-07-10T00:00:00.000Z": 10.5,
          },
        }),
      ]),
    ).toBe("STABLE");
    expect(
      run([
        buildAd({
          externalAdId: "rising",
          rankHistory: {
            "2026-07-01T00:00:00.000Z": 10,
            "2026-07-10T00:00:00.000Z": 8,
          },
        }),
        buildAd({
          externalAdId: "declining",
          rankHistory: {
            "2026-07-01T00:00:00.000Z": 10,
            "2026-07-10T00:00:00.000Z": 12,
          },
        }),
      ]),
    ).toBe("MIXED");
    expect(run([buildAd({ rankHistory: {} })])).toBe("UNKNOWN");
  });

  it("aggregates observed spend, views and page-level activity conservatively", () => {
    const product = new WinningHunterProductNormalizer().normalize(
      discovered(
        buildCandidate({
          totalActiveAdsOnPage: 80,
          activeAdsGrowthOneWeek: 9,
          activeAdsGrowthOneMonth: 22,
          adSignals: [
            buildAd({ externalAdId: "a", euAdSpend: 10, euViews: 100 }),
            buildAd({ externalAdId: "b", euAdSpend: -1, euViews: 50 }),
          ],
        }),
      ),
      NORMALIZED_AT,
    );

    expect(product.advertisingSummary.totalEuAdSpendObserved).toBe(10);
    expect(product.advertisingSummary.totalEuViewsObserved).toBe(150);
    expect(product.advertisingSummary.highestPageActiveAds).toBe(80);
    expect(product.advertisingSummary.highestActiveAdsGrowthOneWeek).toBe(9);
    expect(product.evidenceWarnings).toContain(
      "Provider spend or reach observations may use overlapping measurement windows.",
    );
    expect(product.evidenceWarnings).toContain(
      "Advertiser page activity is page-level evidence, not product-level evidence.",
    );
  });

  it("classifies strong, moderate, limited and insufficient evidence levels", () => {
    const normalizer = new WinningHunterProductNormalizer();

    const strong = normalizer.normalize(
      discovered(
        buildCandidate({
          adSignals: [
            buildAd({ externalAdId: "a" }),
            buildAd({ externalAdId: "b", countries: ["GB"] }),
            buildAd({ externalAdId: "c", countries: ["CA"] }),
          ],
        }),
        [context("US"), context("GB"), context("CA")],
      ),
      NORMALIZED_AT,
    );
    const moderate = normalizer.normalize(
      discovered(
        buildCandidateWithoutPageActivity({
          adSignals: [buildAd({ externalAdId: "a" }), buildAd({ externalAdId: "b" })],
        }),
      ),
      NORMALIZED_AT,
    );
    const limited = normalizer.normalize(
      discovered(
        buildCandidateWithoutPageActivity({
          adSignals: [buildAd({ rankHistory: {} })],
        }),
      ),
      NORMALIZED_AT,
    );
    const insufficient = normalizer.normalize(
      discovered(buildCandidate({ adSignals: [] })),
      NORMALIZED_AT,
    );

    expect(strong.evidenceLevel).toBe("STRONG");
    expect(moderate.evidenceLevel).toBe("MODERATE");
    expect(limited.evidenceLevel).toBe("LIMITED");
    expect(insufficient.evidenceLevel).toBe("INSUFFICIENT");
  });

  it("generates deterministic evidence reasons and warnings", () => {
    const product = new WinningHunterProductNormalizer().normalize(
      discovered(
        buildCandidate({
          adSignals: [
            buildAd({ externalAdId: "a" }),
            buildAd({ externalAdId: "b" }),
            buildAd({ externalAdId: "c" }),
          ],
        }),
        [context("US"), context("GB")],
      ),
      NORMALIZED_AT,
    );

    expect(product.evidenceReasons).toEqual([
      "Observed across 2 target markets.",
      "Contains 3 unique advertising creatives.",
      "At least one advertisement was observed across 20 days.",
      "Advertising rank history indicates rising momentum.",
      "Advertiser page activity reached 120 active advertisements.",
    ]);
  });

  it("warns about missing title, description, price, currency, one ad and missing rank history", () => {
    const base = buildCandidate();
    const minimalCandidate: WinningHunterProductCandidate = {
      id: base.id,
      source: base.source,
      discoverySource: base.discoverySource,
      productUrl: base.productUrl,
      canonicalProductUrl: base.canonicalProductUrl,
      adSignals: [
        {
          externalAdId: "ad-no-rank",
          countries: ["US"],
          rankHistory: {},
        },
      ],
      discoveredAt: base.discoveredAt,
    };

    const product = new WinningHunterProductNormalizer().normalize(
      discovered(minimalCandidate),
      NORMALIZED_AT,
    );

    expect(product.evidenceWarnings).toEqual(
      expect.arrayContaining([
        "Missing product title.",
        "Missing product description.",
        "Missing product price.",
        "Missing valid product currency.",
        "Only one advertising signal is available.",
        "No usable rank history is available.",
      ]),
    );
  });

  it("detects malformed and conflicting currency evidence without conversion", () => {
    const normalizer = new WinningHunterProductNormalizer();

    const malformed = normalizer.normalize(
      discovered(buildCandidate({ currency: "US Dollar" })),
      NORMALIZED_AT,
    );
    const conflicting = normalizer.normalize(
      discovered(buildCandidate({ currency: "USD,CAD" })),
      NORMALIZED_AT,
    );

    expect(malformed.currency).toBeUndefined();
    expect(malformed.evidenceWarnings).toContain("Malformed product currency was ignored.");
    expect(conflicting.currency).toBe("USD");
    expect(conflicting.evidenceWarnings).toContain(
      "Conflicting currency observations were detected; retaining the first valid currency.",
    );
  });

  it("classifies current, recent, aging, stale and unknown recency bands", () => {
    const normalizer = new WinningHunterProductNormalizer();
    const recencyFor = (lastSeenAt?: string) =>
      normalizer.normalize(
        discovered(
          lastSeenAt === undefined
            ? buildCandidateWithoutPageActivity({
                lastObservedAt: undefined,
                adSignals: [
                  {
                    externalAdId: "undated",
                    countries: ["US"],
                    rankHistory: {},
                  },
                ],
              } as unknown as WinningHunterProductCandidate)
            : buildCandidate({
                lastObservedAt: lastSeenAt,
                adSignals: [buildAd({ lastSeenAt, updatedAt: lastSeenAt })],
              }),
        ),
        NORMALIZED_AT,
      ).recency;

    expect(recencyFor("2026-08-01T00:00:00.000Z")).toBe("CURRENT");
    expect(recencyFor("2026-07-24T00:00:00.000Z")).toBe("RECENT");
    expect(recencyFor("2026-07-10T00:00:00.000Z")).toBe("AGING");
    expect(recencyFor("2026-06-01T00:00:00.000Z")).toBe("STALE");
    expect(recencyFor(undefined)).toBe("UNKNOWN");
  });

  it("throws typed errors for invalid timestamps and missing canonical identity", () => {
    const normalizer = new WinningHunterProductNormalizer();

    expect(() => normalizer.normalize(discovered(), "not-a-date")).toThrow(
      WinningHunterInvalidNormalizationTimestampError,
    );
    expect(() =>
      normalizer.normalize(
        discovered(buildCandidate({ canonicalProductUrl: "not-a-url" })),
        NORMALIZED_AT,
      ),
    ).toThrow(WinningHunterMissingCanonicalIdentityError);
  });

  it("returns defensive output copies", () => {
    const normalizer = new WinningHunterProductNormalizer();
    const first = normalizer.normalize(discovered(), NORMALIZED_AT);
    const second = normalizer.normalize(discovered(), NORMALIZED_AT);

    expect(first.markets).not.toBe(second.markets);
    expect(first.marketSignals[0]).not.toBe(second.marketSignals[0]);
    expect(first.creativeSignals[0]).not.toBe(second.creativeSignals[0]);
    expect(first.advertisingSummary).not.toBe(second.advertisingSummary);
  });

  it("normalizes a discovery run, preserves order and isolates malformed candidates", () => {
    const normalizer = new WinningHunterProductNormalizer();
    const run: WinningHunterDiscoveryRunResult = {
      strategyId: "beauty-core",
      status: "COMPLETED",
      candidates: [
        discovered(buildCandidate({ id: "winninghunter:shopify:111", shopifyProductId: "111" })),
        discovered(buildCandidate({ id: "winninghunter:shopify:222", shopifyProductId: "222" })),
        discovered(
          buildCandidate({
            id: "broken",
            canonicalProductUrl: "not-a-url",
          }),
        ),
      ],
      executionUnitsPlanned: 1,
      executionUnitsCompleted: 1,
      executionUnitsFailed: 0,
      pagesFetched: 1,
      sourceRowsReceived: 3,
      uniqueCandidates: 3,
      warnings: [],
      startedAt: "2026-08-02T00:00:00.000Z",
      completedAt: "2026-08-02T00:00:00.000Z",
    };

    const result = normalizer.normalizeRunWithWarnings(run, NORMALIZED_AT);

    expect(result.products.map((product) => product.id)).toEqual([
      "winninghunter:shopify:111",
      "winninghunter:shopify:222",
    ]);
    expect(result.warnings).toEqual([
      "Skipped WinningHunter candidate broken: WinningHunterMissingCanonicalIdentityError.",
    ]);
    expect(normalizer.normalizeRun(run, NORMALIZED_AT)).toHaveLength(2);
  });
});
