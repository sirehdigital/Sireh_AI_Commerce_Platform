import type {
  MarketingCampaign,
  MarketingCampaignListQuery,
  MarketingCampaignListResult,
  MarketingContentListQuery,
  MarketingContentListResult,
  MarketingGeneratedContent,
  MarketingStrategy,
  MarketingWorkflow,
} from "../models/index.js";

export interface MarketingRepository {
  saveCampaign(campaign: MarketingCampaign): Promise<MarketingCampaign>;
  findCampaignById(campaignId: string): Promise<MarketingCampaign | undefined>;
  listCampaigns(query?: MarketingCampaignListQuery): Promise<MarketingCampaignListResult>;
  saveContent(content: MarketingGeneratedContent): Promise<MarketingGeneratedContent>;
  findContentById(contentId: string): Promise<MarketingGeneratedContent | undefined>;
  listContent(query?: MarketingContentListQuery): Promise<MarketingContentListResult>;
  saveStrategy(strategy: MarketingStrategy): Promise<MarketingStrategy>;
  listStrategies(query?: { readonly tenantId?: string; readonly storeId?: string }): Promise<readonly MarketingStrategy[]>;
  saveWorkflow(workflow: MarketingWorkflow): Promise<MarketingWorkflow>;
  listWorkflows(query?: { readonly tenantId?: string; readonly storeId?: string }): Promise<readonly MarketingWorkflow[]>;
}
