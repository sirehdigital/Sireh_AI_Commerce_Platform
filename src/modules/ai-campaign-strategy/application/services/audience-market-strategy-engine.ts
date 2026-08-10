import type { CreateCampaignStrategyRequest } from "../dto/create-campaign-strategy.request.js";
import { AiCampaignStrategyService } from "./ai-campaign-strategy.service.js";
import { CampaignObjectiveFunnelStrategyEngine } from "./campaign-objective-funnel-strategy-engine.js";
import type { AiCampaignStrategy, CampaignChannelRole } from "../../domain/models/campaign-strategy.model.js";
import type { CampaignObjectiveFunnelStrategy } from "../../domain/models/campaign-objective-funnel-strategy.model.js";
import {
  AUDIENCE_MARKET_STRATEGY_VERSION,
  type AudienceMarketEvidence,
  type AudienceMarketSegment,
  type AudienceMarketStrategy,
  type ChannelFit,
  type MarketPriority,
  type MarketPriorityLevel,
} from "../../domain/models/audience-market-strategy.model.js";

export class AudienceMarketStrategyEngine {
  private readonly strategyService = new AiCampaignStrategyService();
  private readonly objectiveFunnelEngine = new CampaignObjectiveFunnelStrategyEngine();

  public determineStrategy(request: CreateCampaignStrategyRequest): AudienceMarketStrategy {
    const campaignStrategy = this.strategyService.createStrategy(request);
    return this.determineFromStrategy(campaignStrategy, this.objectiveFunnelEngine.determineFromStrategy(campaignStrategy));
  }

  public determineFromStrategy(
    campaignStrategy: AiCampaignStrategy,
    objectiveFunnelStrategy: CampaignObjectiveFunnelStrategy = this.objectiveFunnelEngine.determineFromStrategy(campaignStrategy),
  ): AudienceMarketStrategy {
    const geographicPriority = this.prioritizeMarkets(campaignStrategy);
    const primaryMarket = geographicPriority.find((market) => market.priority === "PRIMARY")?.market ?? geographicPriority[0]?.market ?? "UNSPECIFIED";
    const secondaryMarkets = geographicPriority.filter((market) => market.priority === "SECONDARY").map((market) => market.market);
    const audienceSegment = this.deriveAudienceSegment(campaignStrategy, objectiveFunnelStrategy);
    const channelFit = this.deriveChannelFit(campaignStrategy);
    const evidence = this.buildEvidence(campaignStrategy, objectiveFunnelStrategy, geographicPriority, audienceSegment);

    return {
      campaignStrategyId: campaignStrategy.id,
      product: this.cloneProduct(campaignStrategy.product),
      audienceSegment,
      audienceIntent: objectiveFunnelStrategy.intentLevel,
      primaryMarket,
      secondaryMarkets,
      geographicPriority,
      audienceNeeds: [...campaignStrategy.audience.desiredOutcomes],
      painPoints: [...campaignStrategy.audience.painPoints],
      audienceMotivation: [...campaignStrategy.audience.buyingTriggers],
      messagingAngle: campaignStrategy.messagingAngles[0]?.type ?? "EDUCATION",
      channelFit,
      funnelAlignment: objectiveFunnelStrategy.funnelStage,
      objectiveAlignment: objectiveFunnelStrategy.selectedObjective,
      reason: evidence.map((entry) => entry.message),
      evidence,
      advisoryOnly: true,
      metadata: {
        strategyVersion: AUDIENCE_MARKET_STRATEGY_VERSION,
        sourceStrategyVersion: campaignStrategy.strategyVersion,
        objectiveFunnelStrategyVersion: objectiveFunnelStrategy.metadata.strategyVersion,
      },
    };
  }

  private deriveAudienceSegment(strategy: AiCampaignStrategy, objectiveFunnel: CampaignObjectiveFunnelStrategy): AudienceMarketSegment {
    if (objectiveFunnel.funnelStage === "RETENTION") {
      return this.containsAny(strategy.audience.buyingTriggers, ["repeat", "reorder", "renew", "upgrade"]) ? "REPEAT_BUYER" : "EXISTING_CUSTOMER";
    }

    if (objectiveFunnel.funnelStage === "BOFU") {
      return "HIGH_INTENT_BUYER";
    }

    if (objectiveFunnel.funnelStage === "MOFU") {
      return strategy.audience.awarenessLevel === "PRODUCT_AWARE" ? "PRODUCT_AWARE" : "SOLUTION_AWARE";
    }

    return strategy.audience.awarenessLevel === "PROBLEM_AWARE" ? "PROBLEM_AWARE" : "DISCOVERY";
  }

  private prioritizeMarkets(strategy: AiCampaignStrategy): readonly MarketPriority[] {
    const productMarkets = strategy.product.markets;
    const audienceMarkets = strategy.audience.targetMarkets;
    const audienceMarketSet = new Set(audienceMarkets.map((market) => market.toUpperCase()));
    const productMarketSet = new Set(productMarkets.map((market) => market.toUpperCase()));
    const orderedMarkets = this.uniqueOrdered([...productMarkets, ...audienceMarkets]);
    const overlappingMarkets = orderedMarkets.filter((market) => productMarketSet.has(market.toUpperCase()) && audienceMarketSet.has(market.toUpperCase()));

    if (overlappingMarkets.length === 0) {
      return orderedMarkets.map((market, index) => ({
        market,
        priority: index === 0 ? "EXPERIMENTAL" : "NOT_RECOMMENDED",
        reason:
          index === 0
            ? "No product/audience market overlap was supplied; this market is experimental pending human review."
            : "Market is not recommended until product and audience market evidence align.",
      }));
    }

    const primaryMarket = overlappingMarkets[0];
    return orderedMarkets.map((market) => ({
      market,
      priority: this.marketPriority(market, primaryMarket, overlappingMarkets, productMarketSet, audienceMarketSet),
      reason: this.marketReason(market, primaryMarket, overlappingMarkets, productMarketSet, audienceMarketSet),
    }));
  }

  private marketPriority(
    market: string,
    primaryMarket: string | undefined,
    overlappingMarkets: readonly string[],
    productMarketSet: ReadonlySet<string>,
    audienceMarketSet: ReadonlySet<string>,
  ): MarketPriorityLevel {
    if (market === primaryMarket) {
      return "PRIMARY";
    }

    if (overlappingMarkets.includes(market) || productMarketSet.has(market.toUpperCase())) {
      return "SECONDARY";
    }

    if (audienceMarketSet.has(market.toUpperCase())) {
      return "EXPERIMENTAL";
    }

    return "NOT_RECOMMENDED";
  }

  private marketReason(
    market: string,
    primaryMarket: string | undefined,
    overlappingMarkets: readonly string[],
    productMarketSet: ReadonlySet<string>,
    audienceMarketSet: ReadonlySet<string>,
  ): string {
    if (market === primaryMarket) {
      return "Product and audience market evidence overlap first on this market.";
    }

    if (overlappingMarkets.includes(market)) {
      return "Product and audience market evidence overlap on this secondary market.";
    }

    if (productMarketSet.has(market.toUpperCase())) {
      return "Product market exists, but audience market evidence is weaker.";
    }

    if (audienceMarketSet.has(market.toUpperCase())) {
      return "Audience market exists without matching product market evidence.";
    }

    return "Insufficient market evidence was supplied.";
  }

  private deriveChannelFit(strategy: AiCampaignStrategy): readonly ChannelFit[] {
    return strategy.channels.map((channel) => ({
      channel: channel.channel,
      fit: this.toChannelFit(channel.role),
      reason: `${channel.channel} is already associated as a ${channel.role.toLowerCase()} channel in the campaign strategy.`,
    }));
  }

  private toChannelFit(role: CampaignChannelRole): ChannelFit["fit"] {
    if (role === "PRIMARY") {
      return "PRIMARY";
    }

    if (role === "RETARGETING") {
      return "RETARGETING";
    }

    return "SUPPORTING";
  }

  private buildEvidence(
    strategy: AiCampaignStrategy,
    objectiveFunnel: CampaignObjectiveFunnelStrategy,
    geographicPriority: readonly MarketPriority[],
    audienceSegment: AudienceMarketSegment,
  ): readonly AudienceMarketEvidence[] {
    return [
      {
        code: "AUDIENCE_SEGMENT_FROM_FUNNEL",
        message: `${audienceSegment} segment was derived from ${objectiveFunnel.funnelStage} funnel alignment and structured audience signals.`,
        source: "objectiveFunnel.funnelStage",
      },
      {
        code: "MARKET_PRIORITY_FROM_ASSOCIATIONS",
        message: `${geographicPriority[0]?.market ?? "UNSPECIFIED"} is the highest-ranked market from supplied product/audience associations.`,
        source: "product.markets,audience.targetMarkets",
      },
      {
        code: "CHANNEL_FIT_FROM_CAMPAIGN_CHANNELS",
        message: `${strategy.channels.length} campaign channel association(s) were mapped to advisory channel fit.`,
        source: "channels",
      },
      {
        code: "OBJECTIVE_FUNNEL_ALIGNMENT",
        message: `${objectiveFunnel.selectedObjective} objective aligns with ${objectiveFunnel.funnelStage} funnel strategy.`,
        source: "objectiveFunnel",
      },
    ];
  }

  private containsAny(values: readonly string[], needles: readonly string[]): boolean {
    const normalizedValues = values.map((value) => value.toLowerCase());
    return needles.some((needle) => normalizedValues.some((value) => value.includes(needle)));
  }

  private cloneProduct(product: AiCampaignStrategy["product"]): AiCampaignStrategy["product"] {
    return {
      productId: product.productId,
      productName: product.productName,
      category: product.category,
      ...(product.description === undefined ? {} : { description: product.description }),
      keyBenefits: [...product.keyBenefits],
      differentiators: [...product.differentiators],
      knownRisks: [...product.knownRisks],
      ...(product.targetPrice === undefined ? {} : { targetPrice: product.targetPrice }),
      ...(product.currency === undefined ? {} : { currency: product.currency }),
      markets: [...product.markets],
    };
  }

  private uniqueOrdered(values: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const value of values) {
      const key = value.toUpperCase();
      if (!seen.has(key)) {
        seen.add(key);
        output.push(value);
      }
    }

    return output;
  }
}
