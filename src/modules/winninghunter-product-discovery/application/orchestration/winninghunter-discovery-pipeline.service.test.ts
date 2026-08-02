import { describe, expect, it } from "vitest";

import {
  WinningHunterConflictingPipelineStrategyError,
  WinningHunterInvalidPipelineTimestampError,
  WinningHunterMissingPipelineStrategyError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type {
  NormalizedWinningProduct,
} from "../../domain/models/normalized-winning-product.model.js";
import type {
  WinningProductOpportunityAssessment,
  WinningProductOpportunityBatchResult,
} from "../../domain/models/winning-product-opportunity-assessment.model.js";
import type {
  WinningProductShortlistResult,
} from "../../domain/models/winning-product-shortlist.model.js";
import type {
  WinningHunterDiscoveryPipelineRequest,
} from "../../domain/models/winninghunter-discovery-pipeline.model.js";
import type {
  WinningHunterDiscoveredCandidate,
  WinningHunterDiscoveryRunResult,
  WinningHunterProductDiscoveryStrategy,
} from "../../domain/models/winninghunter-discovery-strategy.model.js";
import type { RawWinningHunterProductRow } from "../../infrastructure/clients/raw-winninghunter-product.dto.js";
import { DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG } from "../shortlist/winninghunter-product-shortlist.service.js";
import {
  createInMemoryWinningHunterDiscoveryPipeline,
  WinningHunterDiscoveryPipelineService,
} from "./winninghunter-discovery-pipeline.service.js";

const NORMALIZED_AT = "2026-08-02T00:00:00.000Z";
const SCORED_AT = "2026-08-02T00:01:00.000Z";
const SHORTLISTED_AT = "2026-08-02T00:02:00.000Z";

const strategy = (overrides: Partial<WinningHunterProductDiscoveryStrategy> = {}): WinningHunterProductDiscoveryStrategy => ({
  id: "beauty-core",
  name: "Beauty Core",
  preset: "BEAUTY_CORE",
  targetMarkets: ["US"],
  niches: ["BY"],
  language: "en",
  technology: "SH",
  sorting: { field: "toprank", direction: "asc" },
  maximumPages: 1,
  maximumCandidates: 10,
  ...overrides,
});

const request = (
  overrides: Partial<WinningHunterDiscoveryPipelineRequest> = {},
): WinningHunterDiscoveryPipelineRequest => ({
  customStrategy: strategy(),
  normalizationTimestamp: NORMALIZED_AT,
  scoringTimestamp: SCORED_AT,
  shortlistTimestamp: SHORTLISTED_AT,
  ...overrides,
});

const presetRequest = (): WinningHunterDiscoveryPipelineRequest => ({
  strategyPreset: "BEAUTY_CORE",
  normalizationTimestamp: NORMALIZED_AT,
  scoringTimestamp: SCORED_AT,
  shortlistTimestamp: SHORTLISTED_AT,
});

const missingStrategyRequest = (): WinningHunterDiscoveryPipelineRequest => ({
  normalizationTimestamp: NORMALIZED_AT,
  scoringTimestamp: SCORED_AT,
  shortlistTimestamp: SHORTLISTED_AT,
});

const discovered = (id = "winninghunter:shopify:111"): WinningHunterDiscoveredCandidate => ({
  candidate: {
    id,
    source: "WINNING_HUNTER",
    discoverySource: "META_ADS",
    shopifyProductId: id.split(":").at(-1) ?? id,
    title: "SirehLuxe Brush Capsule",
    description: "Travel beauty organizer.",
    productUrl: "https://example.test/products/brush-capsule",
    canonicalProductUrl: "https://example.test/products/brush-capsule",
    storeDomain: "example.test",
    productHandle: "brush-capsule",
    price: 24.95,
    currency: "USD",
    totalActiveAdsOnPage: 20,
    adSignals: [
      {
        externalAdId: `ad-${id}`,
        pageId: "page-001",
        countries: ["US"],
        startedAt: "2026-07-01T00:00:00.000Z",
        lastSeenAt: "2026-08-01T00:00:00.000Z",
        mediaType: "video",
        activeSeenCount: 4,
        adRank: 1,
        rankHistory: { "2026-08-01": 1 },
      },
    ],
    discoveredAt: "2026-07-01T00:00:00.000Z",
    lastObservedAt: "2026-08-01T00:00:00.000Z",
  },
  contexts: [
    {
      market: "US",
      niche: "BY",
      executionUnitId: "beauty-core:US:BY",
      discoveredPage: 1,
    },
  ],
});

const discoveryRun = (
  candidates: readonly WinningHunterDiscoveredCandidate[] = [discovered()],
  overrides: Partial<WinningHunterDiscoveryRunResult> = {},
): WinningHunterDiscoveryRunResult => ({
  strategyId: "beauty-core",
  status: "COMPLETED",
  candidates,
  executionUnitsPlanned: 1,
  executionUnitsCompleted: 1,
  executionUnitsFailed: 0,
  pagesFetched: 1,
  sourceRowsReceived: candidates.length,
  uniqueCandidates: candidates.length,
  warnings: [],
  startedAt: "ignored",
  completedAt: "ignored",
  ...overrides,
});

const product = (overrides: Partial<NormalizedWinningProduct> = {}): NormalizedWinningProduct => ({
  id: "winninghunter:shopify:111",
  source: "WINNING_HUNTER",
  title: "SirehLuxe Brush Capsule",
  description: "Travel beauty organizer.",
  canonicalProductUrl: "https://example.test/products/brush-capsule",
  storeDomain: "example.test",
  productHandle: "brush-capsule",
  price: 24.95,
  currency: "USD",
  markets: ["US"],
  niches: ["BY"],
  marketSignals: [{ market: "US", niches: ["BY"], discoveryContexts: 1, adSignals: 3 }],
  creativeSignals: [{ mediaType: "VIDEO", adCount: 3, percentageOfAds: 100 }],
  advertisingSummary: {
    uniqueAds: 3,
    uniquePages: 1,
    activeSeenTotal: 6,
    longestObservedRunningDays: 30,
    highestPageActiveAds: 20,
    momentum: "RISING",
  },
  evidenceLevel: "STRONG",
  evidenceReasons: ["Observed in target market."],
  evidenceWarnings: [],
  recency: "CURRENT",
  firstDiscoveredAt: "2026-07-01T00:00:00.000Z",
  lastObservedAt: "2026-08-01T00:00:00.000Z",
  normalizedAt: NORMALIZED_AT,
  ...overrides,
});

const assessment = (
  productId = "winninghunter:shopify:111",
  overrides: Partial<WinningProductOpportunityAssessment> = {},
): WinningProductOpportunityAssessment => ({
  productId,
  overallScore: 86,
  maximumScore: 100,
  recommendation: "STRONG_CANDIDATE",
  components: [],
  adjustments: [],
  strengths: ["Strong observed ad evidence."],
  risks: [],
  warnings: [],
  evidenceLevel: "STRONG",
  evaluatedAt: SCORED_AT,
  scoringVersion: "SACP-WH-SCORE-v1",
  ...overrides,
});

const rawRow = (overrides: Partial<RawWinningHunterProductRow> = {}): RawWinningHunterProductRow => ({
  id: "ad-001",
  productid: "external-001",
  shopify_productid: "111",
  page_id: "page-001",
  pageName: "Beauty Store",
  countries: ["US"],
  started: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  lastSeen: "2026-08-01T00:00:00.000Z",
  created_at: "2026-07-01T00:00:00.000Z",
  urlStore: "https://example.test",
  product_url: "https://example.test/products/brush-capsule?utm_source=meta",
  display_format: "video",
  caption: "Travel-ready beauty storage.",
  copy: "Keep brushes organized.",
  description: "Silicone makeup brush travel holder.",
  activeSeen: "4",
  total_active_ads_on_page: "20",
  ad_rank: "1",
  rank_history: { "2026-08-01": 1 },
  shopify_productprice: "24.95",
  shopify_shopifydomain: "example.test",
  shopify_currency: { active: "USD" },
  title: "Travel Brush Capsule",
  ...overrides,
});

const service = (overrides: {
  readonly run?: WinningHunterDiscoveryRunResult;
  readonly products?: readonly NormalizedWinningProduct[];
  readonly normalizationWarnings?: readonly string[];
  readonly scoring?: WinningProductOpportunityBatchResult;
  readonly shortlist?: WinningProductShortlistResult;
} = {}) => new WinningHunterDiscoveryPipelineService({
  discoveryEngine: {
    discover: () => Promise.resolve(overrides.run ?? discoveryRun()),
  },
  normalizer: {
    normalizeRunWithWarnings: () => ({
      products: overrides.products ?? [product()],
      warnings: overrides.normalizationWarnings ?? [],
    }),
  } as never,
  scorer: {
    scoreBatch: () => overrides.scoring ?? {
      assessments: [assessment()],
      failures: [],
      evaluatedAt: SCORED_AT,
      scoringVersion: "SACP-WH-SCORE-v1",
    },
  } as never,
  ...(overrides.shortlist === undefined
    ? {}
    : {
        shortlistService: {
          createShortlist: () => overrides.shortlist,
        } as never,
      }),
});

describe("WinningHunter Discovery Pipeline Service", () => {
  it("runs a successful custom strategy pipeline and exposes capability boundaries", async () => {
    const result = await service().run(request());

    expect(result.status).toBe("COMPLETED");
    expect(result.strategyId).toBe("beauty-core");
    expect(result.discoveredCandidates).toBe(1);
    expect(result.normalizedProductsCount).toBe(1);
    expect(result.assessmentsCount).toBe(1);
    expect(result.actionableEntriesCount).toBe(1);
    expect(result.capabilities).toMatchObject({
      discovery: true,
      normalization: true,
      scoring: true,
      shortlist: true,
      supplierMatching: false,
      marginValidation: false,
      autoDsImport: false,
      shopifyDraftCreation: false,
      shopifyPublishing: false,
      automatedApproval: false,
    });
    expect(result.health.health).toBe("HEALTHY");
  });

  it("accepts a preset pipeline request", async () => {
    const result = await service().run(presetRequest());

    expect(result.strategyId).toBe("beauty-core");
    expect(result.stages.map((stage) => stage.stage)).toEqual([
      "DISCOVERY",
      "NORMALIZATION",
      "SCORING",
      "SHORTLIST",
    ]);
  });

  it("rejects conflicting, missing and non-chronological request inputs", async () => {
    await expect(service().run(request({ strategyPreset: "BEAUTY_CORE" }))).rejects.toThrow(
      WinningHunterConflictingPipelineStrategyError,
    );
    await expect(service().run(missingStrategyRequest())).rejects.toThrow(
      WinningHunterMissingPipelineStrategyError,
    );
    await expect(service().run(request({ scoringTimestamp: "not-a-date" }))).rejects.toThrow(
      WinningHunterInvalidPipelineTimestampError,
    );
    await expect(service().run(request({ scoringTimestamp: "2026-08-01T23:59:00.000Z" }))).rejects.toThrow(
      WinningHunterInvalidPipelineTimestampError,
    );
  });

  it("creates deterministic pipeline IDs and stable repeated output", async () => {
    const first = await service().run(request());
    const second = await service().run(request());

    expect(first.pipelineId).toBe(second.pipelineId);
    expect(first).toEqual(second);
    expect(first.pipelineId).toMatch(/^winninghunter-pipeline:/u);
  });

  it("propagates discovery warnings and degrades health", async () => {
    const result = await service({
      run: discoveryRun([discovered()], {
        status: "COMPLETED_WITH_WARNINGS",
        warnings: [{ executionUnitId: "beauty-core:US:BY", code: "CURSOR", message: "Repeated cursor." }],
      }),
    }).run(request());

    expect(result.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(result.health.health).toBe("DEGRADED");
    expect(result.warnings).toContain("[DISCOVERY] beauty-core:US:BY: Repeated cursor.");
  });

  it("fails and skips downstream stages after total discovery failure", async () => {
    const result = await service({
      run: discoveryRun([], { status: "FAILED", executionUnitsCompleted: 0, executionUnitsFailed: 1 }),
    }).run(request());

    expect(result.status).toBe("FAILED");
    expect(result.stages.map((stage) => stage.status)).toEqual([
      "FAILED",
      "SKIPPED",
      "SKIPPED",
      "SKIPPED",
    ]);
    expect(result.health.health).toBe("UNHEALTHY");
  });

  it("isolates partial normalization failures and continues", async () => {
    const result = await service({
      run: discoveryRun([discovered("winninghunter:shopify:111"), discovered("winninghunter:shopify:222")]),
      products: [product()],
      normalizationWarnings: ["Skipped malformed candidate winninghunter:shopify:222."],
    }).run(request());

    expect(result.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(result.failures).toContainEqual({
      stage: "NORMALIZATION",
      code: "NORMALIZATION_PARTIAL_FAILURE",
      message: "1 discovered candidates could not be normalized.",
    });
  });

  it("fails when no product can be normalized", async () => {
    const result = await service({
      products: [],
      normalizationWarnings: ["Skipped malformed candidate."],
    }).run(request());

    expect(result.status).toBe("FAILED");
    expect(result.stages.at(-1)?.status).toBe("SKIPPED");
    expect(result.failures.map((failure) => failure.code)).toContain("NORMALIZATION_EMPTY");
  });

  it("continues after partial scoring failures and fails when all scoring fails", async () => {
    const partial = await service({
      scoring: {
        assessments: [assessment()],
        failures: [{ productId: "bad", code: "BAD_PRODUCT", message: "Bad product." }],
        evaluatedAt: SCORED_AT,
        scoringVersion: "SACP-WH-SCORE-v1",
      },
    }).run(request());
    const failed = await service({
      scoring: {
        assessments: [],
        failures: [{ productId: "bad", code: "BAD_PRODUCT", message: "Bad product." }],
        evaluatedAt: SCORED_AT,
        scoringVersion: "SACP-WH-SCORE-v1",
      },
    }).run(request());

    expect(partial.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(partial.failures.map((failure) => failure.stage)).toContain("SCORING");
    expect(failed.status).toBe("FAILED");
    expect(failed.failures.map((failure) => failure.code)).toContain("SCORING_EMPTY");
  });

  it("pairs products and assessments by ID rather than array position", async () => {
    const result = await service({
      products: [product({ id: "b" }), product({ id: "a" })],
      scoring: {
        assessments: [assessment("a", { overallScore: 80 }), assessment("b", { overallScore: 90 })],
        failures: [],
        evaluatedAt: SCORED_AT,
        scoringVersion: "SACP-WH-SCORE-v1",
      },
    }).run(request());

    expect(result.shortlist.entries.map((entry) => `${entry.productId}:${entry.overallScore}`)).toEqual([
      "b:90",
      "a:80",
    ]);
  });

  it("warns for unmatched products, unmatched assessments and duplicate assessments", async () => {
    const result = await service({
      products: [product({ id: "matched" }), product({ id: "missing-assessment" })],
      scoring: {
        assessments: [
          assessment("matched", { overallScore: 70 }),
          assessment("matched", { overallScore: 95, evaluatedAt: "2026-08-02T00:01:30.000Z" }),
          assessment("orphan", { overallScore: 100 }),
        ],
        failures: [],
        evaluatedAt: SCORED_AT,
        scoringVersion: "SACP-WH-SCORE-v1",
      },
    }).run(request());

    expect(result.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(result.shortlist.entries[0]?.overallScore).toBe(95);
    expect(result.warnings).toEqual(expect.arrayContaining([
      "[SCORING] Duplicate assessment resolved for product matched.",
      "[SCORING] Ignored unmatched assessment for product orphan.",
      "[SCORING] No opportunity assessment matched normalized product missing-assessment.",
    ]));
  });

  it("maps shortlist failures and no-actionable shortlist to failed pipeline", async () => {
    const rejected = assessment("winninghunter:shopify:111", {
      recommendation: "REJECT",
      overallScore: 5,
    });
    const result = await service({
      scoring: {
        assessments: [rejected],
        failures: [],
        evaluatedAt: SCORED_AT,
        scoringVersion: "SACP-WH-SCORE-v1",
      },
    }).run(request());

    expect(result.status).toBe("FAILED");
    expect(result.shortlist.actionableEntries).toBe(0);
  });

  it("deduplicates warnings and orders failures by stage then product", async () => {
    const result = await service({
      scoring: {
        assessments: [assessment()],
        failures: [
          { productId: "z", code: "Z", message: "Duplicate message." },
          { productId: "a", code: "A", message: "Duplicate message." },
        ],
        evaluatedAt: SCORED_AT,
        scoringVersion: "SACP-WH-SCORE-v1",
      },
    }).run(request());

    expect(result.warnings.filter((warning) => warning.includes("Duplicate message."))).toHaveLength(2);
    expect(result.failures.map((failure) => failure.productId)).toEqual(["a", "z"]);
  });

  it("preserves custom scoring and shortlist configuration versions", async () => {
    const result = await service().run(request({
      shortlistConfig: {
        ...DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG,
        limits: {
          ...DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG.limits,
          priorityReview: 1,
        },
      },
    }));

    expect(result.scoringVersion).toBe("SACP-WH-SCORE-v1");
    expect(result.shortlistVersion).toBe("SACP-WH-SHORTLIST-v1");
  });

  it("returns defensive copies without mutating source products", async () => {
    const source = product();
    const before = JSON.stringify(source);
    const result = await service({ products: [source] }).run(request());
    const again = await service({ products: [source] }).run(request());

    expect(JSON.stringify(source)).toBe(before);
    expect(result.normalizedProducts).not.toBe(again.normalizedProducts);
    expect(result.shortlist.entries[0]?.nextRequiredActions).not.toBe(
      again.shortlist.entries[0]?.nextRequiredActions,
    );
  });

  it("supports real in-memory composition without external credentials", async () => {
    const pipeline = createInMemoryWinningHunterDiscoveryPipeline({
      routes: [
        {
          market: "US",
          niche: "BY",
          pages: [{ rows: [rawRow()], hasMore: false }],
        },
      ],
    });
    const result = await pipeline.run(presetRequest());

    expect(result.discoveryRun.candidates).toHaveLength(1);
    expect(result.normalizedProductsCount).toBe(1);
    expect(result.assessmentsCount).toBe(1);
    expect(result.shortlistEntriesCount).toBe(1);
    expect(result.capabilities.autoDsImport).toBe(false);
  });
});
