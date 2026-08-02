import { describe, expect, it } from "vitest";

import {
  WinningHunterInvalidShortlistConfigurationError,
  WinningHunterInvalidShortlistTimestampError,
  WinningHunterUnsupportedShortlistVersionError,
} from "../../domain/errors/winninghunter-product-discovery.errors.js";
import type { NormalizedWinningProduct } from "../../domain/models/normalized-winning-product.model.js";
import type {
  WinningProductOpportunityAssessment,
  WinningProductOpportunityRecommendation,
  WinningProductOpportunityRisk,
} from "../../domain/models/winning-product-opportunity-assessment.model.js";
import type {
  WinningProductShortlistConfig,
  WinningProductShortlistInput,
} from "../../domain/models/winning-product-shortlist.model.js";
import {
  DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG,
  validateShortlistConfig,
  WinningHunterProductShortlistService,
} from "./winninghunter-product-shortlist.service.js";

const GENERATED_AT = "2026-08-02T00:00:00.000Z";

const risk = (
  code: string,
  severity: WinningProductOpportunityRisk["severity"] = "LOW",
): WinningProductOpportunityRisk => ({
  code,
  severity,
  message: `${code} risk.`,
});

const product = (overrides: Partial<NormalizedWinningProduct> = {}): NormalizedWinningProduct => ({
  id: "winninghunter:shopify:111",
  source: "WINNING_HUNTER",
  title: "SirehLuxe Brush Capsule",
  description: "Body-contact beauty organizer for travel routines.",
  canonicalProductUrl: "https://example.test/products/brush-capsule",
  storeDomain: "example.test",
  productHandle: "brush-capsule",
  price: 24.95,
  currency: "USD",
  markets: ["US", "GB"],
  niches: ["BY"],
  marketSignals: [
    { market: "GB", niches: ["BY"], discoveryContexts: 1, adSignals: 2 },
    { market: "US", niches: ["BY"], discoveryContexts: 1, adSignals: 2 },
  ],
  creativeSignals: [
    { mediaType: "IMAGE", adCount: 2, percentageOfAds: 50 },
    { mediaType: "VIDEO", adCount: 2, percentageOfAds: 50 },
  ],
  advertisingSummary: {
    uniqueAds: 4,
    uniquePages: 2,
    activeSeenTotal: 10,
    longestObservedRunningDays: 20,
    highestPageActiveAds: 40,
    momentum: "RISING",
  },
  evidenceLevel: "STRONG",
  evidenceReasons: ["Observed across 2 target markets."],
  evidenceWarnings: [],
  recency: "CURRENT",
  firstDiscoveredAt: "2026-07-01T00:00:00.000Z",
  lastObservedAt: "2026-08-01T00:00:00.000Z",
  normalizedAt: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

const assessment = (
  productId = "winninghunter:shopify:111",
  overrides: Partial<WinningProductOpportunityAssessment> = {},
): WinningProductOpportunityAssessment => ({
  productId,
  overallScore: 85,
  maximumScore: 100,
  recommendation: "STRONG_CANDIDATE",
  components: [],
  adjustments: [],
  strengths: ["Observed through 4 unique advertisements."],
  risks: [],
  warnings: [],
  evidenceLevel: "STRONG",
  evaluatedAt: "2026-08-01T00:00:00.000Z",
  scoringVersion: "SACP-WH-SCORE-v1",
  ...overrides,
});

const input = (
  productOverrides: Partial<NormalizedWinningProduct> = {},
  assessmentOverrides: Partial<WinningProductOpportunityAssessment> = {},
): WinningProductShortlistInput => {
  const normalized = product(productOverrides);

  return {
    product: normalized,
    assessment: assessment(normalized.id, assessmentOverrides),
  };
};

const config = (
  overrides: Partial<WinningProductShortlistConfig> = {},
): WinningProductShortlistConfig => ({
  version: "SACP-WH-SHORTLIST-v1",
  limits: {
    priorityReview: 10,
    standardReview: 20,
    watchlist: 20,
    excluded: 20,
    total: 50,
  },
  includeExcluded: true,
  ...overrides,
});

const create = (
  inputs: readonly WinningProductShortlistInput[],
  cfg: WinningProductShortlistConfig = config(),
) => new WinningHunterProductShortlistService().createShortlist(inputs, GENERATED_AT, cfg);

describe("WinningHunter Product Shortlist Service", () => {
  it("provides defensive default config and validates config rules", () => {
    const service = new WinningHunterProductShortlistService();
    const defaultConfig = service.getDefaultConfig();

    expect(defaultConfig).toEqual(DEFAULT_WINNING_PRODUCT_SHORTLIST_CONFIG);
    (defaultConfig.limits as Record<string, number>).priorityReview = 1;
    expect(service.getDefaultConfig().limits.priorityReview).toBe(10);
    expect(() => validateShortlistConfig(config({ version: " " }))).toThrow(
      WinningHunterInvalidShortlistConfigurationError,
    );
    expect(() => validateShortlistConfig(config({ version: "SACP-WH-SHORTLIST-v2" }))).toThrow(
      WinningHunterUnsupportedShortlistVersionError,
    );
    expect(() =>
      validateShortlistConfig(config({ limits: { ...config().limits, priorityReview: -1 } })),
    ).toThrow(WinningHunterInvalidShortlistConfigurationError);
    expect(() =>
      validateShortlistConfig(config({ limits: { ...config().limits, total: 201 } })),
    ).toThrow(WinningHunterInvalidShortlistConfigurationError);
    expect(() =>
      validateShortlistConfig(config({ limits: { ...config().limits, total: 5, priorityReview: 6 } })),
    ).toThrow(WinningHunterInvalidShortlistConfigurationError);
    expect(() =>
      validateShortlistConfig(
        config({ minimumScores: { priorityReview: 70, standardReview: 80, watchlist: 40 } }),
      ),
    ).toThrow(WinningHunterInvalidShortlistConfigurationError);
  });

  it("classifies recommendations into deterministic shortlist buckets", () => {
    const result = create([
      input({ id: "p1" }, { productId: "p1", recommendation: "STRONG_CANDIDATE" }),
      input({ id: "p2" }, { productId: "p2", recommendation: "REVIEW", overallScore: 70 }),
      input({ id: "p3" }, { productId: "p3", recommendation: "WATCHLIST", overallScore: 50 }),
      input({ id: "p4" }, { productId: "p4", recommendation: "REJECT", overallScore: 20 }),
    ]);

    expect(result.priorityReview).toHaveLength(1);
    expect(result.standardReview).toHaveLength(1);
    expect(result.watchlist).toHaveLength(1);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0]?.merchantDecision).toBe("PENDING_REVIEW");
  });

  it("applies risk-aware guardrails with visible warnings", () => {
    const result = create([
      input(
        { id: "insufficient", evidenceLevel: "INSUFFICIENT" },
        {
          productId: "insufficient",
          risks: [risk("INSUFFICIENT_EVIDENCE", "HIGH")],
        },
      ),
      input({ id: "stale", recency: "STALE" }, { productId: "stale" }),
      input({ id: "high-risk" }, { productId: "high-risk", risks: [risk("POLICY", "HIGH")] }),
      input(
        { id: "no-ads", advertisingSummary: { ...product().advertisingSummary, uniqueAds: 0 } },
        { productId: "no-ads" },
      ),
      input({ id: "bad-url", canonicalProductUrl: "not-a-url" }, { productId: "bad-url" }),
    ]);

    expect(result.entries.find((entry) => entry.productId === "insufficient")?.bucket).toBe("WATCHLIST");
    expect(result.entries.find((entry) => entry.productId === "stale")?.bucket).toBe("STANDARD_REVIEW");
    expect(result.entries.find((entry) => entry.productId === "high-risk")?.bucket).toBe("STANDARD_REVIEW");
    expect(result.entries.find((entry) => entry.productId === "no-ads")?.bucket).toBe("EXCLUDED");
    expect(result.entries.find((entry) => entry.productId === "bad-url")?.bucket).toBe("EXCLUDED");
    expect(result.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(result.warnings).toEqual(expect.arrayContaining([
      "bad-url: Missing or malformed product identity forced shortlist exclusion.",
      "no-ads: No valid advertising evidence forced shortlist exclusion.",
    ]));
  });

  it("generates deterministic IDs, pending decisions and required actions", () => {
    const entry = create([input()]).entries[0];

    expect(entry?.id).toBe("winninghunter-shortlist:winninghunter:shopify:111:SACP-WH-SCORE-v1");
    expect(entry?.merchantDecision).toBe("PENDING_REVIEW");
    expect(entry?.nextRequiredActions.map((action) => action.code)).toEqual([
      "MERCHANT_REVIEW",
      "SUPPLIER_MATCHING",
      "LANDED_COST_VALIDATION",
      "MARGIN_VALIDATION",
      "SHIPPING_VALIDATION",
      "PRODUCT_SAFETY_REVIEW",
      "TRADEMARK_REVIEW",
    ]);
    expect(entry?.nextRequiredActions.every((action) => action.completed === false)).toBe(true);
    expect(entry?.nextRequiredActions.slice(0, 5).map((action) => action.priority)).toEqual([
      "HIGH",
      "HIGH",
      "HIGH",
      "HIGH",
      "HIGH",
    ]);
  });

  it("adds platform, creative and monitoring actions without duplicates", () => {
    const entry = create([
      input(
        {
          description: "Before-and-after anti aging body treatment.",
          recency: "AGING",
          evidenceLevel: "LIMITED",
          creativeSignals: [{ mediaType: "IMAGE", adCount: 1, percentageOfAds: 100 }],
          advertisingSummary: { ...product().advertisingSummary, momentum: "MIXED" },
        },
        {
          risks: [risk("WEAK_CREATIVE_DIVERSITY")],
          warnings: ["creative needs review"],
          recommendation: "WATCHLIST",
          overallScore: 45,
          evidenceLevel: "LIMITED",
        },
      ),
    ]).entries[0];

    expect(entry?.bucket).toBe("WATCHLIST");
    expect(entry?.nextRequiredActions.map((action) => action.code)).toEqual([
      "MERCHANT_REVIEW",
      "SUPPLIER_MATCHING",
      "LANDED_COST_VALIDATION",
      "MARGIN_VALIDATION",
      "SHIPPING_VALIDATION",
      "PRODUCT_SAFETY_REVIEW",
      "TRADEMARK_REVIEW",
      "PLATFORM_POLICY_REVIEW",
      "CREATIVE_REVIEW",
      "EVIDENCE_MONITORING",
    ]);
    expect(new Set(entry?.nextRequiredActions.map((action) => action.code)).size).toBe(
      entry?.nextRequiredActions.length,
    );
  });

  it("limits excluded products to merchant review plus monitoring when applicable", () => {
    const entry = create([
      input(
        { evidenceLevel: "INSUFFICIENT", advertisingSummary: { ...product().advertisingSummary, uniqueAds: 0 } },
        { recommendation: "REJECT", overallScore: 10, risks: [risk("INSUFFICIENT_EVIDENCE", "HIGH")] },
      ),
    ]).entries[0];

    expect(entry?.bucket).toBe("EXCLUDED");
    expect(entry?.nextRequiredActions.map((action) => action.code)).toEqual([
      "MERCHANT_REVIEW",
      "PRODUCT_SAFETY_REVIEW",
      "TRADEMARK_REVIEW",
      "EVIDENCE_MONITORING",
    ]);
  });

  it("ranks entries deterministically with sequential ranks and tie-breakers", () => {
    const result = create([
      input({ id: "watch" }, { productId: "watch", recommendation: "WATCHLIST", overallScore: 90 }),
      input({ id: "priority-b", evidenceLevel: "MODERATE" }, { productId: "priority-b", overallScore: 80 }),
      input({ id: "priority-a", evidenceLevel: "STRONG" }, { productId: "priority-a", overallScore: 80 }),
      input({ id: "priority-c", evidenceLevel: "STRONG", recency: "RECENT", markets: ["US"], marketSignals: [{ market: "US", niches: ["BY"], discoveryContexts: 1, adSignals: 1 }] }, { productId: "priority-c", overallScore: 80 }),
      input({ id: "priority-d", evidenceLevel: "STRONG", recency: "RECENT" }, { productId: "priority-d", overallScore: 80 }),
      input({ id: "excluded" }, { productId: "excluded", recommendation: "REJECT", overallScore: 100 }),
    ]);

    expect(result.entries.map((entry) => entry.productId)).toEqual([
      "priority-a",
      "priority-d",
      "priority-c",
      "priority-b",
      "watch",
      "excluded",
    ]);
    expect(result.entries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("applies bucket and total limits with truncation warnings", () => {
    const result = create(
      [
        input({ id: "p1" }, { productId: "p1" }),
        input({ id: "p2" }, { productId: "p2" }),
        input({ id: "s1" }, { productId: "s1", recommendation: "REVIEW", overallScore: 70 }),
        input({ id: "w1" }, { productId: "w1", recommendation: "WATCHLIST", overallScore: 50 }),
      ],
      config({ limits: { priorityReview: 1, standardReview: 1, watchlist: 1, excluded: 1, total: 2 } }),
    );

    expect(result.entries.map((entry) => entry.productId)).toEqual(["p1", "s1"]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      "1 PRIORITY_REVIEW entries were omitted by bucket limit.",
      "1 shortlist entries were omitted by total limit.",
    ]));
  });

  it("handles duplicate products deterministically and merges evidence", () => {
    const result = create([
      input({ id: "dupe" }, { productId: "dupe", overallScore: 60, strengths: ["old"], evaluatedAt: "2026-08-01T00:00:00.000Z" }),
      input({ id: "dupe" }, { productId: "dupe", overallScore: 90, strengths: ["new"], warnings: ["new warning"], evaluatedAt: "2026-08-01T01:00:00.000Z" }),
      input({ id: "latest" }, { productId: "latest", overallScore: 80, evaluatedAt: "2026-08-01T00:00:00.000Z" }),
      input({ id: "latest" }, { productId: "latest", overallScore: 80, evaluatedAt: "2026-08-01T02:00:00.000Z", warnings: ["latest retained"] }),
    ]);

    expect(result.entries.find((entry) => entry.productId === "dupe")?.overallScore).toBe(90);
    expect(result.entries.find((entry) => entry.productId === "dupe")?.strengths).toEqual(["new", "old"]);
    expect(result.entries.find((entry) => entry.productId === "latest")?.warnings).toContain("latest retained");
    expect(result.warnings).toEqual(expect.arrayContaining([
      "Duplicate shortlist input detected for product dupe.",
      "Duplicate shortlist input detected for product latest.",
    ]));
    expect(result.inputAssessments).toBe(4);
    expect(result.includedEntries).toBe(2);
  });

  it("isolates malformed pairs and reports typed failures", () => {
    const malformedProduct = {
      ...product({ id: "malformed" }),
      markets: undefined,
    } as unknown as NormalizedWinningProduct;
    const result = create([
      input(),
      { product: product({ id: "mismatch" }), assessment: assessment("other") },
      { product: product({ id: "bad-score" }), assessment: assessment("bad-score", { overallScore: 101 }) },
      { product: malformedProduct, assessment: assessment("malformed") },
      { product: product({ id: "bad-rec" }), assessment: assessment("bad-rec", { recommendation: "BUY" as WinningProductOpportunityRecommendation }) },
    ]);

    expect(result.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(result.failures.map((failure) => failure.code).sort()).toEqual([
      "WinningHunterInvalidShortlistInputError",
      "WinningHunterMalformedOpportunityAssessmentError",
      "WinningHunterMalformedOpportunityAssessmentError",
      "WinningHunterProductAssessmentMismatchError",
    ]);
  });

  it("supports completed, completed-with-warnings and failed statuses with counts", () => {
    const completed = create([input()]);
    const withWarnings = create([input(), { product: product({ id: "bad" }), assessment: assessment("other") }]);
    const failed = create([{ product: product({ id: "bad" }), assessment: assessment("other") }]);

    expect(completed.status).toBe("COMPLETED");
    expect(withWarnings.status).toBe("COMPLETED_WITH_WARNINGS");
    expect(failed.status).toBe("FAILED");
    expect(completed.actionableEntries).toBe(1);
    expect(completed.excludedEntries).toBe(0);
  });

  it("supports includeExcluded false without treating omitted entries as actionable", () => {
    const result = create(
      [input({ id: "keep" }, { productId: "keep" }), input({ id: "drop" }, { productId: "drop", recommendation: "REJECT", overallScore: 1 })],
      config({ includeExcluded: false }),
    );

    expect(result.entries.map((entry) => entry.productId)).toEqual(["keep"]);
    expect(result.excludedEntries).toBe(0);
    expect(result.actionableEntries).toBe(1);
    expect(result.warnings).toContain("Excluded entries were omitted by shortlist configuration.");
  });

  it("preserves strengths, risks and warnings in deterministic order", () => {
    const entry = create([
      input(
        {},
        {
          strengths: ["z strength", "a strength"],
          risks: [risk("Z_RISK"), risk("A_RISK")],
          warnings: ["z warning", "a warning"],
        },
      ),
    ]).entries[0];

    expect(entry?.strengths).toEqual(["a strength", "z strength"]);
    expect(entry?.risks.map((item) => item.code)).toEqual(["A_RISK", "Z_RISK"]);
    expect(entry?.warnings).toEqual(["a warning", "z warning"]);
  });

  it("returns defensive copies and does not mutate inputs", () => {
    const service = new WinningHunterProductShortlistService();
    const source = input();
    const before = JSON.stringify(source);
    const first = service.createShortlist([source], GENERATED_AT);
    const second = service.createShortlist([source], GENERATED_AT);

    expect(first).toEqual(second);
    expect(first.entries).not.toBe(second.entries);
    expect(first.entries[0]?.nextRequiredActions).not.toBe(second.entries[0]?.nextRequiredActions);
    expect(JSON.stringify(source)).toBe(before);
  });

  it("uses deterministic shortlist IDs and exposes versions", () => {
    const first = create([input({ id: "b" }, { productId: "b" }), input({ id: "a" }, { productId: "a" })]);
    const second = create([input({ id: "a" }, { productId: "a" }), input({ id: "b" }, { productId: "b" })]);

    expect(first.shortlistId).toBe(second.shortlistId);
    expect(first.shortlistId).toMatch(/^winninghunter-shortlist:/u);
    expect(first.scoringVersion).toBe("SACP-WH-SCORE-v1");
    expect(first.shortlistVersion).toBe("SACP-WH-SHORTLIST-v1");
  });

  it("validates generated timestamp and applies custom minimum score thresholds", () => {
    const service = new WinningHunterProductShortlistService();

    expect(() => service.createShortlist([input()], "not-a-date")).toThrow(
      WinningHunterInvalidShortlistTimestampError,
    );

    const result = service.createShortlist(
      [input({}, { overallScore: 75 })],
      GENERATED_AT,
      config({ minimumScores: { priorityReview: 80, standardReview: 60, watchlist: 40 } }),
    );

    expect(result.entries[0]?.bucket).toBe("STANDARD_REVIEW");
    expect(result.warnings).toContain(
      "winninghunter:shopify:111: Shortlist minimum score threshold downgraded bucket.",
    );
  });

  it("updates merchant decisions purely without changing evidence", () => {
    const service = new WinningHunterProductShortlistService();
    const entry = service.createShortlist([input()], GENERATED_AT).entries[0];

    expect(entry).toBeDefined();

    const updated = service.updateMerchantDecision(entry!, "APPROVED_FOR_VALIDATION");

    expect(updated.merchantDecision).toBe("APPROVED_FOR_VALIDATION");
    expect(updated.id).toBe(entry?.id);
    expect(updated.assessmentVersion).toBe(entry?.assessmentVersion);
    expect(updated.nextRequiredActions).not.toBe(entry?.nextRequiredActions);
  });
});
