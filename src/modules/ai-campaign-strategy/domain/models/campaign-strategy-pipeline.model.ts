import type { AudienceMarketStrategy } from "./audience-market-strategy.model.js";
import type { BudgetChannelCreativeAllocation, ChannelBudgetAllocation, CreativeMixAllocation } from "./budget-channel-creative-allocation.model.js";
import type { CampaignObjectiveFunnelStrategy } from "./campaign-objective-funnel-strategy.model.js";
import type { AiCampaignStrategy, CampaignChannel, ProductCampaignContext } from "./campaign-strategy.model.js";
import type { CampaignStrategyReadiness, CampaignStrategyRecommendation, CampaignStrategyRecommendationRiskResult, CampaignStrategyRiskFinding } from "./campaign-strategy-recommendation-risk.model.js";

export const CAMPAIGN_STRATEGY_PIPELINE_VERSION = "SACP-04.04F";

export interface CampaignStrategyPipelineMetadata {
  readonly pipelineVersion: typeof CAMPAIGN_STRATEGY_PIPELINE_VERSION;
  readonly foundationStrategyVersion: AiCampaignStrategy["strategyVersion"];
  readonly objectiveFunnelStrategyVersion: CampaignObjectiveFunnelStrategy["metadata"]["strategyVersion"];
  readonly audienceMarketStrategyVersion: AudienceMarketStrategy["metadata"]["strategyVersion"];
  readonly allocationStrategyVersion: BudgetChannelCreativeAllocation["metadata"]["strategyVersion"];
  readonly recommendationRiskStrategyVersion: CampaignStrategyRecommendationRiskResult["metadata"]["strategyVersion"];
  readonly compositionRule: "FOUNDATION_THEN_OBJECTIVE_FUNNEL_THEN_AUDIENCE_MARKET_THEN_ALLOCATION_THEN_RECOMMENDATION_RISK";
  readonly idempotencyBehavior: "STATELESS_EQUIVALENT_INPUT_RERUN_SAFE";
}

export interface CampaignStrategyPipelineResult {
  readonly campaignStrategyId: string;
  readonly product: ProductCampaignContext;
  readonly markets: BudgetChannelCreativeAllocation["markets"];
  readonly channels: readonly CampaignChannel[];
  readonly objective: CampaignObjectiveFunnelStrategy["selectedObjective"];
  readonly funnelStage: CampaignObjectiveFunnelStrategy["funnelStage"];
  readonly intent: CampaignObjectiveFunnelStrategy["intentLevel"];
  readonly foundationStrategy: AiCampaignStrategy;
  readonly objectiveFunnelStrategy: CampaignObjectiveFunnelStrategy;
  readonly audienceStrategy: AudienceMarketStrategy;
  readonly marketStrategy: AudienceMarketStrategy;
  readonly budgetAllocation: BudgetChannelCreativeAllocation;
  readonly channelAllocation: readonly ChannelBudgetAllocation[];
  readonly creativeAllocation: readonly CreativeMixAllocation[];
  readonly recommendationRiskResult: CampaignStrategyRecommendationRiskResult;
  readonly recommendations: readonly CampaignStrategyRecommendation[];
  readonly strategicRisks: readonly CampaignStrategyRiskFinding[];
  readonly readinessStatus: CampaignStrategyReadiness["status"];
  readonly requiresHumanReview: boolean;
  readonly advisoryOnly: true;
  readonly metadata: CampaignStrategyPipelineMetadata;
}
