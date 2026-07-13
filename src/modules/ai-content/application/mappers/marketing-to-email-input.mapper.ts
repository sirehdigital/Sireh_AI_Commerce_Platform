import type { EmailAudienceInput, EmailContentGenerationInput, EmailObjective } from "../dto/email-content.types.js";

export interface MarketingEmailInput {
  readonly audience?: EmailAudienceInput;
  readonly persona?: string;
  readonly segment?: string;
  readonly marketingAngle?: string;
  readonly valueProposition?: string;
  readonly campaignObjective?: EmailObjective;
  readonly campaignId?: string;
  readonly sourceMarketingAnalysisId?: string;
}

export class MarketingToEmailInputMapper {
  public map(input: MarketingEmailInput): Partial<EmailContentGenerationInput> {
    return {
      ...(input.audience === undefined ? {} : { targetAudience: input.audience }),
      ...(input.persona === undefined ? {} : { customerPersona: input.persona }),
      ...(input.segment === undefined ? {} : { customerSegment: input.segment }),
      ...(input.marketingAngle === undefined ? {} : { marketingAngle: input.marketingAngle }),
      ...(input.valueProposition === undefined ? {} : { valueProposition: input.valueProposition }),
      ...(input.campaignObjective === undefined ? {} : { campaignObjective: input.campaignObjective }),
      ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
      ...(input.sourceMarketingAnalysisId === undefined ? {} : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
    };
  }
}
