import type {
  CreativeAssetType,
  CreativeBrief,
  CreativePlatform,
} from "../../domain/models/creative-intelligence.model.js";

export interface CreateCreativeIntelligenceRequest {
  readonly creativeId: string;
  readonly productId: string;
  readonly sourceContentId?: string;
  readonly assetType: CreativeAssetType;
  readonly platforms: readonly CreativePlatform[];
  readonly targetMarkets: readonly string[];
  readonly brief: CreativeBrief;
  readonly brandName?: string;
  readonly brandTone?: string;
  readonly registeredAt: string;
}
