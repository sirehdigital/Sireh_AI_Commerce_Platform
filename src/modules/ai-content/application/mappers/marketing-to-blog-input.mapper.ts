import type { BlogContentGenerationInput, BlogObjective } from "../dto/blog-content.types.js";

export interface MarketingBlogInput {
  readonly customerPersona?: string;
  readonly customerSegment?: string;
  readonly awarenessLevel?: string;
  readonly customerJourneyStage?: string;
  readonly marketingAngle?: string;
  readonly valueProposition?: string;
  readonly campaignObjective?: BlogObjective;
  readonly targetMarket?: string;
  readonly campaignId?: string;
  readonly correlationId?: string;
  readonly sourceMarketingAnalysisId?: string;
}

export class MarketingToBlogInputMapper {
  public map(input: MarketingBlogInput): Partial<BlogContentGenerationInput> {
    return {
      ...(input.customerPersona === undefined ? {} : { customerPersona: input.customerPersona }),
      ...(input.customerSegment === undefined ? {} : { customerSegment: input.customerSegment }),
      ...(input.awarenessLevel === undefined ? {} : { awarenessLevel: input.awarenessLevel }),
      ...(input.customerJourneyStage === undefined ? {} : { customerJourneyStage: input.customerJourneyStage }),
      ...(input.marketingAngle === undefined ? {} : { marketingAngle: input.marketingAngle }),
      ...(input.valueProposition === undefined ? {} : { valueProposition: input.valueProposition }),
      ...(input.campaignObjective === undefined ? {} : { campaignObjective: input.campaignObjective }),
      ...(input.targetMarket === undefined ? {} : { targetMarket: input.targetMarket }),
      correlationMetadata: {
        ...(input.campaignId === undefined ? {} : { campaignId: input.campaignId }),
        ...(input.correlationId === undefined ? {} : { correlationId: input.correlationId }),
        ...(input.sourceMarketingAnalysisId === undefined ? {} : { sourceMarketingAnalysisId: input.sourceMarketingAnalysisId }),
        ...(input.customerJourneyStage === undefined ? {} : { customerJourneyReference: input.customerJourneyStage }),
      },
    };
  }
}
