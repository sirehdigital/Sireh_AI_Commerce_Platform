import { describe, expect, it } from "vitest";
import { SAIEEngine } from "../../core/index.js";
import { SAIEAgentRegistry } from "../agent-registry.js";
import { MarketingAgent, parseMarketingAgentInput } from "./marketing-agent.js";
import type { MarketingAgentInput, MarketingAgentStepId } from "./marketing-agent.types.js";

const FIXED_DATE = new Date("2026-07-16T00:00:00.000Z");

describe("MarketingAgent", () => {
  it("creates a deterministic marketing proposal for human review", () => {
    const plan = new MarketingAgent().plan(buildMarketingAgentInput(), FIXED_DATE);

    expect(plan).toMatchObject({
      agentType: "MarketingAgent",
      executionMode: "proposal-only",
      workflowId: "saie-marketing-agent-plan",
      approvalRequired: true,
      executionSupported: false,
      proposalOnly: true,
      executableActions: [],
      generatedAt: "2026-07-16T00:00:00.000Z",
    });
    expect(stepIds(plan.orderedSteps)).toEqual([
      "ValidatePreparedContext",
      "DefineCampaignObjective",
      "IdentifyTargetAudience",
      "BuildMarketingProposal",
      "RequireHumanApproval",
    ]);
    expect(plan.proposal).toMatchObject({
      campaignObjective:
        "Validate demand for Velvet Glow Body Lotion in MY before any scaled execution.",
      targetAudience: "MY shoppers interested in skincare from Sireh Beauty.",
      audiencePainPoints: [
        "Customer needs a clearer path to smoother skin.",
        "Customer needs a clearer path to daily hydration.",
      ],
      valueProposition:
        "Velvet Glow Body Lotion helps customers get smoother skin with a warm, premium, and practical brand experience.",
      recommendedChannels: [
        "TikTok organic concept",
        "Instagram product education",
        "Shopify landing-page merchandising",
      ],
      campaignMessage:
        "Sireh Beauty presents Velvet Glow Body Lotion: A lightweight body lotion for daily hydration and a soft glow.",
      contentThemes: [
        "Sireh Beauty brand promise",
        "Velvet Glow Body Lotion core benefit",
        "fast absorption education",
      ],
      approvalRequirement:
        "Human approval is required before publishing, posting, sending, spending, or mutating any external system.",
    });
  });

  it("validates required prepared product context", () => {
    expect(() => {
      new MarketingAgent().plan({
        ...buildMarketingAgentInput(),
        product: {
          ...buildMarketingAgentInput().product,
          title: "",
        },
      });
    }).toThrow("Product title is required.");
  });

  it("validates required brand context", () => {
    expect(() => {
      new MarketingAgent().plan({
        ...buildMarketingAgentInput(),
        brand: {
          ...buildMarketingAgentInput().brand,
          currency: "myr",
        },
      });
    }).toThrow("Brand currency must be a three-letter uppercase ISO code.");
  });

  it("rejects executable execution modes", () => {
    expect(() => {
      parseMarketingAgentInput({
        ...buildMarketingAgentInput(),
        executionMode: "execute",
      });
    }).toThrow("Marketing Agent only supports proposal-only execution mode.");
  });

  it("always keeps proposal-only safety flags and produces no executable action", () => {
    const plan = new MarketingAgent().plan(buildMarketingAgentInput(), FIXED_DATE);

    expect(plan.approvalRequired).toBe(true);
    expect(plan.executionSupported).toBe(false);
    expect(plan.proposalOnly).toBe(true);
    expect(plan.executableActions).toEqual([]);
    expect(plan.safetyWarnings).toContain("No external marketing platform API is called.");
    expect(stepIds(plan.orderedSteps)).not.toContain("PublishCampaign" as MarketingAgentStepId);
  });

  it("registers MarketingAgent as planner-only in the default SAIE registry", () => {
    const registeredAgent = new SAIEAgentRegistry().get("MarketingAgent");

    expect(registeredAgent).toMatchObject({
      type: "MarketingAgent",
      implementationStatus: "planner-only",
      capabilities: ["marketing-planning"],
    });
  });

  it("plans MarketingAgent through the SAIE engine response contract", () => {
    const response = new SAIEEngine().plan({
      id: "saie-marketing-test-request",
      targetAgent: "MarketingAgent",
      context: {
        correlationId: "saie-marketing-correlation",
        tenantId: "tenant-test",
        requestedBy: "human-reviewer",
        source: "admin",
        metadata: {},
      },
      intent: "prepare-marketing-proposal",
      payload: buildMarketingAgentInput(),
    });

    expect(response.status).toBe("planned");
    expect(response.result).toMatchObject({
      agentType: "MarketingAgent",
      approvalRequired: true,
      executionSupported: false,
      proposalOnly: true,
      executableActions: [],
    });
  });

  it("does not mutate input objects", () => {
    const input = buildMarketingAgentInput();
    const originalTags = [...input.product.tags];
    const originalMarkets = [...input.brand.market];

    new MarketingAgent().plan(input, FIXED_DATE);

    expect(input.product.tags).toEqual(originalTags);
    expect(input.brand.market).toEqual(originalMarkets);
  });
});

const stepIds = (
  steps: readonly { readonly id: MarketingAgentStepId }[],
): readonly MarketingAgentStepId[] => steps.map((step) => step.id);

const buildMarketingAgentInput = (): MarketingAgentInput => ({
  product: {
    title: "Velvet Glow Body Lotion",
    description: "A lightweight body lotion for daily hydration and a soft glow.",
    category: "skincare",
    productType: "body lotion",
    tags: ["hydration", "glow", "body-care"],
    targetMarkets: ["MY", "SG"],
    keyBenefits: ["smoother skin", "daily hydration"],
    keyFeatures: ["fast absorption", "non-greasy texture"],
    price: 39,
    currency: "MYR",
  },
  brand: {
    name: "Sireh Beauty",
    market: ["MY"],
    currency: "MYR",
    positioning: "affordable premium self-care",
    tone: "warm, premium, and practical",
  },
  executionMode: "proposal-only",
});
