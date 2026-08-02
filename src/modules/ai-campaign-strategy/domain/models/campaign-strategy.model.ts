export const CAMPAIGN_OBJECTIVES = [
  "BRAND_AWARENESS",
  "PRODUCT_LAUNCH",
  "TRAFFIC",
  "LEAD_GENERATION",
  "CONVERSION",
  "RETARGETING",
  "CUSTOMER_RETENTION",
  "UPSELL",
  "CROSS_SELL",
] as const;

export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const CAMPAIGN_FUNNEL_STAGES = ["AWARENESS", "CONSIDERATION", "CONVERSION", "RETENTION"] as const;

export type CampaignFunnelStage = (typeof CAMPAIGN_FUNNEL_STAGES)[number];

export const CAMPAIGN_AWARENESS_LEVELS = [
  "UNAWARE",
  "PROBLEM_AWARE",
  "SOLUTION_AWARE",
  "PRODUCT_AWARE",
  "MOST_AWARE",
] as const;

export type CampaignAwarenessLevel = (typeof CAMPAIGN_AWARENESS_LEVELS)[number];

export interface CampaignAudienceProfile {
  readonly id: string;
  readonly name: string;
  readonly targetMarkets: readonly string[];
  readonly ageRange?: {
    readonly minimum: number;
    readonly maximum: number;
  };
  readonly interests: readonly string[];
  readonly painPoints: readonly string[];
  readonly desiredOutcomes: readonly string[];
  readonly objections: readonly string[];
  readonly buyingTriggers: readonly string[];
  readonly awarenessLevel: CampaignAwarenessLevel;
}

export interface ProductCampaignContext {
  readonly productId: string;
  readonly productName: string;
  readonly category: string;
  readonly description?: string;
  readonly keyBenefits: readonly string[];
  readonly differentiators: readonly string[];
  readonly knownRisks: readonly string[];
  readonly targetPrice?: number;
  readonly currency?: string;
  readonly markets: readonly string[];
}

export const CAMPAIGN_OFFER_TYPES = [
  "STANDARD",
  "PERCENTAGE_DISCOUNT",
  "FIXED_DISCOUNT",
  "BUNDLE",
  "BUY_MORE_SAVE_MORE",
  "FREE_SHIPPING",
  "FREE_GIFT",
  "LIMITED_TIME",
  "GUARANTEE",
] as const;

export type CampaignOfferType = (typeof CAMPAIGN_OFFER_TYPES)[number];

export interface CampaignOfferStrategy {
  readonly type: CampaignOfferType;
  readonly headline: string;
  readonly description?: string;
  readonly discountPercentage?: number;
  readonly discountAmount?: number;
  readonly currency?: string;
  readonly minimumQuantity?: number;
  readonly expiresAt?: string;
  readonly terms: readonly string[];
}

export const CAMPAIGN_MESSAGING_ANGLE_TYPES = [
  "PROBLEM_SOLUTION",
  "TRANSFORMATION",
  "CONVENIENCE",
  "EDUCATION",
  "SOCIAL_PROOF",
  "AUTHORITY",
  "COMPARISON",
  "URGENCY",
  "SEASONAL",
  "LIFESTYLE",
] as const;

export type CampaignMessagingAngleType = (typeof CAMPAIGN_MESSAGING_ANGLE_TYPES)[number];

export interface CampaignMessagingAngle {
  readonly type: CampaignMessagingAngleType;
  readonly headline: string;
  readonly coreMessage: string;
  readonly supportingPoints: readonly string[];
  readonly prohibitedClaims: readonly string[];
}

export const CAMPAIGN_CHANNELS = ["TIKTOK", "FACEBOOK", "INSTAGRAM", "EMAIL", "SHOPIFY_ONSITE", "RETARGETING"] as const;

export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

export type CampaignChannelRole = "PRIMARY" | "SUPPORTING" | "RETARGETING";

export interface CampaignChannelStrategy {
  readonly channel: CampaignChannel;
  readonly role: CampaignChannelRole;
  readonly funnelStages: readonly CampaignFunnelStage[];
  readonly contentFormats: readonly string[];
  readonly primaryCta: string;
  readonly notes: readonly string[];
}

export type CampaignStrategyStatus = "DRAFT" | "REVIEW_REQUIRED" | "MERCHANT_APPROVED" | "REJECTED";

export interface AiCampaignStrategy {
  readonly id: string;
  readonly product: ProductCampaignContext;
  readonly objective: CampaignObjective;
  readonly funnelStages: readonly CampaignFunnelStage[];
  readonly audience: CampaignAudienceProfile;
  readonly offer: CampaignOfferStrategy;
  readonly messagingAngles: readonly CampaignMessagingAngle[];
  readonly channels: readonly CampaignChannelStrategy[];
  readonly contentPillars: readonly string[];
  readonly risks: readonly string[];
  readonly warnings: readonly string[];
  readonly status: CampaignStrategyStatus;
  readonly strategyVersion: string;
  readonly createdAt: string;
}

