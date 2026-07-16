import type { SAIEAgentType } from "../../types/index.js";
import type { MarketingAgentPortIdentifier } from "./marketing-agent.ports.js";

export interface MarketingAgentPreparedProductContext {
  readonly title: string;
  readonly description: string;
  readonly category?: string;
  readonly productType?: string;
  readonly tags: readonly string[];
  readonly targetMarkets: readonly string[];
  readonly keyBenefits?: readonly string[];
  readonly keyFeatures?: readonly string[];
  readonly price?: number;
  readonly currency?: string;
}

export interface MarketingAgentBrandContext {
  readonly name: string;
  readonly market: readonly string[];
  readonly currency: string;
  readonly positioning?: string;
  readonly tone?: string;
}

export type MarketingAgentExecutionMode = "proposal-only";

export type MarketingBudgetTier = "lean-test" | "validation" | "scale-ready";

export interface MarketingAgentInput extends Readonly<Record<string, unknown>> {
  readonly product: MarketingAgentPreparedProductContext;
  readonly brand: MarketingAgentBrandContext;
  readonly executionMode: MarketingAgentExecutionMode;
}

export type MarketingAgentStepId =
  | "ValidatePreparedContext"
  | "DefineCampaignObjective"
  | "IdentifyTargetAudience"
  | "BuildMarketingProposal"
  | "RequireHumanApproval";

export interface MarketingAgentStep {
  readonly id: MarketingAgentStepId;
  readonly order: number;
  readonly name: string;
  readonly requiredPort: MarketingAgentPortIdentifier;
  readonly mutatesData: false;
}

export interface MarketingBudgetRecommendation {
  readonly tier: MarketingBudgetTier;
  readonly currency: string;
  readonly recommendedTestBudget: number;
  readonly notes: readonly string[];
}

export interface MarketingKpiRecommendation {
  readonly name: string;
  readonly target: string;
}

export interface MarketingProposal {
  readonly campaignObjective: string;
  readonly targetAudience: string;
  readonly audiencePainPoints: readonly string[];
  readonly valueProposition: string;
  readonly recommendedChannels: readonly string[];
  readonly campaignMessage: string;
  readonly contentThemes: readonly string[];
  readonly contentFormats: readonly string[];
  readonly budgetRecommendation: MarketingBudgetRecommendation;
  readonly kpiRecommendations: readonly MarketingKpiRecommendation[];
  readonly risksOrCautions: readonly string[];
  readonly approvalRequirement: string;
}

export interface MarketingAgentOutput extends Readonly<Record<string, unknown>> {
  readonly agentType: Extract<SAIEAgentType, "MarketingAgent">;
  readonly executionMode: MarketingAgentExecutionMode;
  readonly workflowId: "saie-marketing-agent-plan";
  readonly orderedSteps: readonly MarketingAgentStep[];
  readonly requiredPorts: readonly MarketingAgentPortIdentifier[];
  readonly proposal: MarketingProposal;
  readonly approvalRequired: true;
  readonly executionSupported: false;
  readonly proposalOnly: true;
  readonly executableActions: readonly [];
  readonly safetyWarnings: readonly string[];
  readonly generatedAt: string;
}

export class MarketingAgentInputValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MarketingAgentInputValidationError";
  }
}
