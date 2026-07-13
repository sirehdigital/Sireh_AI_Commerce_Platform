import type {
  SEOContentAudienceInput,
  SEOContentGenerationInput,
  SEOContentMarketingAngleInput,
  SEOSearchIntent,
} from "../dto/seo-content.types.js";

export interface MarketingSEOInput {
  readonly audience?: SEOContentAudienceInput;
  readonly persona?: string;
  readonly marketingAngles?: readonly SEOContentMarketingAngleInput[];
  readonly valueProposition?: string;
  readonly searchIntentHints?: readonly SEOSearchIntent[];
  readonly campaignId?: string;
  readonly sourceMarketingAnalysisId?: string;
}

export class MarketingToSEOInputMapper {
  public merge(input: SEOContentGenerationInput, marketing: MarketingSEOInput): SEOContentGenerationInput {
    return {
      ...input,
      ...(marketing.audience === undefined ? {} : { marketingAudience: marketing.audience }),
      ...(marketing.persona === undefined ? {} : { customerPersona: marketing.persona }),
      ...(marketing.marketingAngles === undefined ? {} : { marketingAngles: marketing.marketingAngles }),
      ...(marketing.valueProposition === undefined ? {} : { valueProposition: marketing.valueProposition }),
      ...(marketing.searchIntentHints === undefined ? {} : { searchIntentHints: marketing.searchIntentHints }),
      ...(marketing.campaignId === undefined ? {} : { campaignId: marketing.campaignId }),
      ...(marketing.sourceMarketingAnalysisId === undefined
        ? {}
        : { sourceMarketingAnalysisId: marketing.sourceMarketingAnalysisId }),
    };
  }
}
