import type { AiCampaignStrategy } from "../../domain/models/campaign-strategy.model.js";

export interface CampaignStrategyRepository {
  save(strategy: AiCampaignStrategy): Promise<AiCampaignStrategy>;
  findById(id: string): Promise<AiCampaignStrategy | null>;
  list(): Promise<readonly AiCampaignStrategy[]>;
}

