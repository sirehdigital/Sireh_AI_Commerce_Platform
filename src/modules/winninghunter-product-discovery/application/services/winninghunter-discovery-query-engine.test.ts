import { describe, expect, it } from "vitest";

import { WinningHunterInvalidDiscoveryQueryError } from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type { WinningHunterDiscoveryQuery } from "../../domain/models/winninghunter-discovery-query.model.js";
import type { WinningHunterProductDiscoveryStrategy } from "../../domain/models/winninghunter-discovery-strategy.model.js";
import { InMemoryWinningHunterProductDiscoveryClient } from "../../infrastructure/clients/in-memory-winninghunter-product-discovery.client.js";
import type {
  RawWinningHunterDiscoveryPage,
  RawWinningHunterProductRow,
} from "../../infrastructure/clients/raw-winninghunter-product.dto.js";
import type { WinningHunterProductDiscoveryClient } from "../ports/winninghunter-product-discovery-client.js";
import {
  cloneWinningHunterStrategy,
  validateWinningHunterStrategy,
  WinningHunterDiscoveryStrategyRegistry,
} from "../strategies/winninghunter-discovery-strategy.registry.js";
import {
  buildQueryForUnit,
  WinningHunterDiscoveryQueryEngine,
} from "./winninghunter-discovery-query-engine.js";

const buildRawRow = (
  shopifyProductId: string,
  overrides: Partial<RawWinningHunterProductRow> = {},
): RawWinningHunterProductRow => ({
  id: `ad-${shopifyProductId}`,
  productid: `external-${shopifyProductId}`,
  shopify_productid: shopifyProductId,
  page_id: `page-${shopifyProductId}`,
  pageName: "Beauty Store",
  countries: ["US"],
  started: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
  lastSeen: "2026-07-11T00:00:00.000Z",
  created_at: "2026-06-30T00:00:00.000Z",
  urlStore: "https://example-beauty.test/",
  product_url: `https://example-beauty.test/products/product-${shopifyProductId}?utm_source=meta`,
  display_format: "video",
  caption: "Organize beauty essentials.",
  copy: "Travel-ready beauty accessory",
  description: "Compact beauty storage accessory",
  total_active_ads_on_page: "7",
  ad_rank: "1",
  rank_history: { "2026-07-11": 1 },
  shopify_productprice: "34.00",
  shopify_shopifydomain: "example-beauty.test",
  shopify_currency: { rate: "1.0", active: "USD" },
  title: `Product ${shopifyProductId}`,
  ...overrides,
});

const buildStrategy = (
  overrides: Partial<WinningHunterProductDiscoveryStrategy> = {},
): WinningHunterProductDiscoveryStrategy => ({
  id: "custom",
  name: "Custom Strategy",
  preset: "BEAUTY_CORE",
  targetMarkets: ["US"],
  niches: ["BY"],
  language: "en",
  technology: "SH",
  minimumPrice: 20,
  maximumPrice: 100,
  minimumDaysRunning: 7,
  minimumActiveAds: 10,
  sorting: { field: "toprank", direction: "asc" },
  maximumPages: 3,
  maximumCandidates: 50,
  ...overrides,
});

const page = (
  rows: readonly RawWinningHunterProductRow[],
  options: Partial<RawWinningHunterDiscoveryPage> = {},
): RawWinningHunterDiscoveryPage => ({
  rows,
  ...options,
});

describe("WinningHunter Discovery Query Engine", () => {
  it("returns defensive built-in presets with supported niche codes and rejects BE", () => {
    const registry = new WinningHunterDiscoveryStrategyRegistry();
    const presets = registry.listPresets();

    expect(presets.map((preset) => preset.preset)).toEqual([
      "BEAUTY_CORE",
      "SKINCARE_CORE",
      "HAIRCARE_CORE",
      "PROBLEM_SOLVING",
      "EMERGING_PRODUCTS",
      "PROVEN_WINNERS",
    ]);
    expect(registry.getPreset("BEAUTY_CORE").niches).toEqual(["BY"]);
    expect(registry.getPreset("SKINCARE_CORE").niches).toEqual(["SK"]);
    expect(registry.getPreset("HAIRCARE_CORE").niches).toEqual(["HH"]);
    expect(registry.getPreset("PROBLEM_SOLVING").niches).toEqual(["PB"]);
    expect(registry.getPreset("EMERGING_PRODUCTS").niches).toEqual(["BY", "SK", "HH", "PB"]);
    expect(registry.getPreset("PROVEN_WINNERS").niches).toEqual(["BY", "SK", "HH", "PB"]);

    const mutablePreset = registry.getPreset("BEAUTY_CORE");
    (mutablePreset.niches as string[]).push("BE");

    expect(registry.getPreset("BEAUTY_CORE").niches).toEqual(["BY"]);
    expect(() => validateWinningHunterStrategy(buildStrategy({ niches: ["BE"] }))).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
  });

  it("validates strategy markets, identity, required arrays, ranges and limits", () => {
    expect(() => validateWinningHunterStrategy(buildStrategy())).not.toThrow();
    expect(() => validateWinningHunterStrategy(buildStrategy({ id: " " }))).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
    expect(() => validateWinningHunterStrategy(buildStrategy({ name: " " }))).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
    expect(() => validateWinningHunterStrategy(buildStrategy({ targetMarkets: [] }))).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
    expect(() =>
      validateWinningHunterStrategy(
        buildStrategy({ targetMarkets: ["US", "DE" as "US"] }),
      ),
    ).toThrow(WinningHunterInvalidDiscoveryQueryError);
    expect(() => validateWinningHunterStrategy(buildStrategy({ niches: [] }))).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
    expect(() =>
      validateWinningHunterStrategy(buildStrategy({ minimumPrice: 30, maximumPrice: 20 })),
    ).toThrow(WinningHunterInvalidDiscoveryQueryError);
    expect(() =>
      validateWinningHunterStrategy(
        buildStrategy({ minimumDaysRunning: 30, maximumDaysRunning: 10 }),
      ),
    ).toThrow(WinningHunterInvalidDiscoveryQueryError);
    expect(() =>
      validateWinningHunterStrategy(buildStrategy({ minimumActiveAds: 30, maximumActiveAds: 10 })),
    ).toThrow(WinningHunterInvalidDiscoveryQueryError);
    expect(() => validateWinningHunterStrategy(buildStrategy({ maximumPages: 0 }))).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
    expect(() => validateWinningHunterStrategy(buildStrategy({ maximumCandidates: 201 }))).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
    expect(() =>
      validateWinningHunterStrategy(
        buildStrategy({ sorting: { field: "toprank", direction: "sideways" as "asc" } }),
      ),
    ).toThrow(WinningHunterInvalidDiscoveryQueryError);
    expect(() =>
      validateWinningHunterStrategy(buildStrategy({ language: "ms" as "en" })),
    ).toThrow(WinningHunterInvalidDiscoveryQueryError);
    expect(() =>
      validateWinningHunterStrategy(buildStrategy({ technology: "TT" as "SH" })),
    ).toThrow(WinningHunterInvalidDiscoveryQueryError);
  });

  it("builds a deterministic execution plan with one query per market and niche", () => {
    const engine = new WinningHunterDiscoveryQueryEngine(
      new InMemoryWinningHunterProductDiscoveryClient(),
    );
    const strategy = buildStrategy({
      id: "multi",
      targetMarkets: ["US", "GB"],
      niches: ["BY", "SK"],
      maximumPages: 2,
      maximumCandidates: 25,
    });

    const plan = engine.buildExecutionPlan(strategy);

    expect(plan.strategyId).toBe("multi");
    expect(plan.maximumPagesPerUnit).toBe(2);
    expect(plan.maximumCandidates).toBe(25);
    expect(plan.units.map((unit) => unit.id)).toEqual([
      "multi:US:BY",
      "multi:US:SK",
      "multi:GB:BY",
      "multi:GB:SK",
    ]);
    expect(plan.units.map((unit) => unit.query.countries?.[0])).toEqual(["US", "US", "GB", "GB"]);
    expect(plan.units.map((unit) => unit.query.niches?.[0])).toEqual(["BY", "SK", "BY", "SK"]);
  });

  it("maps strategy fields into queries while omitting undefined filters", () => {
    const baseStrategy = buildStrategy();
    const query = buildQueryForUnit(
      {
        id: baseStrategy.id,
        name: baseStrategy.name,
        preset: baseStrategy.preset,
        targetMarkets: baseStrategy.targetMarkets,
        niches: baseStrategy.niches,
        language: baseStrategy.language,
        technology: baseStrategy.technology,
        maximumPrice: 100,
        minimumDaysRunning: 7,
        maximumDaysRunning: 30,
        minimumActiveAds: 10,
        minimumActiveAdsGrowth: 20,
        activeAdsGrowthPeriod: "1w",
        mediaTypes: ["videos", "images"],
        sorting: baseStrategy.sorting,
        maximumPages: baseStrategy.maximumPages,
        maximumCandidates: baseStrategy.maximumCandidates,
      },
      "CA",
      "HH",
    );

    expect(query).toMatchObject({
      countries: ["CA"],
      niches: ["HH"],
      language: "en",
      technology: "SH",
      maxPrice: 100,
      minDaysRunning: 7,
      maxDaysRunning: 30,
      minActiveAds: 10,
      minActiveAdsGrowth: 20,
      activeAdsGrowthPeriod: "1w",
      mediaType: "videos",
      sortBy: "toprank",
      sortOrder: "asc",
    });
    expect(Object.hasOwn(query, "minPrice")).toBe(false);
    expect(Object.hasOwn(query, "scroll")).toBe(false);
  });

  it("returns a completed single-page discovery run", async () => {
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [{ market: "US", niche: "BY", pages: [page([buildRawRow("111")])] }],
    });
    const result = await new WinningHunterDiscoveryQueryEngine(client).discover(buildStrategy());

    expect(result.status).toBe("COMPLETED");
    expect(result.executionUnitsPlanned).toBe(1);
    expect(result.executionUnitsCompleted).toBe(1);
    expect(result.pagesFetched).toBe(1);
    expect(result.sourceRowsReceived).toBe(1);
    expect(result.uniqueCandidates).toBe(1);
    expect(result.candidates[0]?.contexts).toEqual([
      { market: "US", niche: "BY", executionUnitId: "custom:US:BY", discoveredPage: 1 },
    ]);
  });

  it("follows scroll pagination and keeps original filters unchanged", async () => {
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [
        {
          market: "US",
          niche: "BY",
          pages: [
            page([buildRawRow("111")], { nextScroll: "cursor-2", hasMore: true }),
            page([buildRawRow("222")], { hasMore: false }),
          ],
        },
      ],
    });

    const result = await new WinningHunterDiscoveryQueryEngine(client).discover(buildStrategy());

    expect(result.pagesFetched).toBe(2);
    expect(result.uniqueCandidates).toBe(2);
    expect(client.invocationHistory).toHaveLength(2);
    expect(client.invocationHistory[0]).toMatchObject({ countries: ["US"], niches: ["BY"] });
    expect(Object.hasOwn(client.invocationHistory[0] as object, "scroll")).toBe(false);
    expect(client.invocationHistory[1]).toMatchObject({
      countries: ["US"],
      niches: ["BY"],
      scroll: "cursor-2",
    });
  });

  it("stops pagination when no cursor is returned, at max pages, and at max candidates", async () => {
    const noCursorClient = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [
        {
          market: "US",
          niche: "BY",
          pages: [
            page([buildRawRow("111")], { hasMore: true }),
            page([buildRawRow("222")]),
          ],
        },
      ],
    });
    const noCursorResult = await new WinningHunterDiscoveryQueryEngine(noCursorClient).discover(
      buildStrategy(),
    );

    expect(noCursorResult.pagesFetched).toBe(1);

    const maxPagesClient = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [
        {
          market: "US",
          niche: "BY",
          pages: [
            page([buildRawRow("111")], { nextScroll: "cursor-2", hasMore: true }),
            page([buildRawRow("222")], { nextScroll: "cursor-3", hasMore: true }),
            page([buildRawRow("333")], { nextScroll: "cursor-4", hasMore: true }),
          ],
        },
      ],
    });
    const maxPagesResult = await new WinningHunterDiscoveryQueryEngine(maxPagesClient).discover(
      buildStrategy({ maximumPages: 2 }),
    );

    expect(maxPagesResult.pagesFetched).toBe(2);
    expect(maxPagesResult.uniqueCandidates).toBe(2);

    const maxCandidatesClient = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [
        {
          market: "US",
          niche: "BY",
          pages: [page([buildRawRow("111"), buildRawRow("222"), buildRawRow("333")])],
        },
      ],
    });
    const maxCandidatesResult = await new WinningHunterDiscoveryQueryEngine(
      maxCandidatesClient,
    ).discover(buildStrategy({ maximumCandidates: 2 }));

    expect(maxCandidatesResult.uniqueCandidates).toBe(2);
  });

  it("warns and stops when the provider repeats a scroll cursor", async () => {
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [
        {
          market: "US",
          niche: "BY",
          pages: [
            page([buildRawRow("111")], { nextScroll: "same-cursor", hasMore: true }),
            page([buildRawRow("222")], { nextScroll: "same-cursor", hasMore: true }),
            page([buildRawRow("333")]),
          ],
        },
      ],
    });

    const result = await new WinningHunterDiscoveryQueryEngine(client).discover(buildStrategy());

    expect(result.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(result.pagesFetched).toBe(2);
    expect(result.warnings.map((warning) => warning.code)).toEqual(["REPEATED_SCROLL_CURSOR"]);
  });

  it("deduplicates candidates across pages and markets while merging provenance and ad signals", async () => {
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [
        {
          market: "US",
          niche: "BY",
          pages: [
            page(
              [
                buildRawRow("111", {
                  id: "ad-us",
                  countries: ["US"],
                  total_active_ads_on_page: "5",
                }),
              ],
              { nextScroll: "cursor-2", hasMore: true },
            ),
            page([
              buildRawRow("111", {
                id: "ad-us-2",
                countries: ["US"],
                total_active_ads_on_page: "7",
              }),
            ]),
          ],
        },
        {
          market: "GB",
          niche: "BY",
          pages: [
            page([
              buildRawRow("111", {
                id: "ad-gb",
                countries: ["GB"],
                total_active_ads_on_page: "9",
              }),
            ]),
          ],
        },
      ],
    });

    const result = await new WinningHunterDiscoveryQueryEngine(client).discover(
      buildStrategy({ targetMarkets: ["US", "GB"] }),
    );
    const discovered = result.candidates[0];

    expect(result.uniqueCandidates).toBe(1);
    expect(discovered?.contexts).toHaveLength(3);
    expect(discovered?.candidate.totalActiveAdsOnPage).toBe(9);
    expect(discovered?.candidate.adSignals.map((signal) => signal.externalAdId).sort()).toEqual([
      "ad-gb",
      "ad-us",
      "ad-us-2",
    ]);
  });

  it("orders candidates deterministically by discovery evidence without scoring", async () => {
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [
        {
          market: "US",
          niche: "BY",
          pages: [
            page([
              buildRawRow("300", {
                total_active_ads_on_page: "7",
                lastSeen: "2026-07-11T00:00:00.000Z",
              }),
              buildRawRow("200", {
                total_active_ads_on_page: "15",
                lastSeen: "2026-07-10T00:00:00.000Z",
              }),
              buildRawRow("100", {
                total_active_ads_on_page: "15",
                lastSeen: "2026-07-12T00:00:00.000Z",
              }),
            ]),
          ],
        },
        {
          market: "GB",
          niche: "BY",
          pages: [page([buildRawRow("300", { total_active_ads_on_page: "7" })])],
        },
      ],
    });

    const result = await new WinningHunterDiscoveryQueryEngine(client).discover(
      buildStrategy({ targetMarkets: ["US", "GB"] }),
    );

    expect(result.candidates.map((candidate) => candidate.candidate.id)).toEqual([
      "winninghunter:shopify:300",
      "winninghunter:shopify:100",
      "winninghunter:shopify:200",
    ]);
  });

  it("isolates timeout, rate-limit and provider failures with partial success", async () => {
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [
        { market: "US", niche: "BY", pages: [page([buildRawRow("111")])] },
        { market: "GB", niche: "BY", pages: [], failureMode: "timeout" },
        { market: "CA", niche: "BY", pages: [], failureMode: "rate-limit" },
        { market: "AU", niche: "BY", pages: [], failureMode: "provider-failure" },
      ],
    });

    const result = await new WinningHunterDiscoveryQueryEngine(client).discover(
      buildStrategy({ targetMarkets: ["US", "GB", "CA", "AU"] }),
    );

    expect(result.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(result.executionUnitsCompleted).toBe(1);
    expect(result.executionUnitsFailed).toBe(3);
    expect(result.warnings.map((warning) => warning.code).sort()).toEqual([
      "WINNINGHUNTER_RATE_LIMITED",
      "WINNINGHUNTER_TIMEOUT",
      "WINNINGHUNTER_UNAVAILABLE",
    ]);
  });

  it("marks the run failed when all execution units fail", async () => {
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [
        { market: "US", niche: "BY", pages: [], failureMode: "provider-failure" },
        { market: "GB", niche: "BY", pages: [], failureMode: "provider-failure" },
      ],
    });

    const result = await new WinningHunterDiscoveryQueryEngine(client).discover(
      buildStrategy({ targetMarkets: ["US", "GB"] }),
    );

    expect(result.status).toBe("FAILED");
    expect(result.executionUnitsCompleted).toBe(0);
    expect(result.executionUnitsFailed).toBe(2);
  });

  it("bounds execution concurrency between one and four units", async () => {
    class DelayedClient implements WinningHunterProductDiscoveryClient {
      public current = 0;
      public maximumObserved = 0;

      public async findWinningProducts(
        query: WinningHunterDiscoveryQuery,
      ): Promise<RawWinningHunterDiscoveryPage> {
        this.current += 1;
        this.maximumObserved = Math.max(this.maximumObserved, this.current);
        await new Promise((resolve) => {
          setTimeout(resolve, 5);
        });
        this.current -= 1;

        return page([buildRawRow(`${query.countries?.[0] ?? "US"}-${query.niches?.[0] ?? "BY"}`)]);
      }
    }

    const client = new DelayedClient();
    await new WinningHunterDiscoveryQueryEngine(client, { concurrencyLimit: 99 }).discover(
      buildStrategy({ targetMarkets: ["US", "GB", "CA", "AU"], niches: ["BY", "SK"] }),
    );

    expect(client.maximumObserved).toBeLessThanOrEqual(4);
  });

  it("captures provider invocation history and protects returned data with defensive copies", async () => {
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      routes: [{ market: "US", niche: "BY", pages: [page([buildRawRow("111")])] }],
    });
    const engine = new WinningHunterDiscoveryQueryEngine(client);

    const first = await engine.discover(buildStrategy());
    const second = await engine.discover(buildStrategy());
    const cloned = cloneWinningHunterStrategy(buildStrategy());

    expect(client.invocationHistory).toHaveLength(2);
    expect(first.candidates[0]).not.toBe(second.candidates[0]);
    expect(first.candidates[0]?.candidate.adSignals[0]?.rankHistory).not.toBe(
      second.candidates[0]?.candidate.adSignals[0]?.rankHistory,
    );
    expect(cloned.targetMarkets).not.toBe(buildStrategy().targetMarkets);
  });
});
