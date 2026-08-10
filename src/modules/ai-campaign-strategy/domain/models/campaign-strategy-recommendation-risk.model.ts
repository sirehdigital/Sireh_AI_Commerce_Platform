import type { AudienceMarketStrategy } from "./audience-market-strategy.model.js";
import type { BudgetChannelCreativeAllocation } from "./budget-channel-creative-allocation.model.js";
import type { CampaignObjectiveFunnelStrategy, CampaignStrategicFunnelStage } from "./campaign-objective-funnel-strategy.model.js";
import type { CampaignChannel, ProductCampaignContext } from "./campaign-strategy.model.js";

export const CAMPAIGN_STRATEGY_RECOMMENDATION_CATEGORIES = [
  "OBJECTIVE_ALIGNMENT",
  "FUNNEL_ALIGNMENT",
  "AUDIENCE_ALIGNMENT",
  "MARKET_ALIGNMENT",
  "CHANNEL_ALLOCATION",
  "BUDGET_ALLOCATION",
  "CREATIVE_MIX",
  "RETARGETING_STRATEGY",
  "RETENTION_STRATEGY",
  "HUMAN_REVIEW_REQUIRED",
] as const;

export type CampaignStrategyRecommendationCategory = (typeof CAMPAIGN_STRATEGY_RECOMMENDATION_CATEGORIES)[number];

export const CAMPAIGN_STRATEGY_RECOMMENDATION_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type CampaignStrategyRecommendationPriority = (typeof CAMPAIGN_STRATEGY_RECOMMENDATION_PRIORITIES)[number];

export const CAMPAIGN_STRATEGY_RISK_CATEGORIES = [
  "OBJECTIVE_FUNNEL_MISMATCH",
  "AUDIENCE_FUNNEL_MISMATCH",
  "MARKET_EVIDENCE_INSUFFICIENT",
  "CHANNEL_CONCENTRATION",
  "CHANNEL_ROLE_MISMATCH",
  "BUDGET_TOO_FRAGMENTED",
  "BUDGET_ALLOCATION_IMBALANCE",
  "CREATIVE_MIX_MISMATCH",
  "RETARGETING_GAP",
  "RETENTION_GAP",
  "INVALID_STRATEGY_COMBINATION",
  "OTHER",
] as const;

export type CampaignStrategyRiskCategory = (typeof CAMPAIGN_STRATEGY_RISK_CATEGORIES)[number];

export const CAMPAIGN_STRATEGY_RISK_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type CampaignStrategyRiskSeverity = (typeof CAMPAIGN_STRATEGY_RISK_SEVERITIES)[number];

export const CAMPAIGN_STRATEGY_READINESS_STATUSES = ["READY", "READY_WITH_REVIEW", "NOT_READY"] as const;

export type CampaignStrategyReadinessStatus = (typeof CAMPAIGN_STRATEGY_READINESS_STATUSES)[number];

export const CAMPAIGN_STRATEGY_RECOMMENDATION_RISK_VERSION = "SACP-04.04E";

export interface CampaignStrategyRecommendationEvidence {
  readonly source: string;
  readonly code: string;
  readonly summary: string;
}

export interface CampaignStrategyRecommendation {
  readonly code: string;
  readonly category: CampaignStrategyRecommendationCategory;
  readonly priority: CampaignStrategyRecommendationPriority;
  readonly reason: string;
  readonly recommendedAction: string;
  readonly evidence: readonly CampaignStrategyRecommendationEvidence[];
  readonly relatedObjective?: CampaignObjectiveFunnelStrategy["selectedObjective"];
  readonly relatedFunnel?: CampaignStrategicFunnelStage;
  readonly relatedAudience?: AudienceMarketStrategy["audienceSegment"];
  readonly relatedMarket?: string;
  readonly relatedChannel?: CampaignChannel;
  readonly advisoryOnly: true;
}

export interface CampaignStrategyRiskFinding {
  readonly code: string;
  readonly category: CampaignStrategyRiskCategory;
  readonly severity: CampaignStrategyRiskSeverity;
  readonly reason: string;
  readonly evidence: readonly CampaignStrategyRecommendationEvidence[];
  readonly recommendedAction: string;
  readonly advisoryOnly: true;
}

export interface CampaignStrategyReadiness {
  readonly status: CampaignStrategyReadinessStatus;
  readonly requiresHumanReview: boolean;
  readonly reason: string;
  readonly highestRiskSeverity?: CampaignStrategyRiskSeverity;
  readonly advisoryOnly: true;
}

export interface CampaignStrategyRecommendationRiskMetadata {
  readonly strategyVersion: typeof CAMPAIGN_STRATEGY_RECOMMENDATION_RISK_VERSION;
  readonly allocationStrategyVersion: BudgetChannelCreativeAllocation["metadata"]["strategyVersion"];
  readonly objectiveFunnelStrategyVersion: CampaignObjectiveFunnelStrategy["metadata"]["strategyVersion"];
  readonly audienceMarketStrategyVersion: AudienceMarketStrategy["metadata"]["strategyVersion"];
  readonly orderingRule: "RISK_ORDER_THEN_RECOMMENDATION_ORDER_BY_STABLE_CODE";
}

export interface CampaignStrategyRecommendationRiskResult {
  readonly campaignStrategyId: string;
  readonly product: ProductCampaignContext;
  readonly objectiveFunnelStrategy: CampaignObjectiveFunnelStrategy;
  readonly audienceMarketStrategy: AudienceMarketStrategy;
  readonly budgetChannelCreativeAllocation: BudgetChannelCreativeAllocation;
  readonly markets: BudgetChannelCreativeAllocation["markets"];
  readonly channels: readonly CampaignChannel[];
  readonly recommendations: readonly CampaignStrategyRecommendation[];
  readonly riskFindings: readonly CampaignStrategyRiskFinding[];
  readonly readiness: CampaignStrategyReadiness;
  readonly advisoryOnly: true;
  readonly metadata: CampaignStrategyRecommendationRiskMetadata;
}
