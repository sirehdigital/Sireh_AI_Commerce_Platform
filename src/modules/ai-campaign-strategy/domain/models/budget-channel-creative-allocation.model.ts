import type { AudienceMarketStrategy } from "./audience-market-strategy.model.js";
import type { CampaignObjectiveFunnelStrategy } from "./campaign-objective-funnel-strategy.model.js";
import type { CampaignChannel, ProductCampaignContext } from "./campaign-strategy.model.js";

export const BUDGET_ALLOCATION_PRIORITIES = ["PRIMARY", "SUPPORTING", "TEST", "RETARGETING"] as const;

export type BudgetAllocationPriority = (typeof BUDGET_ALLOCATION_PRIORITIES)[number];

export const CREATIVE_ALLOCATION_ROLES = [
  "AWARENESS",
  "EDUCATIONAL",
  "PRODUCT_DEMONSTRATION",
  "SOCIAL_PROOF",
  "OFFER",
  "RETARGETING",
  "RETENTION",
] as const;

export type CreativeAllocationRole = (typeof CREATIVE_ALLOCATION_ROLES)[number];

export const BUDGET_CHANNEL_CREATIVE_ALLOCATION_VERSION = "SACP-04.04D";

export interface BudgetAllocationInput {
  readonly totalBudget?: number;
  readonly currency?: string;
}

export interface ChannelBudgetAllocation {
  readonly channel: CampaignChannel;
  readonly priority: BudgetAllocationPriority;
  readonly allocationPercentage: number;
  readonly allocationAmount?: number;
  readonly rationale: string;
}

export interface CreativeMixAllocation {
  readonly creativeRole: CreativeAllocationRole;
  readonly recommendedPercentage: number;
  readonly reason: string;
  readonly objectiveAlignment: CampaignObjectiveFunnelStrategy["selectedObjective"];
  readonly funnelAlignment: CampaignObjectiveFunnelStrategy["funnelStage"];
}

export interface BudgetChannelCreativeAllocationMetadata {
  readonly strategyVersion: typeof BUDGET_CHANNEL_CREATIVE_ALLOCATION_VERSION;
  readonly sourceStrategyVersion: string;
  readonly objectiveFunnelStrategyVersion: CampaignObjectiveFunnelStrategy["metadata"]["strategyVersion"];
  readonly audienceMarketStrategyVersion: AudienceMarketStrategy["metadata"]["strategyVersion"];
  readonly roundingRule: "BASIS_POINTS_THEN_CENTS_LARGEST_REMAINDER";
}

export interface BudgetChannelCreativeAllocation {
  readonly campaignStrategyId: string;
  readonly product: ProductCampaignContext;
  readonly objectiveFunnelStrategy: CampaignObjectiveFunnelStrategy;
  readonly audienceMarketStrategy: AudienceMarketStrategy;
  readonly channels: readonly CampaignChannel[];
  readonly markets: AudienceMarketStrategy["geographicPriority"];
  readonly totalBudget?: number;
  readonly currency?: string;
  readonly channelAllocations: readonly ChannelBudgetAllocation[];
  readonly creativeMix: readonly CreativeMixAllocation[];
  readonly advisoryOnly: true;
  readonly metadata: BudgetChannelCreativeAllocationMetadata;
}
