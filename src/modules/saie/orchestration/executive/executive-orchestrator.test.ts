import { describe, expect, it } from "vitest";
import type { ContentAgentInput, ContentAgentOutput } from "../../agents/content/index.js";
import { SAIEAgentRegistry } from "../../agents/index.js";
import type { MarketingAgentInput, MarketingAgentOutput } from "../../agents/marketing/index.js";
import {
  ExecutiveOrchestrator,
  type ExecutiveContentPlanningPort,
  type ExecutiveMarketingPlanningPort,
  type ExecutiveProductPlanningPort,
} from "./index.js";
import type { ExecutiveOrchestratorInput, ExecutiveProductOverview } from "./index.js";

const FIXED_DATE = new Date("2026-07-16T00:00:00.000Z");

describe("ExecutiveOrchestrator", () => {
  it("creates a successful deterministic executive orchestration plan", () => {
    const orchestrator = createOrchestrator();
    const plan = orchestrator.plan(buildExecutiveInput(), FIXED_DATE);

    expect(plan).toMatchObject({
      executiveSummary:
        "Sireh Beauty can review a proposal-only sequence for Velvet Glow Body Lotion across product, marketing, and content planning.",
      productOverview: {
        title: "Velvet Glow Body Lotion",
        category: "Body Care",
        benefits: ["daily hydration", "smoother-looking skin"],
        productProposalStatus: "context-derived",
        source: "prepared-context",
      },
      readinessStatus: "READY_FOR_REVIEW",
      approvalRequired: true,
      proposalOnly: true,
      executionSupported: false,
      executableActions: [],
      generatedAt: "2026-07-16T00:00:00.000Z",
      orchestratorVersion: "SAIE-01.10",
    });
    expect(plan.unresolvedQuestions).toEqual([]);
  });

  it("includes the Marketing Agent proposal", () => {
    const plan = createOrchestrator().plan(buildExecutiveInput(), FIXED_DATE);

    expect(plan.marketingProposal).toMatchObject({
      campaignObjective: "Validate demand before scaled execution.",
      targetAudience: "MY shoppers interested in Body Care from Sireh Beauty.",
      recommendedChannels: ["Instagram", "Email"],
    });
  });

  it("includes the Content Agent proposal", () => {
    const plan = createOrchestrator().plan(buildExecutiveInput(), FIXED_DATE);

    expect(plan.contentProposal).toMatchObject({
      primaryHeadline: "Sireh Beauty Velvet Glow Body Lotion",
      socialCaptions: ["Review caption only."],
      emailSubjectSuggestions: ["Meet Velvet Glow"],
      seoKeywords: ["body lotion", "daily hydration"],
    });
  });

  it("keeps the product, marketing, content, and human review sequence", () => {
    const plan = createOrchestrator().plan(buildExecutiveInput(), FIXED_DATE);

    expect(plan.recommendedSequence.map((step) => step.owner)).toEqual([
      "ProductAgent",
      "MarketingAgent",
      "ContentAgent",
      "HumanReviewer",
    ]);
  });

  it("always enforces proposal-only safety flags and empty executable actions", () => {
    const plan = createOrchestrator().plan(buildExecutiveInput(), FIXED_DATE);

    expect(plan.approvalRequired).toBe(true);
    expect(plan.proposalOnly).toBe(true);
    expect(plan.executionSupported).toBe(false);
    expect(plan.executableActions).toEqual([]);
  });

  it("returns NEEDS_INPUT with deterministic unresolved questions when required context is missing", () => {
    const plan = createOrchestrator().plan(
      {
        product: {
          title: "",
          category: "",
          benefits: [],
        },
        brand: {
          name: "",
        },
        targetAudience: "",
      },
      FIXED_DATE,
    );

    expect(plan.readinessStatus).toBe("NEEDS_INPUT");
    expect(plan.marketingProposal).toBeNull();
    expect(plan.contentProposal).toBeNull();
    expect(plan.unresolvedQuestions).toEqual([
      "What is the product title?",
      "What is the brand name?",
      "What product category should the agents use?",
      "What product benefits should be used for marketing and content planning?",
      "Who is the target audience?",
      "What campaign objective should be used, or what product context is enough to derive one?",
    ]);
  });

  it("returns BLOCKED when an agent proposal cannot be produced safely", () => {
    const plan = createOrchestrator({
      marketingPlanning: {
        plan: () => {
          throw new Error("Marketing planning adapter failed safely.");
        },
      },
    }).plan(buildExecutiveInput(), FIXED_DATE);

    expect(plan.readinessStatus).toBe("BLOCKED");
    expect(plan.crossAgentRisks).toContainEqual({
      area: "Agent planning",
      caution: "Marketing planning adapter failed safely.",
    });
    expect(plan.unresolvedQuestions).toEqual([
      "Which upstream planning input or agent adapter should be corrected before retrying?",
    ]);
  });

  it("returns deterministic cross-agent risks and key decisions", () => {
    const plan = createOrchestrator().plan(buildExecutiveInput(), FIXED_DATE);

    expect(plan.keyDecisions).toEqual([
      {
        decision: "Keep orchestration proposal-only.",
        reason: "SAIE-01.10 does not support external execution, publishing, scheduling, or mutation.",
      },
      {
        decision: "Use Marketing Agent output as the context bridge into Content Agent planning.",
        reason: "The campaign objective is Validate demand before scaled execution.",
      },
      {
        decision: "Require human approval as the final sequence step.",
        reason: "Cross-agent output must be reviewed before any future operational workflow.",
      },
    ]);
    expect(plan.crossAgentRisks).toEqual([
      {
        area: "Execution",
        caution: "No external action is authorized by this executive plan.",
      },
      {
        area: "Approval",
        caution: "Human approval is required before any publish, post, email, ad, Shopify, or marketplace action.",
      },
      {
        area: "Marketing",
        caution: "Validate claims before use.",
      },
      {
        area: "Content",
        caution: "Human approval required before publishing.",
      },
    ]);
  });

  it("registers CEOAgent as the planner-only executive orchestration definition", () => {
    expect(new SAIEAgentRegistry().get("CEOAgent")).toMatchObject({
      type: "CEOAgent",
      name: "CEO Agent",
      capabilities: ["executive-orchestration"],
      implementationStatus: "planner-only",
    });
  });
});

const createOrchestrator = (
  overrides: Partial<{
    productPlanning: ExecutiveProductPlanningPort;
    marketingPlanning: ExecutiveMarketingPlanningPort;
    contentPlanning: ExecutiveContentPlanningPort;
  }> = {},
): ExecutiveOrchestrator =>
  new ExecutiveOrchestrator({
    productPlanning: overrides.productPlanning ?? new StubProductPlanningPort(),
    marketingPlanning: overrides.marketingPlanning ?? new StubMarketingPlanningPort(),
    contentPlanning: overrides.contentPlanning ?? new StubContentPlanningPort(),
  });

const buildExecutiveInput = (): ExecutiveOrchestratorInput => ({
  product: {
    title: "Velvet Glow Body Lotion",
    description: "A lightweight body lotion for daily hydration.",
    category: "Body Care",
    benefits: ["daily hydration", "smoother-looking skin"],
    tags: ["hydration", "body-care"],
    targetMarkets: ["MY"],
    currency: "MYR",
  },
  brand: {
    name: "Sireh Beauty",
    market: ["MY"],
    currency: "MYR",
    voice: "friendly",
    positioning: "practical self-care",
  },
  targetAudience: "busy self-care shoppers",
  campaignObjective: "Validate demand before scaled execution.",
  recommendedChannels: ["Instagram", "Email"],
  locale: "en",
});

class StubProductPlanningPort implements ExecutiveProductPlanningPort {
  public createOverview(input: ExecutiveOrchestratorInput): ExecutiveProductOverview {
    return {
      title: input.product.title,
      category: input.product.category,
      benefits: [...input.product.benefits],
      productProposalStatus: "context-derived",
      source: "prepared-context",
    };
  }
}

class StubMarketingPlanningPort implements ExecutiveMarketingPlanningPort {
  public plan(input: MarketingAgentInput, generatedAt: Date): MarketingAgentOutput {
    return {
      agentType: "MarketingAgent",
      executionMode: "proposal-only",
      workflowId: "saie-marketing-agent-plan",
      orderedSteps: [],
      requiredPorts: [],
      proposal: {
        campaignObjective: input.executionMode === "proposal-only" ? "Validate demand before scaled execution." : "",
        targetAudience: "MY shoppers interested in Body Care from Sireh Beauty.",
        audiencePainPoints: ["Customer needs a clear body-care reason to buy."],
        valueProposition: "Hydration with a practical self-care voice.",
        recommendedChannels: ["Instagram", "Email"],
        campaignMessage: "Sireh Beauty presents Velvet Glow.",
        contentThemes: ["hydration", "self-care"],
        contentFormats: ["caption", "email subject"],
        budgetRecommendation: {
          tier: "lean-test",
          currency: "MYR",
          recommendedTestBudget: 150,
          notes: ["Human approval required."],
        },
        kpiRecommendations: [{ name: "CTR", target: "Review after test." }],
        risksOrCautions: ["Validate claims before use."],
        approvalRequirement: "Human approval required.",
      },
      approvalRequired: true,
      executionSupported: false,
      proposalOnly: true,
      executableActions: [],
      safetyWarnings: [],
      generatedAt: generatedAt.toISOString(),
    };
  }
}

class StubContentPlanningPort implements ExecutiveContentPlanningPort {
  public plan(input: ContentAgentInput, generatedAt: Date): ContentAgentOutput {
    return {
      agentType: "ContentAgent",
      executionMode: "proposal-only",
      workflowId: "saie-content-agent-plan",
      orderedSteps: [],
      requiredPorts: [],
      proposal: {
        primaryHeadline: `${input.brandName} ${input.productTitle}`,
        shortProductDescription: "Short review description.",
        longFormContentSummary: "Long review summary.",
        keyBenefitBullets: [...input.productBenefits],
        campaignHooks: [input.campaignObjective],
        socialCaptions: ["Review caption only."],
        emailSubjectSuggestions: ["Meet Velvet Glow"],
        contentThemes: ["hydration", "self-care"],
        recommendedFormats: ["caption", "email subject"],
        channelAdaptations: input.recommendedChannels.map((channel) => ({
          channel,
          guidance: `Prepare descriptive content for ${channel}; do not execute.`,
        })),
        seoKeywords: ["body lotion", "daily hydration"],
        localizationNotes: ["English review required."],
        complianceCautions: ["Human approval required before publishing."],
        sourceCapabilities: ["StubContentPlanningPort"],
        approvalRequirement: "Human approval required.",
      },
      approvalRequired: true,
      executionSupported: false,
      proposalOnly: true,
      executableActions: [],
      safetyWarnings: [],
      generatedAt: generatedAt.toISOString(),
    };
  }
}
