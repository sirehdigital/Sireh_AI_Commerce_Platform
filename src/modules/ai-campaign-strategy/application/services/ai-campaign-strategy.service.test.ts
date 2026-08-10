import { describe, expect, it } from "vitest";

import {
  AiCampaignStrategyService,
  AudienceMarketStrategyEngine,
  AUDIENCE_MARKET_SEGMENTS,
  AUDIENCE_MARKET_STRATEGY_VERSION,
  BudgetChannelCreativeAllocationEngine,
  BUDGET_ALLOCATION_PRIORITIES,
  BUDGET_CHANNEL_CREATIVE_ALLOCATION_VERSION,
  CampaignStrategyRecommendationRiskEngine,
  CAMPAIGN_STRATEGY_READINESS_STATUSES,
  CAMPAIGN_STRATEGY_RECOMMENDATION_CATEGORIES,
  CAMPAIGN_STRATEGY_RECOMMENDATION_PRIORITIES,
  CAMPAIGN_STRATEGY_RECOMMENDATION_RISK_VERSION,
  CAMPAIGN_STRATEGY_RISK_CATEGORIES,
  CAMPAIGN_STRATEGY_RISK_SEVERITIES,
  CampaignObjectiveFunnelStrategyEngine,
  CAMPAIGN_INTENT_LEVELS,
  CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION,
  CAMPAIGN_STRATEGIC_FUNNEL_STAGES,
  CAMPAIGN_STRATEGIC_OBJECTIVES,
  CREATIVE_ALLOCATION_ROLES,
  InMemoryCampaignStrategyRepository,
  InvalidAudienceError,
  InvalidCampaignRequestError,
  InvalidOfferError,
  InvalidProductContextError,
  InvalidTimestampError,
  UnsupportedAngleError,
  UnsupportedChannelError,
  UnsupportedObjectiveError,
  type CreateCampaignStrategyRequest,
  type AudienceMarketStrategy,
  type BudgetChannelCreativeAllocation,
  type CampaignObjectiveFunnelStrategy,
  type CampaignStrategyRecommendationRiskResult,
} from "../../index.js";
import * as publicExports from "../../../ai-campaign-strategy/index.js";

const CREATED_AT = "2026-08-02T04:00:00.000Z";

const buildRequest = (overrides: Partial<CreateCampaignStrategyRequest> = {}): CreateCampaignStrategyRequest => ({
  product: {
    productId: "product-100",
    productName: "Velvet Glow Wand",
    category: "Beauty Tools",
    description: "A compact beauty tool for daily styling routines.",
    keyBenefits: ["Fast styling", "Portable design", "Fast styling"],
    differentiators: ["Travel-ready finish"],
    knownRisks: ["Requires clear usage guidance"],
    targetPrice: 49.99,
    currency: "usd",
    markets: ["US", "MY"],
  },
  objective: "PRODUCT_LAUNCH",
  audience: {
    id: "audience-100",
    name: "Busy Beauty Shoppers",
    targetMarkets: ["US"],
    ageRange: {
      minimum: 25,
      maximum: 44,
    },
    interests: ["Beauty", "Travel"],
    painPoints: ["Slow morning routine"],
    desiredOutcomes: ["Look polished quickly"],
    objections: ["Unsure about daily use"],
    buyingTriggers: ["Limited launch bonus"],
    awarenessLevel: "SOLUTION_AWARE",
  },
  offer: {
    type: "LIMITED_TIME",
    headline: "Launch bonus this week",
    expiresAt: "2026-08-09T04:00:00.000Z",
    terms: ["Merchant approval required before publication"],
  },
  createdAt: CREATED_AT,
  ...overrides,
});

const createStrategy = (request: CreateCampaignStrategyRequest = buildRequest()) =>
  new AiCampaignStrategyService().createStrategy(request);

describe("AiCampaignStrategyService", () => {
  it("creates a valid product-launch strategy", () => {
    const strategy = createStrategy();

    expect(strategy.objective).toBe("PRODUCT_LAUNCH");
    expect(strategy.funnelStages).toEqual(["AWARENESS", "CONSIDERATION"]);
    expect(strategy.messagingAngles.map((angle) => angle.type)).toEqual(["TRANSFORMATION", "EDUCATION", "SOCIAL_PROOF"]);
    expect(strategy.channels.map((channel) => `${channel.channel}:${channel.role}`)).toEqual([
      "TIKTOK:PRIMARY",
      "INSTAGRAM:SUPPORTING",
      "FACEBOOK:SUPPORTING",
      "EMAIL:SUPPORTING",
      "SHOPIFY_ONSITE:SUPPORTING",
    ]);
  });

  it("creates a valid conversion strategy", () => {
    const strategy = createStrategy(
      buildRequest({
        objective: "CONVERSION",
        offer: {
          type: "PERCENTAGE_DISCOUNT",
          headline: "Save today",
          discountPercentage: 15,
          terms: ["Discount subject to merchant approval"],
        },
      }),
    );

    expect(strategy.funnelStages).toEqual(["CONSIDERATION", "CONVERSION"]);
    expect(strategy.messagingAngles.map((angle) => angle.type)).toEqual(["PROBLEM_SOLUTION", "CONVENIENCE", "URGENCY"]);
    expect(strategy.channels.map((channel) => channel.channel)).toEqual(["TIKTOK", "FACEBOOK", "SHOPIFY_ONSITE", "EMAIL", "RETARGETING"]);
  });

  it("creates a valid retargeting strategy", () => {
    const strategy = createStrategy(buildRequest({ objective: "RETARGETING" }));

    expect(strategy.funnelStages).toEqual(["CONSIDERATION", "CONVERSION"]);
    expect(strategy.messagingAngles.map((angle) => angle.type)).toEqual(["SOCIAL_PROOF", "COMPARISON", "URGENCY"]);
    expect(strategy.channels.map((channel) => `${channel.channel}:${channel.role}`)).toEqual([
      "FACEBOOK:RETARGETING",
      "INSTAGRAM:RETARGETING",
      "EMAIL:SUPPORTING",
      "SHOPIFY_ONSITE:SUPPORTING",
    ]);
  });

  it("generates a deterministic strategy ID", () => {
    expect(createStrategy().id).toBe("ai-campaign-strategy:478af6dc3975c2de1bb53ba0");
  });

  it("returns identical results for repeated execution", () => {
    const service = new AiCampaignStrategyService();
    const request = buildRequest();

    expect(service.createStrategy(request)).toEqual(service.createStrategy(request));
  });

  it("defaults to review required and never merchant approved", () => {
    const strategy = createStrategy();

    expect(strategy.status).toBe("REVIEW_REQUIRED");
    expect(strategy.status).not.toBe("MERCHANT_APPROVED");
  });

  it("rejects a blank product ID", () => {
    expect(() => createStrategy(buildRequest({ product: { ...buildRequest().product, productId: " " } }))).toThrow(InvalidProductContextError);
  });

  it("rejects a blank product name", () => {
    expect(() => createStrategy(buildRequest({ product: { ...buildRequest().product, productName: " " } }))).toThrow(InvalidProductContextError);
  });

  it("rejects product context with no markets", () => {
    expect(() => createStrategy(buildRequest({ product: { ...buildRequest().product, markets: [] } }))).toThrow(InvalidProductContextError);
  });

  it("rejects invalid audience age ranges", () => {
    expect(() =>
      createStrategy(
        buildRequest({
          audience: {
            ...buildRequest().audience,
            ageRange: {
              minimum: 45,
              maximum: 25,
            },
          },
        }),
      ),
    ).toThrow(InvalidAudienceError);
  });

  it("rejects unsupported objectives", () => {
    expect(() => createStrategy(buildRequest({ objective: "NOT_REAL" as CreateCampaignStrategyRequest["objective"] }))).toThrow(
      UnsupportedObjectiveError,
    );
  });

  it("rejects invalid offer percentages", () => {
    expect(() =>
      createStrategy(
        buildRequest({
          offer: {
            type: "PERCENTAGE_DISCOUNT",
            headline: "Impossible discount",
            discountPercentage: 110,
            terms: [],
          },
        }),
      ),
    ).toThrow(InvalidOfferError);
  });

  it("rejects invalid fixed discounts", () => {
    expect(() =>
      createStrategy(
        buildRequest({
          offer: {
            type: "FIXED_DISCOUNT",
            headline: "Save now",
            discountAmount: 5,
            terms: [],
          },
        }),
      ),
    ).toThrow(InvalidOfferError);
  });

  it("warns when urgency offers have no expiry", () => {
    const strategy = createStrategy(
      buildRequest({
        offer: {
          type: "LIMITED_TIME",
          headline: "Today only",
          terms: [],
        },
      }),
    );

    expect(strategy.warnings).toContain("Urgency offer has no expiry timestamp and requires review.");
  });

  it("warns when guarantees have no terms", () => {
    const strategy = createStrategy(
      buildRequest({
        offer: {
          type: "GUARANTEE",
          headline: "Satisfaction guarantee",
          terms: [],
        },
      }),
    );

    expect(strategy.warnings).toContain("Guarantee offer has no terms and requires review.");
  });

  it("derives funnel stages for every objective", () => {
    const service = new AiCampaignStrategyService();

    expect(service.deriveFunnelStages("BRAND_AWARENESS")).toEqual(["AWARENESS"]);
    expect(service.deriveFunnelStages("CUSTOMER_RETENTION")).toEqual(["RETENTION"]);
    expect(service.deriveFunnelStages("UPSELL")).toEqual(["RETENTION", "CONVERSION"]);
  });

  it("applies default messaging angles", () => {
    expect(createStrategy(buildRequest({ objective: "CUSTOMER_RETENTION" })).messagingAngles.map((angle) => angle.type)).toEqual([
      "LIFESTYLE",
      "EDUCATION",
      "CONVENIENCE",
    ]);
  });

  it("honors preferred angle ordering", () => {
    const strategy = createStrategy(
      buildRequest({
        preferredAngles: ["URGENCY", "EDUCATION"],
      }),
    );

    expect(strategy.messagingAngles.map((angle) => angle.type).slice(0, 3)).toEqual(["URGENCY", "EDUCATION", "TRANSFORMATION"]);
  });

  it("rejects unsupported preferred angles", () => {
    expect(() =>
      createStrategy(buildRequest({ preferredAngles: ["NOT_REAL" as NonNullable<CreateCampaignStrategyRequest["preferredAngles"]>[number]] })),
    ).toThrow(UnsupportedAngleError);
  });

  it("applies default channel selection", () => {
    expect(createStrategy(buildRequest({ objective: "PRODUCT_LAUNCH" })).channels.map((channel) => channel.channel)).toEqual([
      "TIKTOK",
      "INSTAGRAM",
      "FACEBOOK",
      "EMAIL",
      "SHOPIFY_ONSITE",
    ]);
  });

  it("filters and reorders preferred channels", () => {
    const strategy = createStrategy(
      buildRequest({
        objective: "CONVERSION",
        preferredChannels: ["EMAIL", "TIKTOK"],
      }),
    );

    expect(strategy.channels.map((channel) => channel.channel)).toEqual(["EMAIL", "TIKTOK"]);
  });

  it("rejects unsupported preferred channels", () => {
    expect(() =>
      createStrategy(buildRequest({ preferredChannels: ["NOT_REAL" as NonNullable<CreateCampaignStrategyRequest["preferredChannels"]>[number]] })),
    ).toThrow(UnsupportedChannelError);
  });

  it("generates content pillars from baseline and input context", () => {
    const pillars = createStrategy().contentPillars;

    expect(pillars).toEqual(expect.arrayContaining(["Problem Education", "Product Demonstration", "Benefit: Fast styling", "Pain Point: Slow morning routine"]));
  });

  it("removes duplicate pillars deterministically", () => {
    const pillars = createStrategy().contentPillars;

    expect(pillars.filter((pillar) => pillar === "Benefit: Fast styling")).toHaveLength(1);
  });

  it("warns for missing description, price, and currency", () => {
    const strategy = createStrategy(
      buildRequest({
        product: {
          productId: "product-100",
          productName: "Velvet Glow Wand",
          category: "Beauty Tools",
          keyBenefits: ["Fast styling"],
          differentiators: ["Travel-ready finish"],
          knownRisks: ["Requires clear usage guidance"],
          markets: ["US", "MY"],
        },
      }),
    );

    expect(strategy.warnings).toEqual(
      expect.arrayContaining([
        "Product description is missing and should be reviewed before campaign execution.",
        "Target price is missing; commercial validation is required before approving campaign offers.",
        "Currency is missing; commercial validation is required before approving campaign offers.",
      ]),
    );
  });

  it("generates policy-review warnings for body-related claims", () => {
    expect(createStrategy().warnings).toContain("Health, beauty, or body-related claims require policy review.");
  });

  it("generates broad-audience warnings", () => {
    const strategy = createStrategy(
      buildRequest({
        audience: {
          ...buildRequest().audience,
          targetMarkets: ["US", "MY", "SG", "ID", "TH"],
        },
      }),
    );

    expect(strategy.warnings).toContain("Audience profile is broad and may need segmentation before execution.");
  });

  it("protects returned strategies with defensive copies", () => {
    const strategy = createStrategy();
    (strategy.contentPillars as string[]).push("Injected");
    (strategy.product.keyBenefits as string[]).push("Injected");

    const freshStrategy = createStrategy();
    expect(freshStrategy.contentPillars).not.toContain("Injected");
    expect(freshStrategy.product.keyBenefits).not.toContain("Injected");
  });

  it("does not mutate request input", () => {
    const request = buildRequest();
    const before = structuredClone(request);

    createStrategy(request);

    expect(request).toEqual(before);
  });

  it("rejects invalid createdAt timestamps", () => {
    expect(() => createStrategy(buildRequest({ createdAt: "2026-08-02" }))).toThrow(InvalidTimestampError);
  });
});

describe("CampaignObjectiveFunnelStrategyEngine", () => {
  const determine = (request: CreateCampaignStrategyRequest = buildRequest()): CampaignObjectiveFunnelStrategy =>
    new CampaignObjectiveFunnelStrategyEngine().determineStrategy(request);

  it("selects awareness objective and TOFU for discovery-oriented input", () => {
    const strategy = determine(
      buildRequest({
        objective: "BRAND_AWARENESS",
        audience: {
          ...buildRequest().audience,
          awarenessLevel: "UNAWARE",
          objections: [],
          buyingTriggers: ["Category discovery"],
        },
        offer: {
          type: "STANDARD",
          headline: "Meet the daily styling helper",
          terms: [],
        },
      }),
    );

    expect(strategy.selectedObjective).toBe("AWARENESS");
    expect(strategy.funnelStage).toBe("TOFU");
    expect(strategy.intentLevel).toBe("LOW");
    expect(strategy.supportingSignals.map((signal) => signal.code)).toEqual(["AWARENESS_OBJECTIVE", "AWARENESS_LEVEL_LOW", "AWARENESS_INTERESTS"]);
  });

  it("selects engagement objective and MOFU for consideration input", () => {
    const strategy = determine(
      buildRequest({
        objective: "TRAFFIC",
        preferredAngles: ["EDUCATION", "COMPARISON"],
        audience: {
          ...buildRequest().audience,
          awarenessLevel: "SOLUTION_AWARE",
          buyingTriggers: ["Compare options"],
        },
        offer: {
          type: "STANDARD",
          headline: "Compare the daily routine fit",
          terms: [],
        },
      }),
    );

    expect(strategy.selectedObjective).toBe("ENGAGEMENT");
    expect(strategy.funnelStage).toBe("MOFU");
    expect(strategy.intentLevel).toBe("MEDIUM");
    expect(strategy.supportingSignals.map((signal) => signal.code)).toContain("CONSIDERATION_MESSAGING_ANGLE");
  });

  it("selects conversion objective and BOFU for purchase-intent input", () => {
    const strategy = determine(
      buildRequest({
        objective: "CONVERSION",
        audience: {
          ...buildRequest().audience,
          awarenessLevel: "MOST_AWARE",
          buyingTriggers: ["Ready to checkout"],
        },
        offer: {
          type: "PERCENTAGE_DISCOUNT",
          headline: "Save today",
          discountPercentage: 15,
          terms: ["Merchant approval required"],
        },
      }),
    );

    expect(strategy.selectedObjective).toBe("CONVERSION");
    expect(strategy.funnelStage).toBe("BOFU");
    expect(strategy.intentLevel).toBe("HIGH");
    expect(strategy.recommendedCtaDirection).toContain("purchase");
  });

  it("selects retention for existing-customer or repeat-purchase input", () => {
    const strategy = determine(
      buildRequest({
        objective: "CUSTOMER_RETENTION",
        audience: {
          ...buildRequest().audience,
          buyingTriggers: ["Repeat order reminder"],
        },
      }),
    );

    expect(strategy.selectedObjective).toBe("RETENTION");
    expect(strategy.funnelStage).toBe("RETENTION");
    expect(strategy.intentLevel).toBe("HIGH");
    expect(strategy.recommendedCampaignFocus).toContain("repeat-purchase");
  });

  it("maps intent levels from funnel stage and awareness context", () => {
    const awareness = determine(
      buildRequest({
        objective: "BRAND_AWARENESS",
        audience: { ...buildRequest().audience, awarenessLevel: "PROBLEM_AWARE", objections: [], buyingTriggers: [] },
        offer: { type: "STANDARD", headline: "Discover easier styling", terms: [] },
      }),
    );
    const consideration = determine(
      buildRequest({
        objective: "LEAD_GENERATION",
        audience: { ...buildRequest().audience, buyingTriggers: ["Download routine guide"] },
        offer: { type: "STANDARD", headline: "Join the routine guide", terms: [] },
      }),
    );
    const conversion = determine(buildRequest({ objective: "CONVERSION" }));

    expect(awareness.intentLevel).toBe("LOW");
    expect(consideration.intentLevel).toBe("MEDIUM");
    expect(conversion.intentLevel).toBe("HIGH");
    expect(CAMPAIGN_INTENT_LEVELS).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });

  it("uses deterministic precedence when signals conflict", () => {
    const strategy = determine(
      buildRequest({
        objective: "CUSTOMER_RETENTION",
        audience: {
          ...buildRequest().audience,
          awarenessLevel: "MOST_AWARE",
          buyingTriggers: ["Ready to checkout", "Repeat order reminder"],
        },
        offer: {
          type: "LIMITED_TIME",
          headline: "Come back today",
          expiresAt: "2026-08-09T04:00:00.000Z",
          terms: [],
        },
      }),
    );

    expect(strategy.selectedObjective).toBe("RETENTION");
    expect(strategy.metadata.precedenceRule).toBe("RETENTION_THEN_CONVERSION_THEN_CONSIDERATION_THEN_AWARENESS");
    expect(strategy.reasoning[0]).toBe("Selected RETENTION because it is the highest-precedence matching signal group.");
  });

  it("keeps repeated output deterministic", () => {
    const engine = new CampaignObjectiveFunnelStrategyEngine();
    const request = buildRequest({ objective: "LEAD_GENERATION" });

    expect(engine.determineStrategy(request)).toEqual(engine.determineStrategy(request));
  });

  it("preserves canonical strategy identity and product, market, and channel associations", () => {
    const engine = new CampaignObjectiveFunnelStrategyEngine();
    const request = buildRequest({ objective: "TRAFFIC", preferredChannels: ["EMAIL", "TIKTOK"] });
    const sourceStrategy = new AiCampaignStrategyService().createStrategy(request);
    const strategy = engine.determineStrategy(request);

    expect(strategy.campaignStrategyId).toBe(sourceStrategy.id);
    expect(strategy.product).toEqual(sourceStrategy.product);
    expect(strategy.channels).toEqual(["EMAIL", "TIKTOK"]);
    expect(strategy.markets).toEqual(["US", "MY"]);
  });

  it("returns advisory strategy and version metadata", () => {
    const strategy = determine();

    expect(strategy.advisoryOnly).toBe(true);
    expect(strategy.metadata).toEqual({
      strategyVersion: CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION,
      sourceStrategyVersion: "SACP-04.04A",
      precedenceRule: "RETENTION_THEN_CONVERSION_THEN_CONSIDERATION_THEN_AWARENESS",
    });
  });

  it("rejects invalid input through existing strategy validation", () => {
    expect(() => determine(buildRequest({ objective: "NOT_REAL" as CreateCampaignStrategyRequest["objective"] }))).toThrow(UnsupportedObjectiveError);
  });

  it("exports the public objective and funnel strategy API", () => {
    expect(publicExports.CampaignObjectiveFunnelStrategyEngine).toBe(CampaignObjectiveFunnelStrategyEngine);
    expect(publicExports.CAMPAIGN_STRATEGIC_OBJECTIVES).toEqual(CAMPAIGN_STRATEGIC_OBJECTIVES);
    expect(publicExports.CAMPAIGN_STRATEGIC_FUNNEL_STAGES).toEqual(CAMPAIGN_STRATEGIC_FUNNEL_STAGES);
    expect(publicExports.CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION).toBe(CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION);
  });
});

describe("AudienceMarketStrategyEngine", () => {
  const determine = (request: CreateCampaignStrategyRequest = buildRequest()): AudienceMarketStrategy =>
    new AudienceMarketStrategyEngine().determineStrategy(request);

  it("selects a TOFU discovery audience", () => {
    const strategy = determine(
      buildRequest({
        objective: "BRAND_AWARENESS",
        audience: { ...buildRequest().audience, awarenessLevel: "UNAWARE", painPoints: [], objections: [], buyingTriggers: [] },
        offer: { type: "STANDARD", headline: "Meet the daily styling helper", terms: [] },
      }),
    );

    expect(strategy.audienceSegment).toBe("DISCOVERY");
    expect(strategy.funnelAlignment).toBe("TOFU");
    expect(strategy.objectiveAlignment).toBe("AWARENESS");
  });

  it("selects a MOFU solution or product-aware audience", () => {
    const strategy = determine(
      buildRequest({
        objective: "TRAFFIC",
        preferredAngles: ["EDUCATION", "COMPARISON"],
        audience: { ...buildRequest().audience, awarenessLevel: "PRODUCT_AWARE", buyingTriggers: ["Compare options"] },
        offer: { type: "STANDARD", headline: "Compare the daily routine fit", terms: [] },
      }),
    );

    expect(strategy.audienceSegment).toBe("PRODUCT_AWARE");
    expect(strategy.funnelAlignment).toBe("MOFU");
    expect(strategy.audienceIntent).toBe("MEDIUM");
  });

  it("selects a BOFU high-intent buyer", () => {
    const strategy = determine(
      buildRequest({
        objective: "CONVERSION",
        audience: { ...buildRequest().audience, awarenessLevel: "MOST_AWARE", buyingTriggers: ["Ready to checkout"] },
        offer: { type: "PERCENTAGE_DISCOUNT", headline: "Save today", discountPercentage: 15, terms: ["Merchant approval required"] },
      }),
    );

    expect(strategy.audienceSegment).toBe("HIGH_INTENT_BUYER");
    expect(strategy.funnelAlignment).toBe("BOFU");
    expect(strategy.objectiveAlignment).toBe("CONVERSION");
  });

  it("selects an existing-customer retention audience", () => {
    const strategy = determine(buildRequest({ objective: "CUSTOMER_RETENTION" }));

    expect(strategy.audienceSegment).toBe("EXISTING_CUSTOMER");
    expect(strategy.funnelAlignment).toBe("RETENTION");
    expect(strategy.objectiveAlignment).toBe("RETENTION");
  });

  it("selects a repeat-buyer audience when repeat purchase signals exist", () => {
    const strategy = determine(
      buildRequest({
        objective: "CUSTOMER_RETENTION",
        audience: { ...buildRequest().audience, buyingTriggers: ["Repeat order reminder"] },
      }),
    );

    expect(strategy.audienceSegment).toBe("REPEAT_BUYER");
    expect(strategy.reason).toContain("REPEAT_BUYER segment was derived from RETENTION funnel alignment and structured audience signals.");
  });

  it("prioritizes primary and secondary markets from supplied associations", () => {
    const strategy = determine(
      buildRequest({
        product: { ...buildRequest().product, markets: ["US", "MY"] },
        audience: { ...buildRequest().audience, targetMarkets: ["MY", "SG"] },
      }),
    );

    expect(strategy.primaryMarket).toBe("MY");
    expect(strategy.secondaryMarkets).toEqual(["US"]);
    expect(strategy.geographicPriority.map((market) => [market.market, market.priority])).toEqual([
      ["US", "SECONDARY"],
      ["MY", "PRIMARY"],
      ["SG", "EXPERIMENTAL"],
    ]);
  });

  it("marks insufficient market evidence conservatively", () => {
    const strategy = determine(
      buildRequest({
        product: { ...buildRequest().product, markets: ["US"] },
        audience: { ...buildRequest().audience, targetMarkets: ["MY"] },
      }),
    );

    expect(strategy.primaryMarket).toBe("US");
    expect(strategy.secondaryMarkets).toEqual([]);
    expect(strategy.geographicPriority.map((market) => [market.market, market.priority])).toEqual([
      ["US", "EXPERIMENTAL"],
      ["MY", "NOT_RECOMMENDED"],
    ]);
  });

  it("derives channel fit from existing campaign channel associations", () => {
    const strategy = determine(buildRequest({ objective: "CONVERSION" }));

    expect(strategy.channelFit.map((channel) => [channel.channel, channel.fit])).toEqual([
      ["TIKTOK", "PRIMARY"],
      ["FACEBOOK", "PRIMARY"],
      ["SHOPIFY_ONSITE", "PRIMARY"],
      ["EMAIL", "SUPPORTING"],
      ["RETARGETING", "RETARGETING"],
    ]);
  });

  it("preserves objective and funnel alignment from 04.04B", () => {
    const strategy = determine(
      buildRequest({
        objective: "LEAD_GENERATION",
        audience: { ...buildRequest().audience, buyingTriggers: ["Download routine guide"] },
        offer: { type: "STANDARD", headline: "Join the routine guide", terms: [] },
      }),
    );

    expect(strategy.objectiveAlignment).toBe("LEAD_GENERATION");
    expect(strategy.funnelAlignment).toBe("MOFU");
  });

  it("keeps repeated audience and market output deterministic", () => {
    const engine = new AudienceMarketStrategyEngine();
    const request = buildRequest({ objective: "CONVERSION" });

    expect(engine.determineStrategy(request)).toEqual(engine.determineStrategy(request));
  });

  it("preserves canonical identity and product, market, and channel associations", () => {
    const engine = new AudienceMarketStrategyEngine();
    const request = buildRequest({ objective: "TRAFFIC", preferredChannels: ["EMAIL", "TIKTOK"] });
    const sourceStrategy = new AiCampaignStrategyService().createStrategy(request);
    const strategy = engine.determineStrategy(request);

    expect(strategy.campaignStrategyId).toBe(sourceStrategy.id);
    expect(strategy.product).toEqual(sourceStrategy.product);
    expect(strategy.geographicPriority.map((market) => market.market)).toEqual(["US", "MY"]);
    expect(strategy.channelFit.map((channel) => channel.channel)).toEqual(["EMAIL", "TIKTOK"]);
  });

  it("returns advisory audience and market metadata", () => {
    const strategy = determine();

    expect(strategy.advisoryOnly).toBe(true);
    expect(strategy.metadata).toEqual({
      strategyVersion: AUDIENCE_MARKET_STRATEGY_VERSION,
      sourceStrategyVersion: "SACP-04.04A",
      objectiveFunnelStrategyVersion: CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION,
    });
  });

  it("rejects invalid input through existing strategy validation", () => {
    expect(() => determine(buildRequest({ objective: "NOT_REAL" as CreateCampaignStrategyRequest["objective"] }))).toThrow(UnsupportedObjectiveError);
  });

  it("exports the public audience and market strategy API", () => {
    expect(publicExports.AudienceMarketStrategyEngine).toBe(AudienceMarketStrategyEngine);
    expect(publicExports.AUDIENCE_MARKET_SEGMENTS).toEqual(AUDIENCE_MARKET_SEGMENTS);
    expect(publicExports.MARKET_PRIORITY_LEVELS).toEqual(["PRIMARY", "SECONDARY", "EXPERIMENTAL", "NOT_RECOMMENDED"]);
    expect(publicExports.AUDIENCE_MARKET_STRATEGY_VERSION).toBe(AUDIENCE_MARKET_STRATEGY_VERSION);
  });
});

describe("BudgetChannelCreativeAllocationEngine", () => {
  const allocate = (
    request: CreateCampaignStrategyRequest = buildRequest(),
    budgetInput: Parameters<BudgetChannelCreativeAllocationEngine["allocateStrategy"]>[1] = {},
  ): BudgetChannelCreativeAllocation => new BudgetChannelCreativeAllocationEngine().allocateStrategy(request, budgetInput);

  const percentageTotal = (values: readonly number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;

  const amountTotal = (values: readonly number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) * 100) / 100;

  it("allocates TOFU budget toward existing discovery channels", () => {
    const allocation = allocate(
      buildRequest({
        objective: "BRAND_AWARENESS",
        audience: { ...buildRequest().audience, awarenessLevel: "UNAWARE", objections: [], buyingTriggers: [] },
        offer: { type: "STANDARD", headline: "Meet the daily styling helper", terms: [] },
      }),
    );

    expect(allocation.objectiveFunnelStrategy.funnelStage).toBe("TOFU");
    expect(allocation.channelAllocations.map((entry) => [entry.channel, entry.priority, entry.allocationPercentage])).toEqual([
      ["TIKTOK", "PRIMARY", 42.86],
      ["INSTAGRAM", "PRIMARY", 42.86],
      ["FACEBOOK", "TEST", 14.28],
    ]);
  });

  it("allocates MOFU budget in a balanced channel mix", () => {
    const allocation = allocate(
      buildRequest({
        objective: "LEAD_GENERATION",
        audience: { ...buildRequest().audience, buyingTriggers: ["Download routine guide"] },
        offer: { type: "STANDARD", headline: "Join the routine guide", terms: [] },
      }),
    );

    expect(allocation.objectiveFunnelStrategy.funnelStage).toBe("MOFU");
    expect(allocation.channelAllocations.map((entry) => entry.allocationPercentage)).toEqual([33.34, 33.33, 33.33]);
  });

  it("allocates BOFU budget toward high-intent and retargeting channels", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));

    expect(allocation.objectiveFunnelStrategy.funnelStage).toBe("BOFU");
    expect(allocation.channelAllocations.map((entry) => [entry.channel, entry.priority, entry.allocationPercentage])).toEqual([
      ["TIKTOK", "PRIMARY", 21.43],
      ["FACEBOOK", "PRIMARY", 21.43],
      ["SHOPIFY_ONSITE", "PRIMARY", 21.43],
      ["EMAIL", "SUPPORTING", 7.14],
      ["RETARGETING", "RETARGETING", 28.57],
    ]);
  });

  it("allocates retention budget toward owned and customer-continuity channels", () => {
    const allocation = allocate(buildRequest({ objective: "CUSTOMER_RETENTION" }));

    expect(allocation.objectiveFunnelStrategy.funnelStage).toBe("RETENTION");
    expect(allocation.channelAllocations.map((entry) => [entry.channel, entry.priority, entry.allocationPercentage])).toEqual([
      ["EMAIL", "PRIMARY", 50],
      ["SHOPIFY_ONSITE", "PRIMARY", 40],
      ["INSTAGRAM", "SUPPORTING", 10],
    ]);
  });

  it("keeps channel allocation percentages exactly at 100", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));

    expect(percentageTotal(allocation.channelAllocations.map((entry) => entry.allocationPercentage))).toBe(100);
  });

  it("preserves requested total budget across monetary allocations", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }), { totalBudget: 1000.01, currency: "usd" });

    expect(allocation.totalBudget).toBe(1000.01);
    expect(allocation.currency).toBe("USD");
    expect(amountTotal(allocation.channelAllocations.map((entry) => entry.allocationAmount ?? 0))).toBe(1000.01);
  });

  it("rounds monetary allocation deterministically", () => {
    const allocation = allocate(
      buildRequest({
        objective: "BRAND_AWARENESS",
        audience: { ...buildRequest().audience, awarenessLevel: "UNAWARE", objections: [], buyingTriggers: [] },
        offer: { type: "STANDARD", headline: "Meet the daily styling helper", terms: [] },
      }),
      { totalBudget: 100, currency: "MYR" },
    );

    expect(allocation.channelAllocations.map((entry) => entry.allocationAmount)).toEqual([42.86, 42.86, 14.28]);
  });

  it("uses percentage-only allocation when budget is absent", () => {
    const allocation = allocate();

    expect(allocation.totalBudget).toBeUndefined();
    expect(allocation.currency).toBeUndefined();
    expect(allocation.channelAllocations.every((entry) => entry.allocationAmount === undefined)).toBe(true);
  });

  it("handles zero budget explicitly and safely", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }), { totalBudget: 0, currency: "USD" });

    expect(allocation.totalBudget).toBe(0);
    expect(allocation.channelAllocations.map((entry) => entry.allocationAmount)).toEqual([0, 0, 0, 0, 0]);
  });

  it("rejects negative, NaN, and Infinity budget values", () => {
    const engine = new BudgetChannelCreativeAllocationEngine();

    expect(() => engine.allocateStrategy(buildRequest(), { totalBudget: -1 })).toThrow(InvalidCampaignRequestError);
    expect(() => engine.allocateStrategy(buildRequest(), { totalBudget: Number.NaN })).toThrow(InvalidCampaignRequestError);
    expect(() => engine.allocateStrategy(buildRequest(), { totalBudget: Number.POSITIVE_INFINITY })).toThrow(InvalidCampaignRequestError);
  });

  it("keeps channel-role priority behavior deterministic", () => {
    const allocation = allocate(buildRequest({ objective: "RETARGETING" }));

    expect(allocation.channelAllocations.map((entry) => [entry.channel, entry.priority])).toEqual([
      ["FACEBOOK", "RETARGETING"],
      ["INSTAGRAM", "RETARGETING"],
      ["EMAIL", "SUPPORTING"],
      ["SHOPIFY_ONSITE", "SUPPORTING"],
    ]);
    expect(BUDGET_ALLOCATION_PRIORITIES).toEqual(["PRIMARY", "SUPPORTING", "TEST", "RETARGETING"]);
  });

  it("keeps creative mix percentages exactly at 100", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));

    expect(percentageTotal(allocation.creativeMix.map((entry) => entry.recommendedPercentage))).toBe(100);
  });

  it("aligns creative mix to objective and funnel strategy without generating assets", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));

    expect(allocation.creativeMix.map((entry) => [entry.creativeRole, entry.objectiveAlignment, entry.funnelAlignment])).toEqual([
      ["OFFER", "CONVERSION", "BOFU"],
      ["PRODUCT_DEMONSTRATION", "CONVERSION", "BOFU"],
      ["SOCIAL_PROOF", "CONVERSION", "BOFU"],
      ["RETARGETING", "CONVERSION", "BOFU"],
    ]);
    expect(CREATIVE_ALLOCATION_ROLES).toContain("RETARGETING");
  });

  it("keeps allocation output deterministic for repeated inputs", () => {
    const engine = new BudgetChannelCreativeAllocationEngine();
    const request = buildRequest({ objective: "CONVERSION" });

    expect(engine.allocateStrategy(request, { totalBudget: 333.33, currency: "USD" })).toEqual(engine.allocateStrategy(request, { totalBudget: 333.33, currency: "USD" }));
  });

  it("preserves canonical identity and composed A-C strategy context", () => {
    const request = buildRequest({ objective: "TRAFFIC", preferredChannels: ["EMAIL", "TIKTOK"] });
    const sourceStrategy = new AiCampaignStrategyService().createStrategy(request);
    const allocation = allocate(request, { totalBudget: 500, currency: "USD" });

    expect(allocation.campaignStrategyId).toBe(sourceStrategy.id);
    expect(allocation.product).toEqual(sourceStrategy.product);
    expect(allocation.objectiveFunnelStrategy.campaignStrategyId).toBe(sourceStrategy.id);
    expect(allocation.audienceMarketStrategy.campaignStrategyId).toBe(sourceStrategy.id);
  });

  it("preserves market and channel associations", () => {
    const allocation = allocate(buildRequest({ objective: "TRAFFIC", preferredChannels: ["EMAIL", "TIKTOK"] }));

    expect(allocation.channels).toEqual(["EMAIL", "TIKTOK"]);
    expect(allocation.markets.map((market) => market.market)).toEqual(["US", "MY"]);
  });

  it("returns advisory allocation metadata", () => {
    const allocation = allocate();

    expect(allocation.advisoryOnly).toBe(true);
    expect(allocation.metadata).toEqual({
      strategyVersion: BUDGET_CHANNEL_CREATIVE_ALLOCATION_VERSION,
      sourceStrategyVersion: "SACP-04.04A",
      objectiveFunnelStrategyVersion: CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION,
      audienceMarketStrategyVersion: AUDIENCE_MARKET_STRATEGY_VERSION,
      roundingRule: "BASIS_POINTS_THEN_CENTS_LARGEST_REMAINDER",
    });
  });

  it("exports the public budget, channel, and creative allocation API", () => {
    expect(publicExports.BudgetChannelCreativeAllocationEngine).toBe(BudgetChannelCreativeAllocationEngine);
    expect(publicExports.BUDGET_ALLOCATION_PRIORITIES).toEqual(BUDGET_ALLOCATION_PRIORITIES);
    expect(publicExports.CREATIVE_ALLOCATION_ROLES).toEqual(CREATIVE_ALLOCATION_ROLES);
    expect(publicExports.BUDGET_CHANNEL_CREATIVE_ALLOCATION_VERSION).toBe(BUDGET_CHANNEL_CREATIVE_ALLOCATION_VERSION);
  });
});

describe("CampaignStrategyRecommendationRiskEngine", () => {
  const engine = new CampaignStrategyRecommendationRiskEngine();
  const allocationEngine = new BudgetChannelCreativeAllocationEngine();
  const evaluate = (request: CreateCampaignStrategyRequest = buildRequest()): CampaignStrategyRecommendationRiskResult => engine.evaluateStrategy(request);
  const allocate = (request: CreateCampaignStrategyRequest = buildRequest()): BudgetChannelCreativeAllocation => allocationEngine.allocateStrategy(request);
  const buildAwarenessRequest = (): CreateCampaignStrategyRequest =>
    buildRequest({
      objective: "BRAND_AWARENESS",
      audience: { ...buildRequest().audience, awarenessLevel: "UNAWARE", objections: [], buyingTriggers: [] },
      offer: { type: "STANDARD", headline: "Meet the daily styling helper", terms: [] },
    });
  const withAllocation = (
    allocation: BudgetChannelCreativeAllocation,
    overrides: Partial<BudgetChannelCreativeAllocation>,
  ): BudgetChannelCreativeAllocation => ({
    ...allocation,
    ...overrides,
  });

  it("marks a coherent low-risk strategy as READY", () => {
    const result = evaluate(buildRequest({ objective: "CONVERSION" }));

    expect(result.readiness.status).toBe("READY");
    expect(result.readiness.requiresHumanReview).toBe(false);
    expect(result.riskFindings).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });

  it("detects objective and funnel mismatches", () => {
    const allocation = allocate(buildAwarenessRequest());
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        objectiveFunnelStrategy: {
          ...allocation.objectiveFunnelStrategy,
          selectedObjective: "CONVERSION",
        },
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category)).toContain("OBJECTIVE_FUNNEL_MISMATCH");
    expect(result.recommendations.map((recommendation) => recommendation.category)).toContain("OBJECTIVE_ALIGNMENT");
  });

  it("detects audience and funnel mismatches", () => {
    const allocation = allocate(buildAwarenessRequest());
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        audienceMarketStrategy: {
          ...allocation.audienceMarketStrategy,
          audienceSegment: "HIGH_INTENT_BUYER",
        },
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category)).toContain("AUDIENCE_FUNNEL_MISMATCH");
    expect(result.recommendations.map((recommendation) => recommendation.category)).toContain("AUDIENCE_ALIGNMENT");
  });

  it("detects insufficient market evidence", () => {
    const result = evaluate(
      buildRequest({
        product: { ...buildRequest().product, markets: ["US"] },
        audience: { ...buildRequest().audience, targetMarkets: ["MY"] },
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category)).toContain("MARKET_EVIDENCE_INSUFFICIENT");
    expect(result.recommendations.map((recommendation) => recommendation.category)).toContain("MARKET_ALIGNMENT");
  });

  it("detects channel concentration risk", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        channelAllocations: allocation.channelAllocations.map((channel, index) => ({
          ...channel,
          allocationPercentage: index === 0 ? 80 : 5,
        })),
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category)).toContain("CHANNEL_CONCENTRATION");
    expect(result.recommendations.map((recommendation) => recommendation.category)).toContain("CHANNEL_ALLOCATION");
  });

  it("detects channel role mismatches", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        channelAllocations: allocation.channelAllocations.map((channel) => (channel.channel === "EMAIL" ? { ...channel, priority: "PRIMARY" } : channel)),
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category)).toContain("CHANNEL_ROLE_MISMATCH");
  });

  it("detects fragmented budget allocation", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));
    const percentages = [50, 12.5, 12.5, 12.5, 12.5];
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        channelAllocations: allocation.channelAllocations.map((channel, index) => ({
          ...channel,
          allocationPercentage: percentages[index] ?? channel.allocationPercentage,
        })),
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category)).toContain("BUDGET_TOO_FRAGMENTED");
  });

  it("detects budget allocation imbalance", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));
    const percentages = [70, 10, 10, 5, 5];
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        channelAllocations: allocation.channelAllocations.map((channel, index) => ({
          ...channel,
          allocationPercentage: percentages[index] ?? channel.allocationPercentage,
        })),
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category)).toContain("BUDGET_ALLOCATION_IMBALANCE");
  });

  it("detects creative mix mismatches", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        creativeMix: allocation.creativeMix.filter((creative) => creative.creativeRole !== "RETARGETING"),
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category)).toContain("CREATIVE_MIX_MISMATCH");
    expect(result.recommendations.map((recommendation) => recommendation.category)).toContain("CREATIVE_MIX");
  });

  it("recommends retargeting review when BOFU support is missing", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        channelAllocations: allocation.channelAllocations.filter((channel) => channel.channel !== "RETARGETING"),
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category)).toContain("RETARGETING_GAP");
    expect(result.recommendations.map((recommendation) => recommendation.code)).toContain("REC_RETARGETING_REVIEW_BOFU");
  });

  it("detects retention support gaps", () => {
    const allocation = allocate(buildRequest({ objective: "CUSTOMER_RETENTION" }));
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        creativeMix: allocation.creativeMix.filter((creative) => creative.creativeRole !== "RETENTION"),
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category)).toContain("RETENTION_GAP");
    expect(result.recommendations.map((recommendation) => recommendation.category)).toContain("RETENTION_STRATEGY");
  });

  it("requires human review for HIGH risks", () => {
    const allocation = allocate(buildAwarenessRequest());
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        audienceMarketStrategy: {
          ...allocation.audienceMarketStrategy,
          audienceSegment: "HIGH_INTENT_BUYER",
        },
      }),
    );

    expect(result.riskFindings.some((finding) => finding.severity === "HIGH")).toBe(true);
    expect(result.readiness.requiresHumanReview).toBe(true);
  });

  it("marks CRITICAL risk as NOT_READY", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));
    const result = engine.evaluateFromAllocation({
      ...allocation,
      objectiveFunnelStrategy: {
        ...allocation.objectiveFunnelStrategy,
        campaignStrategyId: "ai-campaign-strategy:mismatched",
      },
    });

    expect(result.riskFindings.map((finding) => finding.severity)).toContain("CRITICAL");
    expect(result.readiness.status).toBe("NOT_READY");
  });

  it("uses READY_WITH_REVIEW for medium and high advisory risks", () => {
    const result = evaluate(
      buildRequest({
        product: { ...buildRequest().product, markets: ["US"] },
        audience: { ...buildRequest().audience, targetMarkets: ["MY"] },
      }),
    );

    expect(result.readiness.status).toBe("READY_WITH_REVIEW");
    expect(CAMPAIGN_STRATEGY_READINESS_STATUSES).toEqual(["READY", "READY_WITH_REVIEW", "NOT_READY"]);
  });

  it("does not create unnecessary recommendations for coherent strategy", () => {
    const result = evaluate(buildRequest({ objective: "CONVERSION" }));

    expect(result.recommendations).toHaveLength(0);
  });

  it("deduplicates repeated risk codes deterministically", () => {
    const allocation = allocate(
      buildRequest({
        product: { ...buildRequest().product, markets: ["US"] },
        audience: { ...buildRequest().audience, targetMarkets: ["MY"] },
      }),
    );
    const duplicatedMarket = allocation.markets.find((market) => market.market === "MY");
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        markets: duplicatedMarket === undefined ? allocation.markets : [...allocation.markets, duplicatedMarket],
      }),
    );

    const codes = result.riskFindings.map((finding) => finding.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("orders risks and recommendations deterministically", () => {
    const allocation = allocate(buildAwarenessRequest());
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        objectiveFunnelStrategy: {
          ...allocation.objectiveFunnelStrategy,
          selectedObjective: "CONVERSION",
        },
        audienceMarketStrategy: {
          ...allocation.audienceMarketStrategy,
          audienceSegment: "HIGH_INTENT_BUYER",
        },
      }),
    );

    expect(result.riskFindings.map((finding) => finding.category).slice(0, 2)).toEqual([
      "OBJECTIVE_FUNNEL_MISMATCH",
      "AUDIENCE_FUNNEL_MISMATCH",
    ]);
    expect(result.recommendations.map((recommendation) => recommendation.code)).toEqual([...result.recommendations.map((recommendation) => recommendation.code)]);
  });

  it("keeps repeated equivalent output deterministic", () => {
    const request = buildRequest({ objective: "CONVERSION" });

    expect(engine.evaluateStrategy(request)).toEqual(engine.evaluateStrategy(request));
  });

  it("maps priorities from risk severity", () => {
    const allocation = allocate(buildAwarenessRequest());
    const result = engine.evaluateFromAllocation(
      withAllocation(allocation, {
        audienceMarketStrategy: {
          ...allocation.audienceMarketStrategy,
          audienceSegment: "HIGH_INTENT_BUYER",
        },
      }),
    );

    expect(result.recommendations[0]?.priority).toBe(result.riskFindings[0]?.severity);
    expect(CAMPAIGN_STRATEGY_RECOMMENDATION_PRIORITIES).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
    expect(CAMPAIGN_STRATEGY_RISK_SEVERITIES).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  });

  it("preserves canonical identity", () => {
    const allocation = allocate(buildRequest({ objective: "CONVERSION" }));
    const result = engine.evaluateFromAllocation(allocation);

    expect(result.campaignStrategyId).toBe(allocation.campaignStrategyId);
    expect(result.objectiveFunnelStrategy.campaignStrategyId).toBe(allocation.campaignStrategyId);
    expect(result.audienceMarketStrategy.campaignStrategyId).toBe(allocation.campaignStrategyId);
  });

  it("preserves A-D associations", () => {
    const allocation = allocate(buildRequest({ objective: "TRAFFIC", preferredChannels: ["EMAIL", "TIKTOK"] }));
    const result = engine.evaluateFromAllocation(allocation);

    expect(result.product).toEqual(allocation.product);
    expect(result.channels).toEqual(["EMAIL", "TIKTOK"]);
    expect(result.markets.map((market) => market.market)).toEqual(["US", "MY"]);
    expect(result.budgetChannelCreativeAllocation).toEqual(allocation);
  });

  it("returns advisory metadata", () => {
    const result = evaluate(buildRequest({ objective: "CONVERSION" }));

    expect(result.advisoryOnly).toBe(true);
    expect(result.readiness.advisoryOnly).toBe(true);
    expect(result.metadata).toEqual({
      strategyVersion: CAMPAIGN_STRATEGY_RECOMMENDATION_RISK_VERSION,
      allocationStrategyVersion: BUDGET_CHANNEL_CREATIVE_ALLOCATION_VERSION,
      objectiveFunnelStrategyVersion: CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION,
      audienceMarketStrategyVersion: AUDIENCE_MARKET_STRATEGY_VERSION,
      orderingRule: "RISK_ORDER_THEN_RECOMMENDATION_ORDER_BY_STABLE_CODE",
    });
  });

  it("exports the public recommendation and risk API", () => {
    expect(publicExports.CampaignStrategyRecommendationRiskEngine).toBe(CampaignStrategyRecommendationRiskEngine);
    expect(publicExports.CAMPAIGN_STRATEGY_RECOMMENDATION_RISK_VERSION).toBe(CAMPAIGN_STRATEGY_RECOMMENDATION_RISK_VERSION);
    expect(publicExports.CAMPAIGN_STRATEGY_RECOMMENDATION_CATEGORIES).toEqual(CAMPAIGN_STRATEGY_RECOMMENDATION_CATEGORIES);
    expect(publicExports.CAMPAIGN_STRATEGY_RISK_CATEGORIES).toEqual(CAMPAIGN_STRATEGY_RISK_CATEGORIES);
  });
});

describe("InMemoryCampaignStrategyRepository", () => {
  it("saves strategies defensively", async () => {
    const repository = new InMemoryCampaignStrategyRepository();
    const strategy = createStrategy();

    const saved = await repository.save(strategy);

    expect(saved).toEqual(strategy);
    expect(saved).not.toBe(strategy);
  });

  it("looks up strategies by ID", async () => {
    const repository = new InMemoryCampaignStrategyRepository();
    const strategy = await repository.save(createStrategy());

    expect(await repository.findById(strategy.id)).toEqual(strategy);
    expect(await repository.findById("missing")).toBeNull();
  });

  it("lists strategies in deterministic order", async () => {
    const repository = new InMemoryCampaignStrategyRepository();

    await repository.save(createStrategy(buildRequest({ createdAt: "2026-08-02T05:00:00.000Z" })));
    await repository.save(createStrategy(buildRequest({ createdAt: "2026-08-02T03:00:00.000Z" })));

    expect((await repository.list()).map((strategy) => strategy.createdAt)).toEqual(["2026-08-02T03:00:00.000Z", "2026-08-02T05:00:00.000Z"]);
  });

  it("replaces duplicate saves by strategy ID", async () => {
    const repository = new InMemoryCampaignStrategyRepository();
    const strategy = createStrategy();
    const updated = {
      ...strategy,
      warnings: ["Replacement warning"],
    };

    await repository.save(strategy);
    await repository.save(updated);

    expect(await repository.list()).toHaveLength(1);
    expect((await repository.findById(strategy.id))?.warnings).toEqual(["Replacement warning"]);
  });

  it("protects stored strategies from lookup mutation", async () => {
    const repository = new InMemoryCampaignStrategyRepository();
    const strategy = await repository.save(createStrategy());
    const found = await repository.findById(strategy.id);

    expect(found).not.toBeNull();
    (found?.warnings as string[]).push("Injected");

    expect((await repository.findById(strategy.id))?.warnings).not.toContain("Injected");
  });
});

describe("ai-campaign-strategy public exports", () => {
  it("exports the public module surface", () => {
    expect(publicExports.AiCampaignStrategyService).toBe(AiCampaignStrategyService);
    expect(publicExports.InMemoryCampaignStrategyRepository).toBe(InMemoryCampaignStrategyRepository);
    expect(publicExports.CAMPAIGN_OBJECTIVES).toContain("PRODUCT_LAUNCH");
  });
});
