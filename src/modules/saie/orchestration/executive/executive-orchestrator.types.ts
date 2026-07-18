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

export interface ExecutiveHealthSummary {
  readonly status: "HEALTHY" | "ATTENTION_REQUIRED" | "BLOCKED";
  readonly planningOutputsValidated: boolean;
  readonly approvalGateIntact: true;
  readonly executionDisabled: true;
  readonly notes: readonly string[];
}

export interface ExecutiveMetrics {
  readonly agentProposalCount: number;
  readonly recommendedStepCount: number;
  readonly riskCount: number;
  readonly unresolvedQuestionCount: number;
  readonly executableActionCount: 0;
}

export interface ExecutiveEngineMetadata {
  readonly engineName: "SAIE Executive Orchestrator";
  readonly engineVersion: "0.1.0-alpha";
  readonly buildSprint: "SAIE-01.10.1";
  readonly orchestratorVersion: "SAIE-01.10";
  readonly deterministic: true;
}

export interface ExecutiveReleaseSummary {
  readonly releaseName: "SAIE v0.2.0 Beta";
  readonly stabilizationSprint: "SAIE-01.10.1";
  readonly proposalOnly: true;
  readonly humanApprovalRequired: true;
  readonly externalExecutionEnabled: false;
  readonly notes: readonly string[];
}

export interface ExecutiveOutputValidation {
  readonly productOverviewPresent: boolean;
  readonly marketingProposalPresent: boolean;
  readonly contentProposalPresent: boolean;
  readonly sequencePresent: boolean;
  readonly safetyFlagsValid: boolean;
  readonly missingOutputs: readonly string[];
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
  readonly healthSummary: ExecutiveHealthSummary;
  readonly metrics: ExecutiveMetrics;
  readonly engineMetadata: ExecutiveEngineMetadata;
  readonly releaseSummary: ExecutiveReleaseSummary;
  readonly outputValidation: ExecutiveOutputValidation;
}

export class ExecutiveOrchestratorInputValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ExecutiveOrchestratorInputValidationError";
  }
}
