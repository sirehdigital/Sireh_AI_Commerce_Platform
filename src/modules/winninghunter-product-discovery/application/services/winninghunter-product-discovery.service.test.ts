import { describe, expect, it } from "vitest";

import {
  WinningHunterClientUnavailableError,
  WinningHunterInvalidDiscoveryQueryError,
  WinningHunterMalformedExternalResponseError,
  WinningHunterRateLimitedError,
  WinningHunterRequestTimeoutError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import {
  createStableHash,
  normalizeWinningHunterUrl,
} from "../../domain/value-objects/winninghunter-url-normalizer.js";
import { InMemoryWinningHunterProductDiscoveryClient } from "../../infrastructure/clients/in-memory-winninghunter-product-discovery.client.js";
import type { RawWinningHunterProductRow } from "../../infrastructure/clients/raw-winninghunter-product.dto.js";
import {
  buildProductIdentity,
  extractWinningHunterCurrency,
  parseWinningHunterNumber,
  WinningHunterProductCandidateMapper,
} from "../../infrastructure/mappers/winninghunter-product-candidate.mapper.js";
import {
  validateWinningHunterDiscoveryQuery,
  WinningHunterProductDiscoveryService,
} from "./winninghunter-product-discovery.service.js";

const buildRawRow = (overrides: Partial<RawWinningHunterProductRow> = {}): RawWinningHunterProductRow => ({
  id: "ad-001",
  productid: "external-001",
  shopify_productid: "898989",
  page_id: "page-001",
  pageName: "Beauty Store",
  countries: ["US", "GB"],
  started: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-12T00:00:00.000Z",
  lastSeen: "2026-07-11T00:00:00.000Z",
  created_at: "2026-06-30T00:00:00.000Z",
  urlStore: "https://Example-Beauty.test/",
  product_url:
    "https://Example-Beauty.test/products/travel-brush-capsule?utm_source=facebook&tw_adid=123",
  display_format: "video",
  caption: "Keep brushes organized.",
  copy: "Travel-ready brush holder",
  description: "Silicone makeup brush travel holder",
  total_eu_adspend: "39",
  total_eu_views: "1200",
  activeSeen: "4",
  total_active_ads_on_page: "7",
  total_active_ads_on_page_growth_1w: "2",
  total_active_ads_on_page_growth_1m: "5",
  ad_rank: "1",
  rank_history: { "2026-07-10": "2", "2026-07-11": 1 },
  shopify_productprice: "34.00",
  shopify_shopifydomain: "Example-Beauty.test",
  shopify_currency: { rate: "1.0", active: "USD" },
  title: "Travel Brush Capsule",
  ...overrides,
});

describe("WinningHunter Product Discovery", () => {
  it("accepts a valid discovery query", () => {
    expect(() =>
      validateWinningHunterDiscoveryQuery({
        countries: ["US", "GB"],
        niches: ["BY", "HH"],
        minPrice: 1,
        maxPrice: 40,
        minActiveAds: 1,
        maxActiveAds: 20,
        sortOrder: "desc",
        scroll: "cursor-001",
      }),
    ).not.toThrow();
  });

  it("rejects blank countries and niches", () => {
    expect(() => validateWinningHunterDiscoveryQuery({ countries: ["US", ""] })).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
    expect(() => validateWinningHunterDiscoveryQuery({ niches: ["BY", " "] })).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
  });

  it("rejects minimum price exceeding maximum price", () => {
    expect(() => validateWinningHunterDiscoveryQuery({ minPrice: 20, maxPrice: 10 })).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
  });

  it("rejects unsupported sort direction and malformed cursor", () => {
    expect(() =>
      validateWinningHunterDiscoveryQuery({ sortOrder: "sideways" as "asc" }),
    ).toThrow(WinningHunterInvalidDiscoveryQueryError);
    expect(() => validateWinningHunterDiscoveryQuery({ scroll: "" })).toThrow(
      WinningHunterInvalidDiscoveryQueryError,
    );
  });

  it("maps a raw product row into a canonical product candidate", () => {
    const mapper = new WinningHunterProductCandidateMapper();

    const candidate = mapper.mapRow(buildRawRow(), "2026-07-13T00:00:00.000Z");

    expect(candidate.id).toBe("winninghunter:shopify:898989");
    expect(candidate.source).toBe("WINNING_HUNTER");
    expect(candidate.discoverySource).toBe("META_ADS");
    expect(candidate.price).toBe(34);
    expect(candidate.currency).toBe("USD");
    expect(candidate.storeDomain).toBe("example-beauty.test");
    expect(candidate.productHandle).toBe("travel-brush-capsule");
    expect(candidate.adSignals[0]?.rankHistory).toEqual({
      "2026-07-10": 2,
      "2026-07-11": 1,
    });
  });

  it("converts numeric strings and rejects malformed prices", () => {
    expect(parseWinningHunterNumber("39")).toBe(39);
    expect(parseWinningHunterNumber("34.00")).toBe(34);
    expect(parseWinningHunterNumber("1")).toBe(1);
    expect(parseWinningHunterNumber("")).toBeUndefined();
    expect(parseWinningHunterNumber("not-a-number")).toBeUndefined();
    expect(parseWinningHunterNumber(Number.NaN)).toBeUndefined();
    expect(parseWinningHunterNumber("-1", { allowZero: true })).toBeUndefined();
  });

  it("extracts valid currency objects and ignores malformed currency", () => {
    expect(extractWinningHunterCurrency({ rate: "1.0", active: "usd" })).toBe("USD");
    expect(extractWinningHunterCurrency("cad")).toBe("CAD");
    expect(extractWinningHunterCurrency([])).toBeUndefined();
    expect(extractWinningHunterCurrency({ active: "US Dollar" })).toBeUndefined();
  });

  it("removes tracking parameters and extracts Shopify product handles", () => {
    const normalized = normalizeWinningHunterUrl(
      "https://goda.co/products/goda-for-her?utm_source=facebook&tw_adid=123&variant=456#top",
    );

    expect(normalized.url).toBe("https://goda.co/products/goda-for-her?variant=456");
    expect(normalized.domain).toBe("goda.co");
    expect(normalized.productHandle).toBe("goda-for-her");
  });

  it("builds deterministic product IDs from identity priority", () => {
    expect(buildProductIdentity({ shopifyProductId: "123" })).toBe("winninghunter:shopify:123");
    expect(buildProductIdentity({ canonicalProductUrl: "https://store.test/products/a" })).toBe(
      `winninghunter:url:${createStableHash("https://store.test/products/a")}`,
    );
    expect(buildProductIdentity({ storeDomain: "store.test", productHandle: "a" })).toBe(
      `winninghunter:store-product:${createStableHash("store.test/products/a")}`,
    );
    expect(buildProductIdentity({ externalProductId: "external-1" })).toBe(
      "winninghunter:external:external-1",
    );
  });

  it("groups multiple ads into one product and removes duplicate ad signals", async () => {
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      pages: [
        {
          rows: [
            buildRawRow({ id: "ad-001", total_active_ads_on_page: "7" }),
            buildRawRow({ id: "ad-002", total_active_ads_on_page: "9" }),
            buildRawRow({ id: "ad-001", total_active_ads_on_page: "8" }),
          ],
          sourceResultCount: 3,
        },
      ],
    });
    const service = new WinningHunterProductDiscoveryService(client);

    const result = await service.findWinningProducts({});

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.adSignals.map((signal) => signal.externalAdId)).toEqual([
      "ad-001",
      "ad-002",
    ]);
    expect(result.candidates[0]?.totalActiveAdsOnPage).toBe(9);
    expect(result.sourceResultCount).toBe(3);
  });

  it("preserves separate products", async () => {
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      pages: [
        {
          rows: [
            buildRawRow({ shopify_productid: "111", id: "ad-111" }),
            buildRawRow({ shopify_productid: "222", id: "ad-222" }),
          ],
        },
      ],
    });
    const service = new WinningHunterProductDiscoveryService(client);

    const result = await service.findWinningProducts({});

    expect(result.candidates.map((candidate) => candidate.id)).toEqual([
      "winninghunter:shopify:111",
      "winninghunter:shopify:222",
    ]);
  });

  it("selects the latest lastSeen value while aggregating duplicates", async () => {
    const service = new WinningHunterProductDiscoveryService(
      new InMemoryWinningHunterProductDiscoveryClient({
        pages: [
          {
            rows: [
              buildRawRow({ id: "ad-old", lastSeen: "2026-07-10T00:00:00.000Z" }),
              buildRawRow({ id: "ad-new", lastSeen: "2026-07-15T00:00:00.000Z" }),
            ],
          },
        ],
      }),
    );

    const result = await service.findWinningProducts({});

    expect(result.candidates[0]?.lastObservedAt).toBe("2026-07-15T00:00:00.000Z");
  });

  it("tolerates missing optional external fields", () => {
    const mapper = new WinningHunterProductCandidateMapper();

    const candidate = mapper.mapRow(
      {
        productid: "fallback",
        product_url: "https://store.test/products/fallback",
      },
      "2026-07-13T00:00:00.000Z",
    );

    expect(candidate.title).toBeUndefined();
    expect(candidate.adSignals[0]?.countries).toEqual([]);
  });

  it("skips malformed external rows without crashing the service", async () => {
    const service = new WinningHunterProductDiscoveryService(
      new InMemoryWinningHunterProductDiscoveryClient({
        pages: [
          {
            rows: [buildRawRow(), { productid: "broken", product_url: "not a url" }],
          },
        ],
      }),
    );

    const result = await service.findWinningProducts({});

    expect(result.candidates).toHaveLength(1);
  });

  it("rejects malformed provider pages with a typed error", async () => {
    const service = new WinningHunterProductDiscoveryService({
      findWinningProducts() {
        return Promise.resolve({ rows: undefined } as unknown as { rows: [] });
      },
    });

    await expect(service.findWinningProducts({})).rejects.toThrow(
      WinningHunterMalformedExternalResponseError,
    );
  });

  it("preserves pagination scroll and hasMore", async () => {
    const service = new WinningHunterProductDiscoveryService(
      new InMemoryWinningHunterProductDiscoveryClient({
        pages: [{ rows: [buildRawRow()], nextScroll: "scroll-2", hasMore: true }],
      }),
    );

    const result = await service.findWinningProducts({});

    expect(result.nextScroll).toBe("scroll-2");
    expect(result.hasMore).toBe(true);
  });

  it("maps provider timeout, rate limit, and provider failure errors", async () => {
    await expect(
      new WinningHunterProductDiscoveryService(
        new InMemoryWinningHunterProductDiscoveryClient({ failureMode: "timeout" }),
      ).findWinningProducts({}),
    ).rejects.toThrow(WinningHunterRequestTimeoutError);

    await expect(
      new WinningHunterProductDiscoveryService(
        new InMemoryWinningHunterProductDiscoveryClient({ failureMode: "rate-limit" }),
      ).findWinningProducts({}),
    ).rejects.toThrow(WinningHunterRateLimitedError);

    await expect(
      new WinningHunterProductDiscoveryService(
        new InMemoryWinningHunterProductDiscoveryClient({ failureMode: "provider-failure" }),
      ).findWinningProducts({}),
    ).rejects.toThrow(WinningHunterClientUnavailableError);
  });

  it("reports health states without importing or publishing products", async () => {
    const available = await new WinningHunterProductDiscoveryService(
      new InMemoryWinningHunterProductDiscoveryClient(),
    ).checkHealth();
    const degraded = await new WinningHunterProductDiscoveryService({
      findWinningProducts() {
        return Promise.resolve({ rows: [] });
      },
    }).checkHealth();
    const unavailable = await new WinningHunterProductDiscoveryService(
      new InMemoryWinningHunterProductDiscoveryClient({ failureMode: "provider-failure" }),
    ).checkHealth();

    expect(available.status).toBe("AVAILABLE");
    expect(degraded.status).toBe("DEGRADED");
    expect(unavailable.status).toBe("UNAVAILABLE");
  });

  it("returns defensive copies from the fake client and service", async () => {
    const row = buildRawRow();
    const client = new InMemoryWinningHunterProductDiscoveryClient({
      pages: [{ rows: [row] }, { rows: [row] }],
    });
    const service = new WinningHunterProductDiscoveryService(client);

    const first = await service.findWinningProducts({});
    const second = await service.findWinningProducts({});

    expect(first.candidates[0]).not.toBe(second.candidates[0]);
    expect(first.candidates[0]?.adSignals[0]).not.toBe(second.candidates[0]?.adSignals[0]);
    expect(first.candidates[0]?.adSignals[0]?.rankHistory).not.toBe(
      second.candidates[0]?.adSignals[0]?.rankHistory,
    );
  });
});
