import { describe, expect, it } from "vitest";

import {
  AiCampaignStrategyService,
  CampaignObjectiveFunnelStrategyEngine,
  CAMPAIGN_INTENT_LEVELS,
  CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION,
  CAMPAIGN_STRATEGIC_FUNNEL_STAGES,
  CAMPAIGN_STRATEGIC_OBJECTIVES,
  InMemoryCampaignStrategyRepository,
  InvalidAudienceError,
  InvalidOfferError,
  InvalidProductContextError,
  InvalidTimestampError,
  UnsupportedAngleError,
  UnsupportedChannelError,
  UnsupportedObjectiveError,
  type CreateCampaignStrategyRequest,
  type CampaignObjectiveFunnelStrategy,
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
