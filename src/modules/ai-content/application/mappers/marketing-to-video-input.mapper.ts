import type {
  VideoAudienceInput,
  VideoMarketingAngleInput,
  VideoObjective,
  VideoScriptGenerationInput,
} from "../dto/video-script.types.js";

export interface MarketingVideoInput {
  readonly audience?: VideoAudienceInput;
  readonly persona?: string;
  readonly marketingAngles?: readonly VideoMarketingAngleInput[];
  readonly valueProposition?: string;
  readonly campaignObjective?: VideoObjective;
  readonly campaignMessage?: string;
  readonly campaignId?: string;
  readonly sourceMarketingAnalysisId?: string;
}

export class MarketingToVideoInputMapper {
  public map(input: MarketingVideoInput): Partial<VideoScriptGenerationInput> {
    return {
      ...(input.audience === undefined ? {} : { targetAudience: input.audience }),
      ...(input.persona === undefined ? {} : { customerPersona: input.persona }),
      ...(input.marketingAngles === undefined ? {} : { marketingAngles: input.marketingAngles }),
      ...(input.valueProposition === undefined ? {} : { valueProposition: input.valueProposition }),
      ...(input.campaignObjective === undefined ? {} : { campaignObjective: input.campaignObjective }),
      ...(input.campaignMessage === undefined ? {} : { campaignMessage: input.campaignMessage }),
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
      ...(input.sourceMarketingAnalysisId === undefined
        ? {}
        : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
    };
  }
}
