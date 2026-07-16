import type { ContentProposal } from "../../agents/content/index.js";
import type { MarketingProposal } from "../../agents/marketing/index.js";
import type { ProductAgentOutput } from "../../agents/product/index.js";

export type ExecutiveOrchestratorReadinessStatus = "READY_FOR_REVIEW" | "NEEDS_INPUT" | "BLOCKED";

export interface ExecutiveProductContext {
  readonly title: string;
  readonly description?: string;
  readonly category: string;
  readonly benefits: readonly string[];
  readonly tags?: readonly string[];
  readonly targetMarkets?: readonly string[];
  readonly currency?: string;
}

export interface ExecutiveBrandContext {
  readonly name: string;
  readonly market?: readonly string[];
  readonly currency?: string;
  readonly voice?: string;
  readonly positioning?: string;
}

export interface ExecutiveOrchestratorInput extends Readonly<Record<string, unknown>> {
  readonly product: ExecutiveProductContext;
  readonly brand: ExecutiveBrandContext;
  readonly targetAudience: string;
  readonly campaignObjective?: string;
  readonly recommendedChannels?: readonly string[];
  readonly locale?: string;
  readonly productProposal?: ProductAgentOutput | ExecutiveProductOverview;
}

export interface ExecutiveProductOverview {
  readonly title: string;
  readonly category: string;
  readonly benefits: readonly string[];
  readonly productProposalStatus: "accepted" | "context-derived" | "not-produced";
  readonly source: "provided-product-proposal" | "prepared-context";
}

export interface ExecutiveRecommendedStep {
  readonly order: number;
  readonly owner: "ProductAgent" | "MarketingAgent" | "ContentAgent" | "HumanReviewer";
  readonly action: string;
}

export interface ExecutiveDecision {
  readonly decision: string;
  readonly reason: string;
}

export interface ExecutiveRisk {
  readonly area: string;
  readonly caution: string;
}

export interface ExecutivePlan extends Readonly<Record<string, unknown>> {
  readonly executiveSummary: string;
  readonly productOverview: ExecutiveProductOverview;
  readonly marketingProposal: MarketingProposal | null;
  readonly contentProposal: ContentProposal | null;
  readonly recommendedSequence: readonly ExecutiveRecommendedStep[];
  readonly keyDecisions: readonly ExecutiveDecision[];
  readonly crossAgentRisks: readonly ExecutiveRisk[];
  readonly unresolvedQuestions: readonly string[];
  readonly readinessStatus: ExecutiveOrchestratorReadinessStatus;
  readonly approvalRequired: true;
  readonly proposalOnly: true;
  readonly executionSupported: false;
  readonly executableActions: readonly [];
  readonly generatedAt: string;
  readonly orchestratorVersion: "SAIE-01.10";
}

export class ExecutiveOrchestratorInputValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ExecutiveOrchestratorInputValidationError";
  }
}
