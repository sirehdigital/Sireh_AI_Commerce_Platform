import { describe, expect, it, vi } from "vitest";
import type { ProductBrandingResult } from "../../../ai-product/services/product-branding.service.js";
import type { ProductPricingRecommendation } from "../../../ai-product/services/product-pricing.service.js";
import type {
  NormalizedProduct,
  ProductAIAnalysis,
  ProductCopy,
  ProductRiskAssessment,
  ProductScoreBreakdown,
  ShopifyProductPayload,
} from "../../../ai-product/types/product.types.js";
import type {
  ProductPreparationAdapters,
  ProductPreparationInput,
} from "./product-preparation.types.js";
import { ProductPreparationWorkflowError } from "./product-preparation.types.js";
import {
  ProductPreparationWorkflow,
} from "./product-preparation.workflow.js";

const FIXED_DATE = new Date("2026-07-15T00:00:00.000Z");
const WORKFLOW_ID = "saie-product-preparation-test";

describe("ProductPreparationWorkflow", () => {
  it("creates a full proposal-only workflow output", () => {
    const proposal = new ProductPreparationWorkflow().prepareProposal(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(proposal).toMatchObject({
      workflowId: WORKFLOW_ID,
      executionMode: "proposal-only",
      approvalStatus: "required",
      mutationExecuted: false,
      publicationExecuted: false,
      readyForHumanReview: true,
      generatedAt: FIXED_DATE.toISOString(),
    });
    expect(proposal.safeUpdateProposal).toMatchObject({
      targetStatus: "DRAFT",
      templateSuffix: "lumora-product",
    });
    expect(proposal.shopifyMappingProposal?.status).toBe("draft");
  });

  it("supports a minimal requested-capability workflow", () => {
    const input = createInputWithoutAnalysis({
      requestedCapabilities: {
        normalize: true,
        assessRisk: true,
        generateBranding: false,
        generateCopy: false,
        recommendPricing: false,
        mapForShopify: false,
        prepareSafeUpdateProposal: false,
      },
    });

    const proposal = new ProductPreparationWorkflow().prepareProposal(input, FIXED_DATE, WORKFLOW_ID);

    expect(proposal.normalizedProduct).toBeDefined();
    expect(proposal.riskAssessment).toBeDefined();
    expect(proposal.analysis).toBeUndefined();
    expect(proposal.safeUpdateProposal).toBeUndefined();
    expect(proposal.readyForHumanReview).toBe(false);
  });

  it("uses deterministic step order", () => {
    const proposal = new ProductPreparationWorkflow().prepareProposal(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(proposal.completedSteps.map((step) => step.id)).toEqual([
      "ValidateInput",
      "NormalizeProduct",
      "AnalyzeProduct",
      "AssessProductRisk",
      "GenerateProductBranding",
      "GenerateProductCopy",
      "RecommendProductPricing",
      "MapProductForShopify",
      "PrepareSafeUpdateProposal",
      "RequireHumanApproval",
    ]);
  });

  it("always makes human approval the final completed step", () => {
    const proposal = new ProductPreparationWorkflow().prepareProposal(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(proposal.completedSteps.at(-1)?.id).toBe("RequireHumanApproval");
  });

  it("never includes PublishProduct", () => {
    const proposal = new ProductPreparationWorkflow().prepareProposal(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(JSON.stringify(proposal.completedSteps)).not.toContain("PublishProduct");
  });

  it("always reports no mutation or publication execution", () => {
    const proposal = new ProductPreparationWorkflow().prepareProposal(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(proposal.mutationExecuted).toBe(false);
    expect(proposal.publicationExecuted).toBe(false);
  });

  it("rejects unsupported execution modes", () => {
    const input = {
      ...createInput(),
      executionMode: "execute",
    } as unknown as ProductPreparationInput;

    expect(() => new ProductPreparationWorkflow().prepareProposal(input, FIXED_DATE, WORKFLOW_ID)).toThrow(
      ProductPreparationWorkflowError,
    );
  });

  it("rejects missing or invalid product data", () => {
    const input = createInput({
      sourceProduct: {
        ...createInput().sourceProduct,
        variants: [],
      },
    });

    expect(() => new ProductPreparationWorkflow().prepareProposal(input, FIXED_DATE, WORKFLOW_ID)).toThrow(
      "At least one product variant is required.",
    );
  });

  it("skips ProductAnalyzer when required context is unavailable", () => {
    const proposal = new ProductPreparationWorkflow().prepareProposal(
      createInputWithoutAnalysis(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(proposal.analysis).toBeUndefined();
    expect(proposal.skippedSteps).toContainEqual(
      expect.objectContaining({
        id: "AnalyzeProduct",
        reason: "analysis-not-executed",
      }),
    );
  });

  it("runs ProductAnalyzer only when explicit compatible context is supplied", () => {
    const withContext = new ProductPreparationWorkflow().prepareProposal(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );
    const withoutContext = new ProductPreparationWorkflow().prepareProposal(
      createInputWithoutAnalysis(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(withContext.analysis).toBeDefined();
    expect(withoutContext.analysis).toBeUndefined();
  });

  it("invokes existing services through injected adapters", () => {
    const adapters = createInjectedAdapters();
    const proposal = new ProductPreparationWorkflow(adapters).prepareProposal(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(adapters.normalizer.normalize).toHaveBeenCalledTimes(1);
    expect(adapters.analyzer.analyze).toHaveBeenCalledTimes(1);
    expect(adapters.riskAssessor.assess).toHaveBeenCalledTimes(1);
    expect(adapters.branding.buildBranding).toHaveBeenCalledTimes(1);
    expect(adapters.copy.generate).toHaveBeenCalledTimes(1);
    expect(adapters.pricing.recommend).toHaveBeenCalledTimes(1);
    expect(adapters.shopifyMapper.map).toHaveBeenCalledTimes(1);
    expect(proposal.safeUpdateProposal?.title).toBe("Mapped Lumora Product");
  });

  it("does not call ShopifyProductUpdateService", () => {
    const adapters = createInjectedAdapters();

    new ProductPreparationWorkflow(adapters).prepareProposal(createInput(), FIXED_DATE, WORKFLOW_ID);

    expect(adapters.shopifyProductUpdate).toEqual({ blocked: true });
  });

  it("generates preservation requirements from supplied Shopify state", () => {
    const proposal = new ProductPreparationWorkflow().prepareProposal(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );

    expect(proposal.preservationRequirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          subject: "variant SKUs",
          status: "required-for-future-execution",
          expectedValue: ["AUTO-RED-001"],
        }),
        expect.objectContaining({
          subject: "AutoDS-managed linkage by omission",
          status: "required-for-future-execution",
        }),
      ]),
    );
  });

  it("excludes SKU, variant, and inventory fields from the safe update proposal", () => {
    const proposal = new ProductPreparationWorkflow().prepareProposal(
      createInput(),
      FIXED_DATE,
      WORKFLOW_ID,
    );
    const serialized = JSON.stringify(proposal.safeUpdateProposal);

    expect(serialized).not.toContain("variantIds");
    expect(serialized).not.toContain("AUTO-RED-001");
    expect(serialized).not.toContain("inventoryItemIds");
    expect(proposal.safeUpdateProposal?.excludedMutations).toEqual(
      expect.arrayContaining(["variant recreation", "SKU mutation", "inventory item mutation"]),
    );
  });

  it("does not mutate input objects", () => {
    const input = createInput();
    const before = JSON.stringify(input);

    new ProductPreparationWorkflow().prepareProposal(input, FIXED_DATE, WORKFLOW_ID);

    expect(JSON.stringify(input)).toBe(before);
  });

  it("stops safely when a requested service fails", () => {
    const adapters = createInjectedAdapters();
    vi.mocked(adapters.normalizer.normalize).mockImplementationOnce(() => {
      throw new Error("normalizer unavailable");
    });

    expect(() => new ProductPreparationWorkflow(adapters).prepareProposal(createInput(), FIXED_DATE, WORKFLOW_ID))
      .toThrow("Product preparation failed safely: normalizer unavailable");
  });

  it("produces deterministic output for a fixed workflow ID and generatedAt", () => {
    const workflow = new ProductPreparationWorkflow();
    const first = workflow.prepareProposal(createInput(), FIXED_DATE, WORKFLOW_ID);
    const second = workflow.prepareProposal(createInput(), FIXED_DATE, WORKFLOW_ID);

    expect(second).toEqual(first);
  });
});

const createInput = (
  override: Partial<ProductPreparationInput> = {},
): ProductPreparationInput => ({
  executionMode: "proposal-only",
  sourceProduct: {
    sourceId: "supplier-lumora-red-light-scalp-massager",
    sourceUrl: "https://supplier.example/products/red-light-scalp-massager",
    title: "Lumora Revive Red Light Scalp Massager",
    description:
      "A rechargeable scalp-care device with soft massage bristles, vibration support, red-light routine support, and a liquid applicator for serum or oil use.",
    brand: "Lumora Beauty",
    category: "Hair Wellness",
    productType: "Hair Care Device",
    tags: ["Lumora Beauty", "Hair Wellness", "Scalp Massager"],
    images: [
      {
        id: "image-1",
        url: "https://cdn.example/lumora-scalp-massager.jpg",
        altText: "Lumora scalp massager",
        position: 1,
        isPrimary: true,
      },
    ],
    options: [{ name: "Color", values: ["Red"] }],
    variants: [
      {
        id: "supplier-variant-red",
        supplierVariantId: "supplier-red",
        sku: "AUTO-RED-001",
        title: "Red",
        optionValues: { Color: "Red" },
        cost: 72,
        suggestedPrice: 199,
        compareAtPrice: 299,
        currency: "MYR",
        inventoryQuantity: 10,
        available: true,
      },
    ],
    supplier: {
      source: "manual",
      supplierName: "Manual Supplier",
      supplierProductId: "supplier-lumora-red-light-scalp-massager",
      supplierProductUrl: "https://supplier.example/products/red-light-scalp-massager",
      shippingOrigin: "CN",
      estimatedDeliveryDaysMin: 7,
      estimatedDeliveryDaysMax: 14,
      supplierRating: 4.7,
      orderCount: 1200,
    },
    cost: {
      productCost: 72,
      shippingCost: 12,
      transactionCost: 4,
      advertisingCostEstimate: 20,
      totalLandedCost: 108,
      currency: "MYR",
    },
    currency: "MYR",
    targetMarkets: ["MY"],
  },
  brandContext: {
    brandName: "Lumora Beauty",
    brandVoice: "premium",
    targetMarkets: ["MY"],
    sellingCurrency: "MYR",
    preferredCollections: ["Hair Wellness"],
    templateSuffix: "lumora-product",
  },
  requestedCapabilities: {
    normalize: true,
    assessRisk: true,
    generateBranding: true,
    generateCopy: true,
    recommendPricing: true,
    mapForShopify: true,
    prepareSafeUpdateProposal: true,
  },
  optionalAnalysisContext: {
    score: createScore(),
    riskAssessment: createRisk(),
  },
  currentShopifyState: {
    productId: "gid://shopify/Product/8351602737199",
    handle: "lumora-revive-red-light-scalp-massager",
    variantIds: ["gid://shopify/ProductVariant/1"],
    variantSkus: ["AUTO-RED-001"],
    inventoryItemIds: ["gid://shopify/InventoryItem/1"],
    inventoryTracked: true,
    inventoryPolicies: ["DENY"],
    inventoryLocations: [
      {
        locationId: "gid://shopify/Location/1",
        locationName: "Shop",
        quantities: { "gid://shopify/InventoryItem/1": 10 },
      },
    ],
    currentStatus: "DRAFT",
  },
  ...override,
});

const createInputWithoutAnalysis = (
  override: Partial<Omit<ProductPreparationInput, "optionalAnalysisContext">> = {},
): ProductPreparationInput => {
  const input = createInput();

  return {
    executionMode: input.executionMode,
    sourceProduct: input.sourceProduct,
    brandContext: input.brandContext,
    requestedCapabilities: input.requestedCapabilities,
    ...(input.currentShopifyState === undefined ? {} : { currentShopifyState: input.currentShopifyState }),
    ...override,
  };
};

const createScore = (): ProductScoreBreakdown => ({
  demand: 72,
  competition: 55,
  profitability: 78,
  trend: 60,
  supplierReliability: 85,
  shipping: 72,
  marketingPotential: 76,
  brandability: 82,
  overall: 76,
});

const createRisk = (): ProductRiskAssessment => ({
  level: "low",
  score: 18,
  reasons: ["No significant risk indicators were detected from the available product data."],
  intellectualPropertyRisk: 0,
  restrictedProductRisk: 0,
  supplierRisk: 18,
  shippingRisk: 20,
  refundRisk: 14,
});

const createInjectedAdapters = (): ProductPreparationAdapters => {
  const normalized = createNormalizedProduct();
  const risk = createRisk();
  const analysis = createAnalysis();
  const branding = createBranding();
  const copy = createCopy();
  const pricing = createPricing();
  const mapping = createMapping();

  return {
    normalizer: {
      normalize: vi.fn((): NormalizedProduct => normalized),
    },
    analyzer: {
      analyze: vi.fn((): ProductAIAnalysis => analysis),
    },
    riskAssessor: {
      assess: vi.fn((): ProductRiskAssessment => risk),
    },
    branding: {
      buildBranding: vi.fn((): ProductBrandingResult => branding),
    },
    copy: {
      generate: vi.fn((): ProductCopy => copy),
    },
    pricing: {
      recommend: vi.fn((): ProductPricingRecommendation => pricing),
    },
    shopifyMapper: {
      map: vi.fn((): ShopifyProductPayload => mapping),
    },
    shopifyProductUpdate: { blocked: true },
  };
};

const createNormalizedProduct = (): NormalizedProduct => ({
  id: "product:manual:supplier-lumora-red-light-scalp-massager",
  source: "manual",
  externalId: "supplier-lumora-red-light-scalp-massager",
  status: "draft",
  title: "Lumora Revive Red Light Scalp Massager",
  description: "Structured fixture description.",
  brand: "Lumora Beauty",
  category: "Hair Wellness",
  productType: "Hair Care Device",
  tags: ["Lumora Beauty", "Hair Wellness"],
  targetMarkets: ["MY"],
  supplier: {
    source: "manual",
    supplierName: "Manual Supplier",
  },
  images: [{ id: "image-1", url: "https://cdn.example/image.jpg", position: 1 }],
  options: [{ name: "Color", values: ["Red"] }],
  variants: [
    {
      id: "supplier-variant-red",
      sku: "AUTO-RED-001",
      title: "Red",
      optionValues: { Color: "Red" },
      cost: 72,
      suggestedPrice: 199,
      compareAtPrice: 299,
      currency: "MYR",
      available: true,
    },
  ],
  cost: {
    productCost: 72,
    shippingCost: 12,
    transactionCost: 4,
    advertisingCostEstimate: 20,
    totalLandedCost: 108,
    currency: "MYR",
  },
  pricing: {
    cost: 108,
    sellingPrice: 199,
    compareAtPrice: 299,
    grossProfit: 91,
    grossMarginPercentage: 45.73,
    markupPercentage: 84.26,
    currency: "MYR",
  },
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
});

const createAnalysis = (): ProductAIAnalysis => ({
  summary: "Fixture analysis summary.",
  keyBenefits: ["Supports a relaxing scalp-care routine."],
  keyFeatures: ["Red light routine support", "Massage bristles"],
  audience: {
    primaryAudience: "Hair wellness shoppers",
    ageRanges: ["Broad adult consumer audience"],
    customerProblems: ["Maintaining a consistent scalp-care routine."],
    customerDesires: ["A relaxing hair-care ritual."],
    purchaseMotivations: ["Self-care"],
    objections: ["Price sensitivity"],
    recommendedMarkets: ["MY"],
  },
  marketingAngles: [
    {
      title: "Self-care routine",
      hook: "Refresh your scalp-care ritual.",
      coreBenefit: "Relaxing routine support.",
      emotionalOutcome: "Feels more consistent.",
      targetAudience: "Hair wellness shoppers",
      channels: ["shopify"],
      confidenceScore: 76,
    },
  ],
  score: createScore(),
  risks: createRisk(),
  recommendedSellingPrice: 199,
  recommendedCompareAtPrice: 299,
  recommendation: "test",
  reasoning: "Fixture reasoning.",
  analyzedAt: FIXED_DATE,
  model: "Fixture",
});

const createBranding = (): ProductBrandingResult => ({
  brandedTitle: "Mapped Lumora Product",
  positioningStatement: "For hair wellness shoppers.",
  uniqueSellingProposition: "Routine-friendly scalp care.",
  customerTransformation: "Feels more consistent with a hair-care routine.",
  primaryAudience: "Hair wellness shoppers",
  brandVoice: "premium",
  positioningTier: "premium",
  corePromise: "A calmer scalp-care ritual.",
  differentiationPoints: ["Liquid applicator support."],
  messagingPillars: [{ title: "Routine", message: "Support daily care.", supportingPoints: ["Simple use"] }],
  namingDirections: [{ direction: "Benefit-led", rationale: "Clear positioning.", exampleNames: ["Lumora Revive"] }],
  taglineOptions: ["A calmer ritual."],
  approvedClaims: ["Supports routine use."],
  avoidedClaims: ["Avoid medical claims."],
  confidenceScore: 80,
  reasoning: ["Fixture branding."],
});

const createCopy = (): ProductCopy => ({
  brandedTitle: "Mapped Lumora Product",
  subtitle: "A calm hair-care ritual.",
  shortDescription: "A premium scalp-care device for everyday self-care.",
  fullDescription: "Use as part of a general hair-care routine.",
  benefits: ["Relaxing scalp massage"],
  featureHighlights: ["Red light routine support"],
  howToUse: ["Use as directed."],
  faq: [{ question: "Is this a medical device?", answer: "No medical claim is made." }],
  callToAction: "Review the product details.",
  seoTitle: "Mapped Lumora Product | Hair Wellness",
  seoDescription: "A premium scalp-care device for everyday self-care.",
  seoKeywords: ["hair wellness"],
});

const createPricing = (): ProductPricingRecommendation => ({
  currency: "MYR",
  strategy: "premium",
  currentCost: 72,
  totalLandedCost: 108,
  currentSellingPrice: 199,
  recommendedSellingPrice: 199,
  recommendedCompareAtPrice: 299,
  grossProfit: 91,
  grossMarginPercentage: 45.73,
  markupPercentage: 84.26,
  minimumViablePrice: 180,
  targetProfitPerUnit: 91,
  priceIncreasePercentage: 0,
  confidenceScore: 80,
  confidenceLevel: "high",
  variantRecommendations: [
    {
      variantId: "supplier-variant-red",
      sku: "AUTO-RED-001",
      cost: 72,
      currentPrice: 199,
      recommendedPrice: 199,
      compareAtPrice: 299,
      grossProfit: 127,
      grossMarginPercentage: 63.82,
      markupPercentage: 176.39,
      available: true,
    },
  ],
  reasons: ["Fixture pricing."],
  warnings: [],
});

const createMapping = (): ShopifyProductPayload => ({
  title: "Mapped Lumora Product",
  descriptionHtml: "<p>A premium scalp-care device for everyday self-care.</p>",
  vendor: "Lumora Beauty",
  productType: "Hair Care Device",
  tags: ["Hair Wellness"],
  status: "draft",
  images: [{ src: "https://cdn.example/image.jpg", altText: "Mapped Lumora Product image 1", position: 1 }],
  options: [{ name: "Color", values: ["Red"] }],
  variants: [
    {
      sku: "AUTO-RED-001",
      title: "Red",
      optionValues: { Color: "Red" },
      price: 199,
      compareAtPrice: 299,
    },
  ],
  seo: {
    title: "Mapped Lumora Product | Hair Wellness",
    description: "A premium scalp-care device for everyday self-care.",
  },
});
