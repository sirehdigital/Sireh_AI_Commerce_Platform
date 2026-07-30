import type {
  MarketingCampaign,
  MarketingCampaignListQuery,
  MarketingCampaignListResult,
  MarketingContentListQuery,
  MarketingContentListResult,
  MarketingRepository,
  MarketingGeneratedContent,
  MarketingStrategy,
  MarketingWorkflow,
} from "../../domain/index.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export class InMemoryMarketingRepository implements MarketingRepository {
  private readonly campaigns = new Map<string, MarketingCampaign>();
  private readonly contents = new Map<string, MarketingGeneratedContent>();
  private readonly strategies = new Map<string, MarketingStrategy>();
  private readonly workflows = new Map<string, MarketingWorkflow>();

  public saveCampaign(campaign: MarketingCampaign): Promise<MarketingCampaign> {
    this.campaigns.set(campaign.id, clone(campaign));
    return Promise.resolve(clone(campaign));
  }

  public findCampaignById(campaignId: string): Promise<MarketingCampaign | undefined> {
    const campaign = this.campaigns.get(campaignId);
    return Promise.resolve(campaign === undefined ? undefined : clone(campaign));
  }

  public listCampaigns(query: MarketingCampaignListQuery = {}): Promise<MarketingCampaignListResult> {
    const limit = this.limit(query.limit);
    const offset = this.offset(query.offset);
    const filtered = [...this.campaigns.values()]
      .filter((campaign) => query.tenantId === undefined || campaign.tenantId === query.tenantId)
      .filter((campaign) => query.storeId === undefined || campaign.storeId === query.storeId)
      .filter((campaign) => query.status === undefined || campaign.status === query.status)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const items = filtered.slice(offset, offset + limit).map((campaign) => clone(campaign));
    const nextOffset = offset + items.length;
    return Promise.resolve({
      items,
      total: filtered.length,
      limit,
      offset,
      hasNextPage: nextOffset < filtered.length,
      ...(nextOffset < filtered.length ? { nextOffset } : {}),
    });
  }

  public saveContent(content: MarketingGeneratedContent): Promise<MarketingGeneratedContent> {
    this.contents.set(content.id, clone(content));
    return Promise.resolve(clone(content));
  }

  public findContentById(contentId: string): Promise<MarketingGeneratedContent | undefined> {
    const content = this.contents.get(contentId);
    return Promise.resolve(content === undefined ? undefined : clone(content));
  }

  public listContent(query: MarketingContentListQuery = {}): Promise<MarketingContentListResult> {
    const limit = this.limit(query.limit);
    const offset = this.offset(query.offset);
    const filtered = [...this.contents.values()]
      .filter((content) => query.tenantId === undefined || content.tenantId === query.tenantId)
      .filter((content) => query.storeId === undefined || content.storeId === query.storeId)
      .filter((content) => query.campaignId === undefined || content.campaignId === query.campaignId)
      .filter((content) => query.channel === undefined || content.channel === query.channel)
      .filter((content) => query.workflowState === undefined || content.workflowState === query.workflowState)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const items = filtered.slice(offset, offset + limit).map((content) => clone(content));
    const nextOffset = offset + items.length;
    return Promise.resolve({
      items,
      total: filtered.length,
      limit,
      offset,
      hasNextPage: nextOffset < filtered.length,
      ...(nextOffset < filtered.length ? { nextOffset } : {}),
    });
  }

  public saveStrategy(strategy: MarketingStrategy): Promise<MarketingStrategy> {
    this.strategies.set(strategy.id, clone(strategy));
    return Promise.resolve(clone(strategy));
  }

  public listStrategies(query: { readonly tenantId?: string; readonly storeId?: string } = {}): Promise<readonly MarketingStrategy[]> {
    return Promise.resolve([...this.strategies.values()]
      .filter((strategy) => query.tenantId === undefined || strategy.tenantId === query.tenantId)
      .filter((strategy) => query.storeId === undefined || strategy.storeId === query.storeId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((strategy) => clone(strategy)));
  }

  public saveWorkflow(workflow: MarketingWorkflow): Promise<MarketingWorkflow> {
    this.workflows.set(workflow.id, clone(workflow));
    return Promise.resolve(clone(workflow));
  }

  public listWorkflows(query: { readonly tenantId?: string; readonly storeId?: string } = {}): Promise<readonly MarketingWorkflow[]> {
    return Promise.resolve([...this.workflows.values()]
      .filter((workflow) => query.tenantId === undefined || workflow.tenantId === query.tenantId)
      .filter((workflow) => query.storeId === undefined || workflow.storeId === query.storeId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((workflow) => clone(workflow)));
  }

  private limit(value: number | undefined): number {
    if (value === undefined) {
      return DEFAULT_LIMIT;
    }
    if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
      throw new MarketingRepositoryError("Marketing list limit is outside the allowed range.");
    }
    return value;
  }

  private offset(value: number | undefined): number {
    if (value === undefined) {
      return 0;
    }
    if (!Number.isInteger(value) || value < 0) {
      throw new MarketingRepositoryError("Marketing list offset must be non-negative.");
    }
    return value;
  }
}

export class MarketingRepositoryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "MarketingRepositoryError";
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
