import type { Content } from "../aggregates/content.aggregate.js";
import type { ContentSnapshot } from "../types/content.types.js";

export interface ContentMapper<TTarget> {
  toTarget(content: Content): TTarget;
  toDomain(source: TTarget): Content;
}

export interface ContentPersistenceMapper<TPersistence> {
  toPersistence(content: Content): TPersistence;
  toDomain(record: TPersistence): Content;
}

export interface ContentDTOMapper<TDTO> {
  toDTO(content: Content): TDTO;
}

export interface ContentSnapshotMapper {
  toSnapshot(content: Content): ContentSnapshot;
}
