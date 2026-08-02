import type {
  CampaignAudienceProfile,
  CampaignChannel,
  CampaignMessagingAngleType,
  CampaignObjective,
  CampaignOfferStrategy,
  ProductCampaignContext,
} from "../../domain/models/campaign-strategy.model.js";

export interface CreateCampaignStrategyRequest {
  readonly product: ProductCampaignContext;
  readonly objective: CampaignObjective;
  readonly audience: CampaignAudienceProfile;
  readonly offer: CampaignOfferStrategy;
  readonly preferredAngles?: readonly CampaignMessagingAngleType[];
  readonly preferredChannels?: readonly CampaignChannel[];
  readonly createdAt: string;
}

