import type {
  ProductContentAudienceInput,
  ProductContentGenerationInput,
  ProductContentMarketingAngleInput,
} from "../dto/product-content.types.js";

export interface MarketingContentInput {
  readonly valueProposition?: string;
  readonly brandPositioning?: string;
  readonly audience?: ProductContentAudienceInput;
  readonly persona?: string;
  readonly marketingAngles?: readonly ProductContentMarketingAngleInput[];
  readonly campaignId?: string;
  readonly sourceMarketingAnalysisId?: string;
}

export class MarketingToContentInputMapper {
  public merge(
    input: ProductContentGenerationInput,
    marketing: MarketingContentInput,
  ): ProductContentGenerationInput {
    return {
      ...input,
      ...(marketing.valueProposition === undefined
        ? {}
        : { valueProposition: marketing.valueProposition }),
      ...(marketing.brandPositioning === undefined
        ? {}
        : { brandPositioning: marketing.brandPositioning }),
      ...(marketing.audience === undefined ? {} : { marketingAudience: marketing.audience }),
      ...(marketing.persona === undefined ? {} : { customerPersona: marketing.persona }),
      ...(marketing.marketingAngles === undefined ? {} : { marketingAngles: marketing.marketingAngles }),
      ...(marketing.campaignId === undefined ? {} : { campaignId: marketing.campaignId }),
      ...(marketing.sourceMarketingAnalysisId === undefined
        ? {}
        : { sourceMarketingAnalysisId: marketing.sourceMarketingAnalysisId }),
    };
  }
}
