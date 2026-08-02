import type { CampaignStrategyRepository } from "../../application/ports/campaign-strategy.repository.js";
import type { AiCampaignStrategy } from "../../domain/models/campaign-strategy.model.js";

export class InMemoryCampaignStrategyRepository implements CampaignStrategyRepository {
  private readonly strategiesById = new Map<string, AiCampaignStrategy>();

  public save(strategy: AiCampaignStrategy): Promise<AiCampaignStrategy> {
    const clone = this.cloneStrategy(strategy);
    this.strategiesById.set(clone.id, clone);
    return Promise.resolve(this.cloneStrategy(clone));
  }

  public findById(id: string): Promise<AiCampaignStrategy | null> {
    const strategy = this.strategiesById.get(id.trim());
    return Promise.resolve(strategy === undefined ? null : this.cloneStrategy(strategy));
  }

  public list(): Promise<readonly AiCampaignStrategy[]> {
    return Promise.resolve(
      [...this.strategiesById.values()]
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
        .map((strategy) => this.cloneStrategy(strategy)),
    );
  }

  public clear(): void {
    this.strategiesById.clear();
  }

  private cloneStrategy(strategy: AiCampaignStrategy): AiCampaignStrategy {
    return {
      ...strategy,
      product: {
        ...strategy.product,
        keyBenefits: [...strategy.product.keyBenefits],
        differentiators: [...strategy.product.differentiators],
        knownRisks: [...strategy.product.knownRisks],
        markets: [...strategy.product.markets],
      },
      funnelStages: [...strategy.funnelStages],
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
}

