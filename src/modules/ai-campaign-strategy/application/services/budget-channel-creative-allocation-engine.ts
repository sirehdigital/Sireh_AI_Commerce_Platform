import type { CreateCampaignStrategyRequest } from "../dto/create-campaign-strategy.request.js";
import { AiCampaignStrategyService } from "./ai-campaign-strategy.service.js";
import { AudienceMarketStrategyEngine } from "./audience-market-strategy-engine.js";
import { CampaignObjectiveFunnelStrategyEngine } from "./campaign-objective-funnel-strategy-engine.js";
import { InvalidCampaignRequestError } from "../../domain/errors/campaign-strategy.errors.js";
import type { AudienceMarketStrategy } from "../../domain/models/audience-market-strategy.model.js";
import type { CampaignObjectiveFunnelStrategy, CampaignStrategicFunnelStage } from "../../domain/models/campaign-objective-funnel-strategy.model.js";
import type { AiCampaignStrategy, CampaignChannel, CampaignChannelRole } from "../../domain/models/campaign-strategy.model.js";
import {
  BUDGET_CHANNEL_CREATIVE_ALLOCATION_VERSION,
  type BudgetAllocationInput,
  type BudgetAllocationPriority,
  type BudgetChannelCreativeAllocation,
  type ChannelBudgetAllocation,
  type CreativeAllocationRole,
  type CreativeMixAllocation,
} from "../../domain/models/budget-channel-creative-allocation.model.js";

interface WeightedItem<TValue extends string> {
  readonly value: TValue;
  readonly weight: number;
}

export class BudgetChannelCreativeAllocationEngine {
  private readonly strategyService = new AiCampaignStrategyService();
  private readonly objectiveFunnelEngine = new CampaignObjectiveFunnelStrategyEngine();
  private readonly audienceMarketEngine = new AudienceMarketStrategyEngine();

  public allocateStrategy(request: CreateCampaignStrategyRequest, budgetInput: BudgetAllocationInput = {}): BudgetChannelCreativeAllocation {
    const campaignStrategy = this.strategyService.createStrategy(request);
    const objectiveFunnelStrategy = this.objectiveFunnelEngine.determineFromStrategy(campaignStrategy);
    const audienceMarketStrategy = this.audienceMarketEngine.determineFromStrategy(campaignStrategy, objectiveFunnelStrategy);

    return this.allocateFromStrategy(campaignStrategy, objectiveFunnelStrategy, audienceMarketStrategy, budgetInput);
  }

  public allocateFromStrategy(
    campaignStrategy: AiCampaignStrategy,
    objectiveFunnelStrategy: CampaignObjectiveFunnelStrategy = this.objectiveFunnelEngine.determineFromStrategy(campaignStrategy),
    audienceMarketStrategy: AudienceMarketStrategy = this.audienceMarketEngine.determineFromStrategy(campaignStrategy, objectiveFunnelStrategy),
    budgetInput: BudgetAllocationInput = {},
  ): BudgetChannelCreativeAllocation {
    const normalizedBudget = this.normalizeBudgetInput(budgetInput);
    const channelPercentages = this.allocatePercentages(
      campaignStrategy.channels.map((channel) => ({
        value: channel.channel,
        weight: this.channelWeight(objectiveFunnelStrategy.funnelStage, channel.channel, channel.role),
      })),
    );
    const channelAmounts =
      normalizedBudget.totalBudget === undefined ? undefined : this.allocateAmounts(normalizedBudget.totalBudget, channelPercentages.map((entry) => entry.percentage));
    const creativePercentages = this.allocatePercentages(this.creativeWeights(objectiveFunnelStrategy.funnelStage));

    return {
      campaignStrategyId: campaignStrategy.id,
      product: this.cloneProduct(campaignStrategy.product),
      objectiveFunnelStrategy: this.cloneObjectiveFunnelStrategy(objectiveFunnelStrategy),
      audienceMarketStrategy: this.cloneAudienceMarketStrategy(audienceMarketStrategy),
      channels: campaignStrategy.channels.map((channel) => channel.channel),
      markets: audienceMarketStrategy.geographicPriority.map((market) => ({ ...market })),
      ...(normalizedBudget.totalBudget === undefined ? {} : { totalBudget: normalizedBudget.totalBudget }),
      ...(normalizedBudget.currency === undefined ? {} : { currency: normalizedBudget.currency }),
      channelAllocations: campaignStrategy.channels.map((channel, index) =>
        this.buildChannelAllocation(channel.channel, channel.role, objectiveFunnelStrategy.funnelStage, channelPercentages[index]?.percentage ?? 0, channelAmounts?.[index]),
      ),
      creativeMix: creativePercentages.map((entry) =>
        this.buildCreativeAllocation(entry.value, entry.percentage, objectiveFunnelStrategy.selectedObjective, objectiveFunnelStrategy.funnelStage),
      ),
      advisoryOnly: true,
      metadata: {
        strategyVersion: BUDGET_CHANNEL_CREATIVE_ALLOCATION_VERSION,
        sourceStrategyVersion: campaignStrategy.strategyVersion,
        objectiveFunnelStrategyVersion: objectiveFunnelStrategy.metadata.strategyVersion,
        audienceMarketStrategyVersion: audienceMarketStrategy.metadata.strategyVersion,
        roundingRule: "BASIS_POINTS_THEN_CENTS_LARGEST_REMAINDER",
      },
    };
  }

  private normalizeBudgetInput(input: BudgetAllocationInput): BudgetAllocationInput {
    if (input.totalBudget !== undefined && (!Number.isFinite(input.totalBudget) || input.totalBudget < 0)) {
      throw new InvalidCampaignRequestError("Campaign budget must be a finite non-negative number.", { totalBudget: input.totalBudget });
    }

    if (input.currency !== undefined && !/^[A-Za-z]{3}$/u.test(input.currency.trim())) {
      throw new InvalidCampaignRequestError("Campaign budget currency must be a three-letter code.", { currency: input.currency });
    }

    return {
      ...(input.totalBudget === undefined ? {} : { totalBudget: Math.round(input.totalBudget * 100) / 100 }),
      ...(input.currency === undefined ? {} : { currency: input.currency.trim().toUpperCase() }),
    };
  }

  private channelWeight(funnelStage: CampaignStrategicFunnelStage, channel: CampaignChannel, role: CampaignChannelRole): number {
    if (funnelStage === "RETENTION") {
      if (channel === "EMAIL") {
        return 5;
      }

      if (channel === "SHOPIFY_ONSITE") {
        return 4;
      }

      if (role === "RETARGETING") {
        return 3;
      }

      return role === "PRIMARY" ? 2 : 1;
    }

    if (funnelStage === "BOFU") {
      return role === "RETARGETING" ? 4 : role === "PRIMARY" ? 3 : 1;
    }

    if (funnelStage === "MOFU") {
      return role === "RETARGETING" ? 1 : role === "PRIMARY" || role === "SUPPORTING" ? 2 : 1;
    }

    return role === "PRIMARY" ? 3 : role === "RETARGETING" ? 1 : 1;
  }

  private channelPriority(funnelStage: CampaignStrategicFunnelStage, channel: CampaignChannel, role: CampaignChannelRole): BudgetAllocationPriority {
    if (role === "RETARGETING") {
      return "RETARGETING";
    }

    if (funnelStage === "RETENTION" && (channel === "EMAIL" || channel === "SHOPIFY_ONSITE")) {
      return "PRIMARY";
    }

    if (role === "PRIMARY") {
      return "PRIMARY";
    }

    return funnelStage === "TOFU" ? "TEST" : "SUPPORTING";
  }

  private buildChannelAllocation(
    channel: CampaignChannel,
    role: CampaignChannelRole,
    funnelStage: CampaignStrategicFunnelStage,
    allocationPercentage: number,
    allocationAmount: number | undefined,
  ): ChannelBudgetAllocation {
    return {
      channel,
      priority: this.channelPriority(funnelStage, channel, role),
      allocationPercentage,
      ...(allocationAmount === undefined ? {} : { allocationAmount }),
      rationale: `${channel} receives ${allocationPercentage.toFixed(2)}% because it is an existing ${role.toLowerCase()} channel aligned to ${funnelStage}.`,
    };
  }

  private creativeWeights(funnelStage: CampaignStrategicFunnelStage): readonly WeightedItem<CreativeAllocationRole>[] {
    if (funnelStage === "RETENTION") {
      return [
        { value: "RETENTION", weight: 45 },
        { value: "OFFER", weight: 25 },
        { value: "SOCIAL_PROOF", weight: 15 },
        { value: "EDUCATIONAL", weight: 15 },
      ];
    }

    if (funnelStage === "BOFU") {
      return [
        { value: "OFFER", weight: 35 },
        { value: "PRODUCT_DEMONSTRATION", weight: 25 },
        { value: "SOCIAL_PROOF", weight: 20 },
        { value: "RETARGETING", weight: 20 },
      ];
    }

    if (funnelStage === "MOFU") {
      return [
        { value: "EDUCATIONAL", weight: 35 },
        { value: "PRODUCT_DEMONSTRATION", weight: 30 },
        { value: "SOCIAL_PROOF", weight: 20 },
        { value: "OFFER", weight: 15 },
      ];
    }

    return [
      { value: "AWARENESS", weight: 40 },
      { value: "EDUCATIONAL", weight: 25 },
      { value: "PRODUCT_DEMONSTRATION", weight: 20 },
      { value: "SOCIAL_PROOF", weight: 15 },
    ];
  }

  private buildCreativeAllocation(
    creativeRole: CreativeAllocationRole,
    recommendedPercentage: number,
    objectiveAlignment: CreativeMixAllocation["objectiveAlignment"],
    funnelAlignment: CampaignStrategicFunnelStage,
  ): CreativeMixAllocation {
    return {
      creativeRole,
      recommendedPercentage,
      reason: `${creativeRole} creative share is aligned to ${objectiveAlignment} / ${funnelAlignment} strategy without generating creative assets.`,
      objectiveAlignment,
      funnelAlignment,
    };
  }

  private allocatePercentages<TValue extends string>(items: readonly WeightedItem<TValue>[]): readonly { readonly value: TValue; readonly percentage: number }[] {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (items.length === 0 || totalWeight <= 0) {
      return [];
    }

    const raw = items.map((item, index) => {
      const exactBasisPoints = (item.weight / totalWeight) * 10_000;
      const basisPoints = Math.floor(exactBasisPoints);
      return { item, index, basisPoints, remainder: exactBasisPoints - basisPoints };
    });
    let remaining = 10_000 - raw.reduce((sum, entry) => sum + entry.basisPoints, 0);
    const orderedByRemainder = [...raw].sort((left, right) => right.remainder - left.remainder || left.index - right.index);

    for (const entry of orderedByRemainder) {
      if (remaining <= 0) {
        break;
      }

      entry.basisPoints += 1;
      remaining -= 1;
    }

    return raw.sort((left, right) => left.index - right.index).map((entry) => ({ value: entry.item.value, percentage: entry.basisPoints / 100 }));
  }

  private allocateAmounts(totalBudget: number, percentages: readonly number[]): readonly number[] {
    const totalCents = Math.round(totalBudget * 100);
    const raw = percentages.map((percentage, index) => {
      const exactCents = (totalCents * percentage) / 100;
      const cents = Math.floor(exactCents);
      return { index, cents, remainder: exactCents - cents };
    });
    let remaining = totalCents - raw.reduce((sum, entry) => sum + entry.cents, 0);
    const orderedByRemainder = [...raw].sort((left, right) => right.remainder - left.remainder || left.index - right.index);

    for (const entry of orderedByRemainder) {
      if (remaining <= 0) {
        break;
      }

      entry.cents += 1;
      remaining -= 1;
    }

    return raw.sort((left, right) => left.index - right.index).map((entry) => entry.cents / 100);
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
}
