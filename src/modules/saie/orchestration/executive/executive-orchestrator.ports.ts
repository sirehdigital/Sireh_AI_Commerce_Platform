import type { ContentAgentInput, ContentAgentOutput } from "../../agents/content/index.js";
import type { MarketingAgentInput, MarketingAgentOutput } from "../../agents/marketing/index.js";
import type {
  ExecutiveOrchestratorInput,
  ExecutiveProductOverview,
} from "./executive-orchestrator.types.js";

export interface ExecutiveProductPlanningPort {
  readonly createOverview: (input: ExecutiveOrchestratorInput) => ExecutiveProductOverview;
}

export interface ExecutiveMarketingPlanningPort {
  readonly plan: (input: MarketingAgentInput, generatedAt: Date) => MarketingAgentOutput;
}

export interface ExecutiveContentPlanningPort {
  readonly plan: (input: ContentAgentInput, generatedAt: Date) => ContentAgentOutput;
}

export interface ExecutiveOrchestratorPorts {
  readonly productPlanning: ExecutiveProductPlanningPort;
  readonly marketingPlanning: ExecutiveMarketingPlanningPort;
  readonly contentPlanning: ExecutiveContentPlanningPort;
}
