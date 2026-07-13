import type { Content } from "../aggregates/content.aggregate.js";
import type {
  ContentChannel,
  ContentId,
  ContentPage,
  ContentPageRequest,
  ContentRepositoryFilter,
  ContentStatus,
  ContentType,
} from "../types/content.types.js";

export interface ContentRepository {
  save(content: Content): Promise<void>;
  findById(id: ContentId): Promise<Content | undefined>;
  findBySourceProductId(sourceProductId: string, page?: ContentPageRequest): Promise<ContentPage<Content>>;
  findByType(type: ContentType, page?: ContentPageRequest): Promise<ContentPage<Content>>;
  findByChannel(channel: ContentChannel, page?: ContentPageRequest): Promise<ContentPage<Content>>;
  findByStatus(status: ContentStatus, page?: ContentPageRequest): Promise<ContentPage<Content>>;
  findByCampaignId(campaignId: string, page?: ContentPageRequest): Promise<ContentPage<Content>>;
  search(filter: ContentRepositoryFilter, page?: ContentPageRequest): Promise<ContentPage<Content>>;
  archive(id: ContentId): Promise<void>;
}
