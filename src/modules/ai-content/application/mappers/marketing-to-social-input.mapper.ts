import type {
  SocialAudienceInput,
  SocialMarketingAngleInput,
  SocialMediaContentGenerationInput,
  SocialObjective,
} from "../dto/social-media-content.types.js";

export interface MarketingSocialInput {
  readonly audience?: SocialAudienceInput;
  readonly persona?: string;
  readonly segment?: string;
  readonly marketingAngles?: readonly SocialMarketingAngleInput[];
  readonly valueProposition?: string;
  readonly campaignObjective?: SocialObjective;
  readonly campaignMessage?: string;
  readonly campaignId?: string;
  readonly sourceMarketingAnalysisId?: string;
}

export class MarketingToSocialInputMapper {
  public map(input: MarketingSocialInput): Partial<SocialMediaContentGenerationInput> {
    return {
      ...(input.audience === undefined ? {} : { targetAudience: input.audience }),
      ...(input.persona === undefined ? {} : { customerPersona: input.persona }),
      ...(input.segment === undefined ? {} : { customerSegment: input.segment }),
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
