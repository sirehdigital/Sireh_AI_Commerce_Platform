import type { CreativeIntelligenceRecord } from "../../domain/models/creative-intelligence.model.js";

export interface CreativeIntelligenceRepository {
  save(record: CreativeIntelligenceRecord): Promise<CreativeIntelligenceRecord>;
  findById(id: string): Promise<CreativeIntelligenceRecord | null>;
  findByCreativeId(creativeId: string): Promise<CreativeIntelligenceRecord | null>;
  list(): Promise<readonly CreativeIntelligenceRecord[]>;
}
