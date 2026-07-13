import type { ContentTemplate } from "../entities/content-template.entity.js";
import type { ContentTemplateSnapshot } from "../types/content.types.js";

export interface ContentTemplateMapper<TTarget> {
  toTarget(template: ContentTemplate): TTarget;
  toDomain(source: TTarget): ContentTemplate;
}

export interface ContentTemplateSnapshotMapper {
  toSnapshot(template: ContentTemplate): ContentTemplateSnapshot;
}
