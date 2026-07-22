import type { TargetMarket } from "../../../ai-product/types/product.types.js";

export type MarketingTone = "friendly" | "premium" | "expert" | "playful" | "minimal" | (string & {});

export interface MarketingContentInput {
  readonly productTitle: string;
  readonly productType?: string;
  readonly category?: string;
  readonly keyBenefits: readonly string[];
  readonly features: readonly string[];
  readonly targetAudience: string;
  readonly brandName: string;
  readonly targetMarket: TargetMarket | (string & {});
  readonly keywords: readonly string[];
  readonly tone: MarketingTone;
  readonly productUrl?: string;
}

export interface MarketingContent {
  readonly productTitle: string;
  readonly productDescription: string;
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly productTags: readonly string[];
  readonly facebookCaption: string;
  readonly instagramCaption: string;
  readonly tiktokCaption: string;
  readonly emailSubject: string;
  readonly emailBody: string;
  readonly callToAction: string;
}
