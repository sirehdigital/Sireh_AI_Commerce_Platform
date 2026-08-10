import type { AiCampaignStrategy, CampaignChannel, ProductCampaignContext } from "./campaign-strategy.model.js";

export const CAMPAIGN_STRATEGIC_OBJECTIVES = ["AWARENESS", "TRAFFIC", "ENGAGEMENT", "LEAD_GENERATION", "CONVERSION", "RETENTION"] as const;

export type CampaignStrategicObjective = (typeof CAMPAIGN_STRATEGIC_OBJECTIVES)[number];

export const CAMPAIGN_STRATEGIC_FUNNEL_STAGES = ["TOFU", "MOFU", "BOFU", "RETENTION"] as const;

export type CampaignStrategicFunnelStage = (typeof CAMPAIGN_STRATEGIC_FUNNEL_STAGES)[number];

export const CAMPAIGN_INTENT_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export type CampaignIntentLevel = (typeof CAMPAIGN_INTENT_LEVELS)[number];

export const CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION = "SACP-04.04B";

export interface CampaignStrategySignal {
  readonly code: string;
  readonly message: string;
  readonly source: string;
}

export interface CampaignObjectiveFunnelStrategyMetadata {
  readonly strategyVersion: typeof CAMPAIGN_OBJECTIVE_FUNNEL_STRATEGY_VERSION;
  readonly sourceStrategyVersion: AiCampaignStrategy["strategyVersion"];
  readonly precedenceRule: "RETENTION_THEN_CONVERSION_THEN_CONSIDERATION_THEN_AWARENESS";
}

export interface CampaignObjectiveFunnelStrategy {
  readonly campaignStrategyId: string;
  readonly product: ProductCampaignContext;
  readonly channels: readonly CampaignChannel[];
  readonly markets: readonly string[];
  readonly selectedObjective: CampaignStrategicObjective;
  readonly funnelStage: CampaignStrategicFunnelStage;
  readonly intentLevel: CampaignIntentLevel;
  readonly reasoning: readonly string[];
  readonly supportingSignals: readonly CampaignStrategySignal[];
  readonly recommendedCampaignFocus: string;
  readonly recommendedCtaDirection: string;
  readonly advisoryOnly: true;
  readonly metadata: CampaignObjectiveFunnelStrategyMetadata;
}
