import { describe, expect, it } from "vitest";
import type {
  ProductRiskLevel,
  ProductScoreBreakdown,
  RawProductInput,
} from "../types/product.types.js";
import { AIProductEngineService } from "./ai-product-engine.service.js";
import type {
  PricingConfidenceLevel,
  PricingStrategy,
} from "./product-pricing.service.js";

const VALID_RISK_LEVELS: readonly ProductRiskLevel[] = ["low", "medium", "high", "critical"];
const VALID_RECOMMENDATIONS = ["strong-buy", "test", "watch", "reject"] as const;
const VALID_BRAND_VOICES = [
  "premium",
  "confident",
  "friendly",
  "minimal",
  "expert",
  "playful",
  "practical",
  "natural",
  "bold",
  "trustworthy",
] as const;
const VALID_POSITIONING_TIERS = ["value", "mass-market", "premium", "luxury", "specialist"] as const;
const VALID_PRICING_STRATEGIES: readonly PricingStrategy[] = [
  "cost-plus",
  "market-entry",
  "balanced",
  "premium",
  "luxury",
  "specialist",
];
const VALID_CONFIDENCE_LEVELS: readonly PricingConfidenceLevel[] = ["low", "medium", "high"];
const UNSAFE_CLAIMS = [
  "guaranteed",
  "clinically proven",
  "number one",
  "best in the world",
  "fda approved",
  "miracle",
] as const;

describe("AIProductEngineService", () => {
  it("processes a complete beauty product through the full deterministic pipeline", () => {
    const engine = new AIProductEngineService();
    const result = engine.process(buildBeautyProductFixture());

    expect(result.record).toBeDefined();
    expect(result.normalizedProduct).toBeDefined();
    expect(result.score).toBeDefined();
    expect(result.risk).toBeDefined();
    expect(result.analysis).toBeDefined();
    expect(result.branding).toBeDefined();
    expect(result.copy).toBeDefined();
    expect(result.pricing).toBeDefined();
    expect(result.shopifyPayload).toBeDefined();

    expect(result.normalizedProduct.id).toBe("product:autods:lumora-radiance-brush-001");
    expect(result.normalizedProduct.status).toBe("draft");
    expect(result.normalizedProduct.title).toBe("Lumora Radiance Facial Cleansing Brush");
    expect(result.normalizedProduct.brand).toBe("Lumora");
    expect(result.normalizedProduct.category).toBe("Beauty & Face Care");
    expect(result.normalizedProduct.productType).toBe("Beauty & Face Care");
    expect(result.normalizedProduct.tags).toEqual(["Beauty", "Skincare", "Face Care"]);
    expect(result.normalizedProduct.targetMarkets).toEqual(["US", "UK", "AU", "CA"]);
    expect(result.normalizedProduct.images).toHaveLength(3);
    expect(result.normalizedProduct.images.map((image) => image.position)).toEqual([1, 2, 3]);
    expect(result.normalizedProduct.images.filter((image) => image.isPrimary)).toHaveLength(1);
    expect(result.normalizedProduct.options).toEqual([{ name: "Color", values: ["Rose", "White"] }]);
    expect(result.normalizedProduct.variants.map((variant) => variant.sku)).toEqual([
      "LUM-BRUSH-ROSE",
      "LUM-BRUSH-WHITE",
    ]);
    expect(result.normalizedProduct.variants[1]?.inventoryQuantity).toBe(0);
    assertFiniteNonNegative(result.normalizedProduct.cost?.totalLandedCost);
    assertValidDate(result.normalizedProduct.createdAt);
    assertValidDate(result.normalizedProduct.updatedAt);

    assertScoreBreakdown(result.score);
    assertRiskAssessment(result.risk);
    expect(result.risk.restrictedProductRisk).toBeLessThan(35);
    expect(result.risk.reasons.join(" ").toLowerCase()).not.toContain("legal clearance");

    expect(result.analysis.summary).not.toHaveLength(0);
    expect(result.analysis.keyBenefits).toEqual(expect.any(Array));
    expect(result.analysis.keyFeatures).toEqual(expect.any(Array));
    expect(result.analysis.audience.primaryAudience).not.toHaveLength(0);
    expect(result.analysis.marketingAngles).toEqual(expect.any(Array));
    expect(result.analysis.score).toEqual(result.score);
    expect(result.analysis.risks).toEqual(result.risk);
    expect(VALID_RECOMMENDATIONS).toContain(result.analysis.recommendation);
    expect(result.analysis.reasoning).not.toHaveLength(0);
    assertOptionalFiniteNonNegative(result.analysis.recommendedSellingPrice);
    assertOptionalFiniteNonNegative(result.analysis.recommendedCompareAtPrice);
    expect(result.analysis.model).not.toHaveLength(0);
    assertValidDate(result.analysis.analyzedAt);

    expect(result.branding.brandedTitle).not.toHaveLength(0);
    expect(result.branding.positioningStatement).not.toHaveLength(0);
    expect(result.branding.uniqueSellingProposition).not.toHaveLength(0);
    expect(result.branding.customerTransformation).not.toHaveLength(0);
    expect(result.branding.primaryAudience).not.toHaveLength(0);
    expect(VALID_BRAND_VOICES).toContain(result.branding.brandVoice);
    expect(VALID_POSITIONING_TIERS).toContain(result.branding.positioningTier);
    expect(result.branding.corePromise).not.toHaveLength(0);
    expect(result.branding.differentiationPoints.length).toBeGreaterThan(0);
    expect(result.branding.messagingPillars.length).toBeGreaterThan(0);
    expect(result.branding.namingDirections.length).toBeGreaterThan(0);
    expect(result.branding.taglineOptions.length).toBeGreaterThan(0);
    assertScoreRange(result.branding.confidenceScore);
    expect(result.branding.reasoning.length).toBeGreaterThan(0);
    expect(containsUnsafeClaim(customerFacingBrandingText(result))).toBe(false);

    expect(result.copy.brandedTitle).not.toHaveLength(0);
    expect(result.copy.subtitle).not.toHaveLength(0);
    expect(result.copy.shortDescription).not.toHaveLength(0);
    expect(result.copy.fullDescription).not.toHaveLength(0);
    expect(result.copy.benefits.length).toBeGreaterThan(0);
    expect(result.copy.featureHighlights.length).toBeGreaterThan(0);
    expect(result.copy.howToUse?.length).toBeGreaterThan(0);
    expect(result.copy.faq.length).toBeGreaterThan(0);
    expect(result.copy.callToAction).not.toHaveLength(0);
    expect(result.copy.seoTitle).not.toHaveLength(0);
    expect(result.copy.seoDescription).not.toHaveLength(0);
    expect(result.copy.seoKeywords.length).toBeGreaterThan(0);
    expect(customerFacingCopyText(result)).not.toMatch(/<\/?[a-z][\s\S]*>/iu);
    expect(customerFacingCopyText(result).toLowerCase()).not.toContain("risk score");
    expect(customerFacingCopyText(result).toLowerCase()).not.toContain("gross margin percentage");
    expect(customerFacingCopyText(result).toLowerCase()).not.toContain("supplier metadata");
    expect(customerFacingCopyText(result)).not.toContain("SACP Rule Engine");
    expect(containsUnsafeClaim(customerFacingCopyText(result))).toBe(false);
    expect(customerFacingCopyText(result).toLowerCase()).not.toContain("limited stock");
    expect(customerFacingCopyText(result).toLowerCase()).not.toContain("act fast");

    expect(result.pricing.currency).toBe("USD");
    expect(VALID_PRICING_STRATEGIES).toContain(result.pricing.strategy);
    assertFiniteNonNegative(result.pricing.totalLandedCost);
    assertFiniteNonNegative(result.pricing.recommendedSellingPrice);
    expect(result.pricing.recommendedSellingPrice).toBeGreaterThanOrEqual(result.pricing.totalLandedCost);
    expect(
      result.pricing.recommendedCompareAtPrice === 0 ||
        result.pricing.recommendedCompareAtPrice > result.pricing.recommendedSellingPrice,
    ).toBe(true);
    assertFiniteNumber(result.pricing.grossProfit);
    assertFiniteNumber(result.pricing.grossMarginPercentage);
    assertFiniteNumber(result.pricing.markupPercentage);
    assertFiniteNonNegative(result.pricing.minimumViablePrice);
    assertScoreRange(result.pricing.confidenceScore);
    expect(VALID_CONFIDENCE_LEVELS).toContain(result.pricing.confidenceLevel);
    expect(result.pricing.variantRecommendations).toHaveLength(result.normalizedProduct.variants.length);
    for (const recommendation of result.pricing.variantRecommendations) {
      assertFiniteNonNegative(recommendation.recommendedPrice);
      assertFiniteNonNegative(recommendation.compareAtPrice);
      expect(recommendation.recommendedPrice).toBeGreaterThanOrEqual(recommendation.cost);
    }
    expect(result.pricing.reasons.length).toBeGreaterThan(0);
    expect(result.pricing.warnings).toEqual(expect.any(Array));

    expect(result.shopifyPayload.title).not.toHaveLength(0);
    expect(result.shopifyPayload.status).toBe("draft");
    expect(result.shopifyPayload.vendor).toBe("Lumora");
    expect(result.shopifyPayload.productType).toBe("Beauty & Face Care");
    expect(isDedupedCaseInsensitive(result.shopifyPayload.tags)).toBe(true);
    expect(result.shopifyPayload.images.length).toBeGreaterThan(0);
    expect(result.shopifyPayload.options.length).toBeGreaterThan(0);
    expect(result.shopifyPayload.variants.length).toBeGreaterThan(0);
    expect(result.shopifyPayload.seo?.title).not.toHaveLength(0);
    expect(result.shopifyPayload.seo?.description).not.toHaveLength(0);
    expect(result.shopifyPayload.descriptionHtml).toContain("<p>");
    expect(result.shopifyPayload.descriptionHtml).toContain("<ul>");
    expect(result.shopifyPayload.descriptionHtml.toLowerCase()).not.toContain("<script");
    expect(result.shopifyPayload.descriptionHtml.toLowerCase()).not.toContain("<iframe");
    expect(result.shopifyPayload.descriptionHtml.toLowerCase()).not.toContain("javascript:");
    expect(result.shopifyPayload.descriptionHtml.toLowerCase()).not.toContain("onclick=");
    expect(result.shopifyPayload.descriptionHtml).not.toContain('<script>alert("test")</script>');
    expect(shopifyPayloadText(result).toLowerCase()).not.toContain("overall score");
    expect(shopifyPayloadText(result).toLowerCase()).not.toContain("total landed cost");
    expect(shopifyPayloadText(result).toLowerCase()).not.toContain("gross margin");
    expect(shopifyPayloadText(result).toLowerCase()).not.toContain("pricing confidence");
    expect(shopifyPayloadText(result)).not.toContain("SACP Rule Engine");
    expect(shopifyPayloadText(result)).not.toContain("lumora-radiance-brush-001");
    expect(shopifyPayloadText(result)).not.toContain("variant-rose");
    expect(shopifyPayloadText(result)).not.toContain("sourceBatch");

    expect(result.record.normalizedProduct).toEqual(result.normalizedProduct);
    expect(result.record.aiAnalysis).toEqual(result.analysis);
    expect(result.record.generatedCopy).toEqual(result.copy);
    expect(result.record.version).toBe(1);
    expect(result.record.createdAt).toEqual(result.normalizedProduct.createdAt);
    expect(result.record.updatedAt).toEqual(result.normalizedProduct.updatedAt);
  });

  it("keeps deterministic business outputs stable across repeated executions", () => {
    const engine = new AIProductEngineService();
    const first = engine.process(buildBeautyProductFixture());
    const second = engine.process(buildBeautyProductFixture());

    expect(first.normalizedProduct.id).toBe(second.normalizedProduct.id);
    expect(first.score).toEqual(second.score);
    expect(first.risk).toEqual(second.risk);
    expect(first.analysis.recommendation).toBe(second.analysis.recommendation);
    expect(first.branding.brandedTitle).toBe(second.branding.brandedTitle);
    expect(first.branding.brandVoice).toBe(second.branding.brandVoice);
    expect(first.branding.positioningTier).toBe(second.branding.positioningTier);
    expect(first.copy).toEqual(second.copy);
    expect(first.pricing.strategy).toBe(second.pricing.strategy);
    expect(first.pricing.recommendedSellingPrice).toBe(second.pricing.recommendedSellingPrice);
    expect(first.shopifyPayload.title).toBe(second.shopifyPayload.title);
    expect(first.shopifyPayload.tags).toEqual(second.shopifyPayload.tags);
    expect(first.shopifyPayload.variants).toEqual(second.shopifyPayload.variants);
  });

  it("processes minimal incomplete data without producing invalid required fields", () => {
    const engine = new AIProductEngineService();

    expect(() => engine.process(buildMinimalProductFixture())).not.toThrow();

    const result = engine.process(buildMinimalProductFixture());

    expect(result.normalizedProduct.title).toBe("Untitled Product");
    expect(result.normalizedProduct.targetMarkets).toEqual(["US", "UK", "AU", "CA"]);
    assertScoreBreakdown(result.score);
    assertRiskAssessment(result.risk);
    assertFiniteNonNegative(result.pricing.recommendedSellingPrice);
    assertFiniteNonNegative(result.pricing.totalLandedCost);
    expect(result.shopifyPayload).toBeDefined();
    expect(result.shopifyPayload.title).not.toHaveLength(0);
    expect(result.shopifyPayload.status).toBe("draft");
    expect(result.shopifyPayload.descriptionHtml).toEqual(expect.any(String));
    expect(result.shopifyPayload.variants).toEqual([]);
  });
});

function buildBeautyProductFixture(): RawProductInput {
  return {
    source: "autods",
    externalId: "lumora-radiance-brush-001",
    title: "   Lumora   Radiance   Facial Cleansing Brush   ",
    description:
      'A soft silicone facial cleansing brush designed for gentle daily face-care routines.\n\nIt supports cleansing around the T-zone, cheeks, and chin without making medical or treatment claims.\n\n<script>alert("test")</script>',
    productUrl: "https://example.com/products/lumora-radiance-brush",
    supplier: {
      source: "autods",
      supplierName: "ClearGlow Supplies",
      supplierProductId: "supplier-lumora-brush-001",
      supplierProductUrl: "https://example.com/suppliers/products/lumora-brush",
      supplierStoreUrl: "https://example.com/suppliers/clearglow",
      shippingOrigin: "MY",
      estimatedDeliveryDaysMin: 6,
      estimatedDeliveryDaysMax: 12,
      supplierRating: 4.7,
      orderCount: 1280,
    },
    images: [
      {
        id: "image-side",
        url: "https://example.com/products/lumora-brush-side.jpg",
        altText: " Lumora brush side view ",
        position: 3,
      },
      {
        id: "",
        url: "https://example.com/products/lumora-brush-front.jpg",
        altText: " Lumora brush front view ",
        position: 2,
        isPrimary: true,
      },
      {
        id: "image-duplicate",
        url: "https://example.com/products/lumora-brush-front.jpg",
        altText: "Duplicate front view",
        position: 1,
      },
      {
        id: "image-box",
        url: "https://example.com/products/lumora-brush-box.jpg",
        altText: "Lumora brush box",
        position: 8,
      },
    ],
    options: [
      {
        name: " Color ",
        values: [" Rose ", "White", "rose", " WHITE "],
      },
    ],
    variants: [
      {
        id: "variant-rose",
        supplierVariantId: "supplier-variant-rose",
        sku: "LUM-BRUSH-ROSE",
        title: " Rose ",
        optionValues: { Color: " Rose " },
        cost: 12.5,
        suggestedPrice: 34.99,
        compareAtPrice: 44.99,
        currency: "USD",
        inventoryQuantity: 48,
        weight: 180,
        weightUnit: "g",
        imageUrl: "https://example.com/products/lumora-brush-front.jpg",
        available: true,
      },
      {
        id: "variant-white",
        supplierVariantId: "supplier-variant-white",
        sku: "LUM-BRUSH-WHITE",
        title: "White",
        optionValues: { Color: "White" },
        cost: 13.25,
        suggestedPrice: 36.99,
        compareAtPrice: 46.99,
        currency: "USD",
        inventoryQuantity: -4,
        weight: 185,
        weightUnit: "g",
        imageUrl: "https://example.com/products/lumora-brush-side.jpg",
        available: true,
      },
    ],
    tags: ["Beauty", "Skincare", "beauty", " Face Care "],
    category: " Beauty & Face Care ",
    brand: " Lumora ",
    targetMarkets: ["US", "UK", "AU", "CA"],
    metadata: {
      shippingCost: 4.5,
      transactionCost: 1.15,
      advertisingCostEstimate: 5,
      sourceBatch: "fixture-only",
    },
    capturedAt: new Date("2026-01-15T10:00:00.000Z"),
  };
}

function buildMinimalProductFixture(): RawProductInput {
  return {
    source: "manual",
    title: "   ",
    description: "",
    supplier: {
      source: "manual",
      supplierName: "  ",
    },
    images: [],
    options: [],
    variants: [],
    tags: [],
    targetMarkets: [],
    metadata: {},
    capturedAt: new Date("2026-01-20T10:00:00.000Z"),
  };
}

function assertScoreBreakdown(score: ProductScoreBreakdown): void {
  assertScoreRange(score.demand);
  assertScoreRange(score.competition);
  assertScoreRange(score.profitability);
  assertScoreRange(score.trend);
  assertScoreRange(score.supplierReliability);
  assertScoreRange(score.shipping);
  assertScoreRange(score.marketingPotential);
  assertScoreRange(score.brandability);
  assertScoreRange(score.overall);
}

function assertRiskAssessment(risk: {
  readonly intellectualPropertyRisk: number;
  readonly restrictedProductRisk: number;
  readonly supplierRisk: number;
  readonly shippingRisk: number;
  readonly refundRisk: number;
  readonly score: number;
  readonly level: ProductRiskLevel;
  readonly reasons: readonly string[];
}): void {
  assertScoreRange(risk.intellectualPropertyRisk);
  assertScoreRange(risk.restrictedProductRisk);
  assertScoreRange(risk.supplierRisk);
  assertScoreRange(risk.shippingRisk);
  assertScoreRange(risk.refundRisk);
  assertScoreRange(risk.score);
  expect(VALID_RISK_LEVELS).toContain(risk.level);
  expect(risk.reasons.length).toBeGreaterThan(0);
}

function assertFiniteNumber(value: number | undefined): void {
  expect(value).toEqual(expect.any(Number));
  expect(Number.isFinite(value)).toBe(true);
}

function assertFiniteNonNegative(value: number | undefined): void {
  assertFiniteNumber(value);
  expect(value).toBeGreaterThanOrEqual(0);
}

function assertOptionalFiniteNonNegative(value: number | undefined): void {
  if (value !== undefined) {
    assertFiniteNonNegative(value);
  }
}

function assertScoreRange(value: number): void {
  assertFiniteNumber(value);
  expect(value).toBeGreaterThanOrEqual(0);
  expect(value).toBeLessThanOrEqual(100);
}

function assertValidDate(value: Date): void {
  expect(value).toBeInstanceOf(Date);
  expect(Number.isFinite(value.getTime())).toBe(true);
}

function isDedupedCaseInsensitive(values: readonly string[]): boolean {
  return new Set(values.map((value) => value.toLowerCase())).size === values.length;
}

function containsUnsafeClaim(value: string): boolean {
  const normalized = value.toLowerCase();
  return UNSAFE_CLAIMS.some((claim) => normalized.includes(claim));
}

function customerFacingBrandingText(result: ReturnType<AIProductEngineService["process"]>): string {
  return [
    result.branding.brandedTitle,
    result.branding.positioningStatement,
    result.branding.uniqueSellingProposition,
    result.branding.customerTransformation,
    result.branding.corePromise,
    ...result.branding.differentiationPoints,
    ...result.branding.messagingPillars.flatMap((pillar) => [
      pillar.title,
      pillar.message,
      ...pillar.supportingPoints,
    ]),
    ...result.branding.taglineOptions,
    ...result.branding.approvedClaims,
  ].join(" ");
}

function customerFacingCopyText(result: ReturnType<AIProductEngineService["process"]>): string {
  return [
    result.copy.brandedTitle,
    result.copy.subtitle ?? "",
    result.copy.shortDescription,
    result.copy.fullDescription,
    ...result.copy.benefits,
    ...result.copy.featureHighlights,
    ...(result.copy.howToUse ?? []),
    ...result.copy.faq.flatMap((item) => [item.question, item.answer]),
    result.copy.callToAction,
    result.copy.seoTitle,
    result.copy.seoDescription,
    ...result.copy.seoKeywords,
  ].join(" ");
}

function shopifyPayloadText(result: ReturnType<AIProductEngineService["process"]>): string {
  return JSON.stringify(result.shopifyPayload);
}
