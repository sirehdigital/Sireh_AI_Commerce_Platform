import type { ContentTemplate } from "../entities/content-template.entity.js";
import type {
  ContentChannel,
  ContentPage,
  ContentPageRequest,
  ContentTemplateId,
  ContentType,
} from "../types/content.types.js";

export interface ContentTemplateRepository {
  save(template: ContentTemplate): Promise<void>;
  findById(id: ContentTemplateId): Promise<ContentTemplate | undefined>;
  findByContentType(type: ContentType, page?: ContentPageRequest): Promise<ContentPage<ContentTemplate>>;
  findByChannel(channel: ContentChannel, page?: ContentPageRequest): Promise<ContentPage<ContentTemplate>>;
  findActiveTemplates(page?: ContentPageRequest): Promise<ContentPage<ContentTemplate>>;
}
