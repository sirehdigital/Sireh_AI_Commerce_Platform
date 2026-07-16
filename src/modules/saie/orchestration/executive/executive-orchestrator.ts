import type { SAIEAgentDefinition } from "../../types/index.js";
import { ContentAgent, type ContentAgentInput, type ContentAgentOutput } from "../../agents/content/index.js";
import { MarketingAgent, type MarketingAgentInput, type MarketingAgentOutput } from "../../agents/marketing/index.js";
import type { ProductAgentOutput } from "../../agents/product/index.js";
import type {
  ExecutiveContentPlanningPort,
  ExecutiveMarketingPlanningPort,
  ExecutiveOrchestratorPorts,
  ExecutiveProductPlanningPort,
} from "./executive-orchestrator.ports.js";
import { createExecutiveRecommendedSequence } from "./executive-orchestrator.steps.js";
import type {
  ExecutiveDecision,
  ExecutiveOrchestratorInput,
  ExecutivePlan,
  ExecutiveProductOverview,
  ExecutiveRisk,
} from "./executive-orchestrator.types.js";

export const EXECUTIVE_ORCHESTRATOR_VERSION = "SAIE-01.10" as const;

export const EXECUTIVE_ORCHESTRATOR_DEFINITION: SAIEAgentDefinition = {
  type: "CEOAgent",
  name: "CEO Agent",
  description: "Coordinates proposal-only executive planning across SAIE Product, Marketing, and Content agents.",
  capabilities: ["executive-orchestration"],
  implementationStatus: "planner-only",
};

const DEFAULT_RECOMMENDED_CHANNELS = [
  "Shopify landing-page merchandising",
  "Social content concept",
  "Email campaign draft",
] as const;

export class ExecutiveOrchestrator {
  public constructor(private readonly ports: ExecutiveOrchestratorPorts = createDefaultExecutivePorts()) {}

  public plan(input: ExecutiveOrchestratorInput, generatedAt: Date = new Date()): ExecutivePlan {
    const unresolvedQuestions = collectUnresolvedQuestions(input);
    const generatedAtIso = generatedAt.toISOString();
    const productOverview = this.safeProductOverview(input);

    if (unresolvedQuestions.length > 0) {
      return this.createNeedsInputPlan(input, productOverview, unresolvedQuestions, generatedAtIso);
    }

    try {
      const marketing = this.ports.marketingPlanning.plan(toMarketingInput(input), generatedAt);
      const content = this.ports.contentPlanning.plan(toContentInput(input, marketing), generatedAt);

      return {
        executiveSummary: `${input.brand.name} can review a proposal-only sequence for ${input.product.title} across product, marketing, and content planning.`,
        productOverview,
        marketingProposal: marketing.proposal,
        contentProposal: content.proposal,
        recommendedSequence: createExecutiveRecommendedSequence(),
        keyDecisions: createKeyDecisions(input),
        crossAgentRisks: createCrossAgentRisks(marketing, content),
        unresolvedQuestions: [],
        readinessStatus: "READY_FOR_REVIEW",
        approvalRequired: true,
        proposalOnly: true,
        executionSupported: false,
        executableActions: [],
        generatedAt: generatedAtIso,
        orchestratorVersion: EXECUTIVE_ORCHESTRATOR_VERSION,
      };
    } catch (error) {
      return this.createBlockedPlan(input, productOverview, generatedAtIso, error);
    }
  }

  private safeProductOverview(input: ExecutiveOrchestratorInput): ExecutiveProductOverview {
    try {
      return this.ports.productPlanning.createOverview(input);
    } catch {
      return {
        title: safeText(input.product?.title, "Unknown product"),
        category: safeText(input.product?.category, "Unknown category"),
        benefits: safeStringArray(input.product?.benefits),
        productProposalStatus: "not-produced",
        source: "prepared-context",
      };
    }
  }

  private createNeedsInputPlan(
    input: ExecutiveOrchestratorInput,
    productOverview: ExecutiveProductOverview,
    unresolvedQuestions: readonly string[],
    generatedAt: string,
  ): ExecutivePlan {
    return {
      executiveSummary: "Executive orchestration needs more prepared context before agent proposals can be produced safely.",
      productOverview,
      marketingProposal: null,
      contentProposal: null,
      recommendedSequence: createExecutiveRecommendedSequence(),
      keyDecisions: createNeedsInputDecisions(input),
      crossAgentRisks: createBaseRisks(),
      unresolvedQuestions,
      readinessStatus: "NEEDS_INPUT",
      approvalRequired: true,
      proposalOnly: true,
      executionSupported: false,
      executableActions: [],
      generatedAt,
      orchestratorVersion: EXECUTIVE_ORCHESTRATOR_VERSION,
    };
  }

  private createBlockedPlan(
    input: ExecutiveOrchestratorInput,
    productOverview: ExecutiveProductOverview,
    generatedAt: string,
    error: unknown,
  ): ExecutivePlan {
    const reason = error instanceof Error ? error.message : "A planning agent could not produce a safe proposal.";

    return {
      executiveSummary: "Executive orchestration was blocked before a complete proposal could be produced.",
      productOverview,
      marketingProposal: null,
      contentProposal: null,
      recommendedSequence: createExecutiveRecommendedSequence(),
      keyDecisions: createNeedsInputDecisions(input),
      crossAgentRisks: [
        ...createBaseRisks(),
        {
          area: "Agent planning",
          caution: reason,
        },
      ],
      unresolvedQuestions: ["Which upstream planning input or agent adapter should be corrected before retrying?"],
      readinessStatus: "BLOCKED",
      approvalRequired: true,
      proposalOnly: true,
      executionSupported: false,
      executableActions: [],
      generatedAt,
      orchestratorVersion: EXECUTIVE_ORCHESTRATOR_VERSION,
    };
  }
}

export class DefaultExecutiveProductPlanningPort implements ExecutiveProductPlanningPort {
  public createOverview(input: ExecutiveOrchestratorInput): ExecutiveProductOverview {
    if (isProductAgentOutput(input.productProposal)) {
      return {
        title: input.product.title,
        category: input.product.category,
        benefits: [...input.product.benefits],
        productProposalStatus: "accepted",
        source: "provided-product-proposal",
      };
    }

    return {
      title: input.product.title,
      category: input.product.category,
      benefits: [...input.product.benefits],
      productProposalStatus: "context-derived",
      source: "prepared-context",
    };
  }
}

export class MarketingAgentPlanningPort implements ExecutiveMarketingPlanningPort {
  public constructor(private readonly marketingAgent = new MarketingAgent()) {}

  public plan(input: MarketingAgentInput, generatedAt: Date): MarketingAgentOutput {
    return this.marketingAgent.plan(input, generatedAt);
  }
}

export class ContentAgentPlanningPort implements ExecutiveContentPlanningPort {
  public constructor(private readonly contentAgent = new ContentAgent()) {}

  public plan(input: ContentAgentInput, generatedAt: Date): ContentAgentOutput {
    return this.contentAgent.plan(input, generatedAt);
  }
}

export const createDefaultExecutivePorts = (): ExecutiveOrchestratorPorts => ({
  productPlanning: new DefaultExecutiveProductPlanningPort(),
  marketingPlanning: new MarketingAgentPlanningPort(),
  contentPlanning: new ContentAgentPlanningPort(),
});

const toMarketingInput = (input: ExecutiveOrchestratorInput): MarketingAgentInput => ({
  product: {
    title: input.product.title,
    description: input.product.description ?? `${input.product.title} in ${input.product.category}.`,
    category: input.product.category,
    tags: [...(input.product.tags ?? input.product.benefits)],
    targetMarkets: [...(input.product.targetMarkets ?? input.brand.market ?? ["GLOBAL"])],
    keyBenefits: [...input.product.benefits],
    currency: input.product.currency ?? input.brand.currency ?? "USD",
  },
  brand: {
    name: input.brand.name,
    market: [...(input.brand.market ?? input.product.targetMarkets ?? ["GLOBAL"])],
    currency: input.brand.currency ?? input.product.currency ?? "USD",
    ...(input.brand.positioning === undefined ? {} : { positioning: input.brand.positioning }),
    ...(input.brand.voice === undefined ? {} : { tone: input.brand.voice }),
  },
  executionMode: "proposal-only",
});

const toContentInput = (
  input: ExecutiveOrchestratorInput,
  marketing: MarketingAgentOutput,
): ContentAgentInput => ({
  productTitle: input.product.title,
  productCategory: input.product.category,
  brandName: input.brand.name,
  productBenefits: [...input.product.benefits],
  targetAudience: marketing.proposal.targetAudience,
  brandVoice: input.brand.voice ?? "professional",
  campaignObjective: input.campaignObjective ?? marketing.proposal.campaignObjective,
  recommendedChannels: [
    ...(input.recommendedChannels ?? marketing.proposal.recommendedChannels ?? DEFAULT_RECOMMENDED_CHANNELS),
  ],
  ...(input.locale === undefined ? {} : { locale: input.locale }),
  executionMode: "proposal-only",
});

const collectUnresolvedQuestions = (input: ExecutiveOrchestratorInput): readonly string[] => {
  const questions: string[] = [];

  if (isBlank(input.product?.title)) {
    questions.push("What is the product title?");
  }

  if (isBlank(input.brand?.name)) {
    questions.push("What is the brand name?");
  }

  if (isBlank(input.product?.category)) {
    questions.push("What product category should the agents use?");
  }

  if (safeStringArray(input.product?.benefits).length === 0) {
    questions.push("What product benefits should be used for marketing and content planning?");
  }

  if (isBlank(input.targetAudience)) {
    questions.push("Who is the target audience?");
  }

  if (isBlank(input.campaignObjective) && isBlank(input.product?.title)) {
    questions.push("What campaign objective should be used, or what product context is enough to derive one?");
  }

  return questions;
};

const createKeyDecisions = (input: ExecutiveOrchestratorInput): readonly ExecutiveDecision[] => [
  {
    decision: "Keep orchestration proposal-only.",
    reason: "SAIE-01.10 does not support external execution, publishing, scheduling, or mutation.",
  },
  {
    decision: "Use Marketing Agent output as the context bridge into Content Agent planning.",
    reason: sentence(`The campaign objective is ${input.campaignObjective ?? "derived from prepared product context"}`),
  },
  {
    decision: "Require human approval as the final sequence step.",
    reason: "Cross-agent output must be reviewed before any future operational workflow.",
  },
];

const createNeedsInputDecisions = (input: ExecutiveOrchestratorInput): readonly ExecutiveDecision[] => [
  {
    decision: "Pause downstream agent planning.",
    reason: `Prepared context for ${safeText(input.product?.title, "the product")} is incomplete.`,
  },
  {
    decision: "Return unresolved questions instead of fabricating facts.",
    reason: "The executive orchestrator must not invent external product, audience, or campaign facts.",
  },
];

const createCrossAgentRisks = (
  marketing: MarketingAgentOutput,
  content: ContentAgentOutput,
): readonly ExecutiveRisk[] => [
  ...createBaseRisks(),
  ...marketing.proposal.risksOrCautions.map((caution) => ({
    area: "Marketing",
    caution,
  })),
  ...content.proposal.complianceCautions.slice(0, 3).map((caution) => ({
    area: "Content",
    caution,
  })),
];

const createBaseRisks = (): readonly ExecutiveRisk[] => [
  {
    area: "Execution",
    caution: "No external action is authorized by this executive plan.",
  },
  {
    area: "Approval",
    caution: "Human approval is required before any publish, post, email, ad, Shopify, or marketplace action.",
  },
];

const isProductAgentOutput = (value: unknown): value is ProductAgentOutput => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<ProductAgentOutput>;

  return candidate.agentType === "ProductAgent" && candidate.workflowId === "saie-product-agent-plan";
};

const isBlank = (value: unknown): boolean => typeof value !== "string" || value.trim().length === 0;

const safeText = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

const safeStringArray = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const strings: string[] = [];

  for (const item of value) {
    if (typeof item === "string" && item.trim().length > 0) {
      strings.push(item);
    }
  }

  return strings;
};

const sentence = (value: string): string => {
  const trimmed = value.trim();

  return /[.!?]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
};
