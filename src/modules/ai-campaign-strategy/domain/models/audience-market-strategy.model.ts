import type { CampaignChannel, ProductCampaignContext } from "./campaign-strategy.model.js";
import type { CampaignObjectiveFunnelStrategy } from "./campaign-objective-funnel-strategy.model.js";

export const AUDIENCE_MARKET_SEGMENTS = [
  "DISCOVERY",
  "PROBLEM_AWARE",
  "SOLUTION_AWARE",
  "PRODUCT_AWARE",
  "HIGH_INTENT_BUYER",
  "EXISTING_CUSTOMER",
  "REPEAT_BUYER",
] as const;

export type AudienceMarketSegment = (typeof AUDIENCE_MARKET_SEGMENTS)[number];

export const MARKET_PRIORITY_LEVELS = ["PRIMARY", "SECONDARY", "EXPERIMENTAL", "NOT_RECOMMENDED"] as const;

export type MarketPriorityLevel = (typeof MARKET_PRIORITY_LEVELS)[number];

export const CHANNEL_FIT_LEVELS = ["PRIMARY", "SUPPORTING", "RETARGETING"] as const;

export type ChannelFitLevel = (typeof CHANNEL_FIT_LEVELS)[number];

export const AUDIENCE_MARKET_STRATEGY_VERSION = "SACP-04.04C";

export interface MarketPriority {
  readonly market: string;
  readonly priority: MarketPriorityLevel;
  readonly reason: string;
}

export interface ChannelFit {
  readonly channel: CampaignChannel;
  readonly fit: ChannelFitLevel;
  readonly reason: string;
}

export interface AudienceMarketEvidence {
  readonly code: string;
  readonly message: string;
  readonly source: string;
}

export interface AudienceMarketStrategyMetadata {
  readonly strategyVersion: typeof AUDIENCE_MARKET_STRATEGY_VERSION;
  readonly sourceStrategyVersion: string;
  readonly objectiveFunnelStrategyVersion: CampaignObjectiveFunnelStrategy["metadata"]["strategyVersion"];
}

export interface AudienceMarketStrategy {
  readonly campaignStrategyId: string;
  readonly product: ProductCampaignContext;
  readonly audienceSegment: AudienceMarketSegment;
  readonly audienceIntent: CampaignObjectiveFunnelStrategy["intentLevel"];
  readonly primaryMarket: string;
  readonly secondaryMarkets: readonly string[];
  readonly geographicPriority: readonly MarketPriority[];
  readonly audienceNeeds: readonly string[];
  readonly painPoints: readonly string[];
  readonly audienceMotivation: readonly string[];
  readonly messagingAngle: string;
  readonly channelFit: readonly ChannelFit[];
  readonly funnelAlignment: CampaignObjectiveFunnelStrategy["funnelStage"];
  readonly objectiveAlignment: CampaignObjectiveFunnelStrategy["selectedObjective"];
  readonly reason: readonly string[];
  readonly evidence: readonly AudienceMarketEvidence[];
  readonly advisoryOnly: true;
  readonly metadata: AudienceMarketStrategyMetadata;
}
