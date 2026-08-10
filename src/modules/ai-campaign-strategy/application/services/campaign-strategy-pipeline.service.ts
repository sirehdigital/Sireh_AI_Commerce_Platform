import type { CreateCampaignStrategyRequest } from "../dto/create-campaign-strategy.request.js";
import { AiCampaignStrategyService } from "./ai-campaign-strategy.service.js";
import { AudienceMarketStrategyEngine } from "./audience-market-strategy-engine.js";
import { BudgetChannelCreativeAllocationEngine } from "./budget-channel-creative-allocation-engine.js";
import { CampaignObjectiveFunnelStrategyEngine } from "./campaign-objective-funnel-strategy-engine.js";
import { CampaignStrategyRecommendationRiskEngine } from "./campaign-strategy-recommendation-risk-engine.js";
import type { AudienceMarketStrategy } from "../../domain/models/audience-market-strategy.model.js";
import type { BudgetAllocationInput, BudgetChannelCreativeAllocation } from "../../domain/models/budget-channel-creative-allocation.model.js";
import type { CampaignObjectiveFunnelStrategy } from "../../domain/models/campaign-objective-funnel-strategy.model.js";
import type { AiCampaignStrategy } from "../../domain/models/campaign-strategy.model.js";
import type { CampaignStrategyRecommendationRiskResult } from "../../domain/models/campaign-strategy-recommendation-risk.model.js";
import { CAMPAIGN_STRATEGY_PIPELINE_VERSION, type CampaignStrategyPipelineResult } from "../../domain/models/campaign-strategy-pipeline.model.js";

export class CampaignStrategyPipelineService {
  private readonly foundationService = new AiCampaignStrategyService();
  private readonly objectiveFunnelEngine = new CampaignObjectiveFunnelStrategyEngine();
  private readonly audienceMarketEngine = new AudienceMarketStrategyEngine();
  private readonly allocationEngine = new BudgetChannelCreativeAllocationEngine();
  private readonly recommendationRiskEngine = new CampaignStrategyRecommendationRiskEngine();

  public runPipeline(request: CreateCampaignStrategyRequest, budgetInput: BudgetAllocationInput = {}): CampaignStrategyPipelineResult {
    return this.runFromStrategy(this.foundationService.createStrategy(request), budgetInput);
  }

  public runFromStrategy(strategy: AiCampaignStrategy, budgetInput: BudgetAllocationInput = {}): CampaignStrategyPipelineResult {
    const objectiveFunnelStrategy = this.objectiveFunnelEngine.determineFromStrategy(strategy);
    const audienceMarketStrategy = this.audienceMarketEngine.determineFromStrategy(strategy, objectiveFunnelStrategy);
    const allocation = this.allocationEngine.allocateFromStrategy(strategy, objectiveFunnelStrategy, audienceMarketStrategy, budgetInput);
    const recommendationRiskResult = this.recommendationRiskEngine.evaluateFromAllocation(allocation);

    return this.finalizeFromRecommendationRiskResult(strategy, recommendationRiskResult);
  }

  public finalizeFromRecommendationRiskResult(
    strategy: AiCampaignStrategy,
    recommendationRiskResult: CampaignStrategyRecommendationRiskResult,
  ): CampaignStrategyPipelineResult {
    return this.toPipelineResult(
      strategy,
      recommendationRiskResult.objectiveFunnelStrategy,
      recommendationRiskResult.audienceMarketStrategy,
      recommendationRiskResult.budgetChannelCreativeAllocation,
      recommendationRiskResult,
    );
  }

  private toPipelineResult(
    strategy: AiCampaignStrategy,
    objectiveFunnelStrategy: CampaignObjectiveFunnelStrategy,
    audienceMarketStrategy: AudienceMarketStrategy,
    allocation: BudgetChannelCreativeAllocation,
    recommendationRiskResult: CampaignStrategyRecommendationRiskResult,
  ): CampaignStrategyPipelineResult {
    return {
      campaignStrategyId: strategy.id,
      product: this.cloneProduct(strategy.product),
      markets: allocation.markets.map((market) => ({ ...market })),
      channels: [...allocation.channels],
      objective: objectiveFunnelStrategy.selectedObjective,
      funnelStage: objectiveFunnelStrategy.funnelStage,
      intent: objectiveFunnelStrategy.intentLevel,
      foundationStrategy: this.cloneStrategy(strategy),
      objectiveFunnelStrategy: this.cloneObjectiveFunnelStrategy(objectiveFunnelStrategy),
      audienceStrategy: this.cloneAudienceMarketStrategy(audienceMarketStrategy),
      marketStrategy: this.cloneAudienceMarketStrategy(audienceMarketStrategy),
      budgetAllocation: this.cloneAllocation(allocation),
      channelAllocation: allocation.channelAllocations.map((channel) => ({ ...channel })),
      creativeAllocation: allocation.creativeMix.map((creative) => ({ ...creative })),
      recommendationRiskResult: this.cloneRecommendationRiskResult(recommendationRiskResult),
      recommendations: recommendationRiskResult.recommendations.map((recommendation) => this.cloneRecommendation(recommendation)),
      strategicRisks: recommendationRiskResult.riskFindings.map((risk) => this.cloneRisk(risk)),
      readinessStatus: recommendationRiskResult.readiness.status,
      requiresHumanReview: recommendationRiskResult.readiness.requiresHumanReview,
      advisoryOnly: true,
      metadata: {
        pipelineVersion: CAMPAIGN_STRATEGY_PIPELINE_VERSION,
        foundationStrategyVersion: strategy.strategyVersion,
        objectiveFunnelStrategyVersion: objectiveFunnelStrategy.metadata.strategyVersion,
        audienceMarketStrategyVersion: audienceMarketStrategy.metadata.strategyVersion,
        allocationStrategyVersion: allocation.metadata.strategyVersion,
        recommendationRiskStrategyVersion: recommendationRiskResult.metadata.strategyVersion,
        compositionRule: "FOUNDATION_THEN_OBJECTIVE_FUNNEL_THEN_AUDIENCE_MARKET_THEN_ALLOCATION_THEN_RECOMMENDATION_RISK",
        idempotencyBehavior: "STATELESS_EQUIVALENT_INPUT_RERUN_SAFE",
      },
    };
  }

  private cloneStrategy(strategy: AiCampaignStrategy): AiCampaignStrategy {
    return {
      ...strategy,
      product: this.cloneProduct(strategy.product),
      audience: {
        ...strategy.audience,
        targetMarkets: [...strategy.audience.targetMarkets],
        ...(strategy.audience.ageRange === undefined ? {} : { ageRange: { ...strategy.audience.ageRange } }),
        interests: [...strategy.audience.interests],
        painPoints: [...strategy.audience.painPoints],
        desiredOutcomes: [...strategy.audience.desiredOutcomes],
        objections: [...strategy.audience.objections],
        buyingTriggers: [...strategy.audience.buyingTriggers],
      },
      offer: {
        ...strategy.offer,
        terms: [...strategy.offer.terms],
      },
      funnelStages: [...strategy.funnelStages],
      messagingAngles: strategy.messagingAngles.map((angle) => ({
        ...angle,
        supportingPoints: [...angle.supportingPoints],
        prohibitedClaims: [...angle.prohibitedClaims],
      })),
      channels: strategy.channels.map((channel) => ({
        ...channel,
        funnelStages: [...channel.funnelStages],
        contentFormats: [...channel.contentFormats],
        notes: [...channel.notes],
      })),
      contentPillars: [...strategy.contentPillars],
      risks: [...strategy.risks],
      warnings: [...strategy.warnings],
    };
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

  private cloneObjectiveFunnelStrategy(strategy: CampaignObjectiveFunnelStrategy): CampaignObjectiveFunnelStrategy {
    return {
      ...strategy,
      product: this.cloneProduct(strategy.product),
      channels: [...strategy.channels],
      markets: [...strategy.markets],
      reasoning: [...strategy.reasoning],
      supportingSignals: strategy.supportingSignals.map((signal) => ({ ...signal })),
      metadata: { ...strategy.metadata },
    };
  }

  private cloneAudienceMarketStrategy(strategy: AudienceMarketStrategy): AudienceMarketStrategy {
    return {
      ...strategy,
      product: this.cloneProduct(strategy.product),
      secondaryMarkets: [...strategy.secondaryMarkets],
      geographicPriority: strategy.geographicPriority.map((market) => ({ ...market })),
      audienceNeeds: [...strategy.audienceNeeds],
      painPoints: [...strategy.painPoints],
      audienceMotivation: [...strategy.audienceMotivation],
      channelFit: strategy.channelFit.map((channel) => ({ ...channel })),
      reason: [...strategy.reason],
      evidence: strategy.evidence.map((evidence) => ({ ...evidence })),
      metadata: { ...strategy.metadata },
    };
  }

  private cloneAllocation(allocation: BudgetChannelCreativeAllocation): BudgetChannelCreativeAllocation {
    return {
      ...allocation,
      product: this.cloneProduct(allocation.product),
      objectiveFunnelStrategy: this.cloneObjectiveFunnelStrategy(allocation.objectiveFunnelStrategy),
      audienceMarketStrategy: this.cloneAudienceMarketStrategy(allocation.audienceMarketStrategy),
      channels: [...allocation.channels],
      markets: allocation.markets.map((market) => ({ ...market })),
      channelAllocations: allocation.channelAllocations.map((channel) => ({ ...channel })),
      creativeMix: allocation.creativeMix.map((creative) => ({ ...creative })),
      metadata: { ...allocation.metadata },
    };
  }

  private cloneRecommendationRiskResult(result: CampaignStrategyRecommendationRiskResult): CampaignStrategyRecommendationRiskResult {
    return {
      ...result,
      product: this.cloneProduct(result.product),
      objectiveFunnelStrategy: this.cloneObjectiveFunnelStrategy(result.objectiveFunnelStrategy),
      audienceMarketStrategy: this.cloneAudienceMarketStrategy(result.audienceMarketStrategy),
      budgetChannelCreativeAllocation: this.cloneAllocation(result.budgetChannelCreativeAllocation),
      markets: result.markets.map((market) => ({ ...market })),
      channels: [...result.channels],
      recommendations: result.recommendations.map((recommendation) => this.cloneRecommendation(recommendation)),
      riskFindings: result.riskFindings.map((risk) => this.cloneRisk(risk)),
      readiness: { ...result.readiness },
      metadata: { ...result.metadata },
    };
  }

  private cloneRecommendation(
    recommendation: CampaignStrategyRecommendationRiskResult["recommendations"][number],
  ): CampaignStrategyRecommendationRiskResult["recommendations"][number] {
    return {
      ...recommendation,
      evidence: recommendation.evidence.map((evidence) => ({ ...evidence })),
    };
  }

  private cloneRisk(risk: CampaignStrategyRecommendationRiskResult["riskFindings"][number]): CampaignStrategyRecommendationRiskResult["riskFindings"][number] {
    return {
      ...risk,
      evidence: risk.evidence.map((evidence) => ({ ...evidence })),
    };
  }
}
