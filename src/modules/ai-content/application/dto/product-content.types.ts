import type {
  Content,
  ContentChannel,
  ContentLanguage,
  ContentSnapshot,
  ContentTemplateId,
  ContentTone,
} from "../../domain/index.js";

export type ProductContentDesiredLength = "short" | "standard" | "long";

export interface ProductContentPricingInput {
  readonly currency?: string;
  readonly sellingPrice?: number;
  readonly compareAtPrice?: number;
}

export interface ProductContentSupplierInput {
  readonly supplierName?: string;
  readonly shippingOrigin?: string;
  readonly estimatedDeliveryDaysMin?: number;
  readonly estimatedDeliveryDaysMax?: number;
}

export interface ProductContentAnalysisInput {
  readonly summary?: string;
  readonly keyBenefits?: readonly string[];
  readonly keyFeatures?: readonly string[];
  readonly recommendation?: string;
  readonly reasoning?: string;
}

export interface ProductContentRiskInput {
  readonly level?: string;
  readonly reasons?: readonly string[];
}

export interface ProductContentMarketingAngleInput {
  readonly title: string;
  readonly hook?: string;
  readonly coreBenefit?: string;
  readonly emotionalOutcome?: string;
  readonly targetAudience?: string;
}

export interface ProductContentAudienceInput {
  readonly primaryAudience?: string;
  readonly targetMarket?: string;
  readonly description?: string;
  readonly customerProblems?: readonly string[];
  readonly customerDesires?: readonly string[];
  readonly purchaseMotivations?: readonly string[];
  readonly objections?: readonly string[];
}

export interface ProductContentGenerationInput {
  readonly productId: string;
  readonly productTitle: string;
  readonly productDescription?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly features?: readonly string[];
  readonly benefits?: readonly string[];
  readonly tags?: readonly string[];
  readonly supplier?: ProductContentSupplierInput;
  readonly pricing?: ProductContentPricingInput;
  readonly targetMarkets?: readonly string[];
  readonly productAnalysis?: ProductContentAnalysisInput;
  readonly productRisk?: ProductContentRiskInput;
  readonly brandPositioning?: string;
  readonly marketingAudience?: ProductContentAudienceInput;
  readonly customerPersona?: string;
  readonly valueProposition?: string;
  readonly marketingAngles?: readonly ProductContentMarketingAngleInput[];
  readonly tone?: ContentTone;
  readonly language?: ContentLanguage;
  readonly channel?: ContentChannel;
  readonly templateId?: ContentTemplateId;
  readonly correlationId?: string;
  readonly campaignId?: string;
  readonly sourceMarketingAnalysisId?: string;
}

export interface ProductContentGenerationOptions {
  readonly tone: ContentTone;
  readonly language: ContentLanguage;
  readonly channel: ContentChannel;
  readonly desiredLength: ProductContentDesiredLength;
  readonly benefitCount: number;
  readonly featureCount: number;
  readonly faqCount: number;
  readonly ctaCount: number;
  readonly includeUsageGuidance: boolean;
  readonly includeObjectionHandling: boolean;
  readonly includeTrustContent: boolean;
  readonly templateId?: ContentTemplateId;
  readonly strictClaimSafety: boolean;
}

export interface ProductContentGenerationOptionsInput {
  readonly tone?: ContentTone;
  readonly language?: ContentLanguage;
  readonly channel?: ContentChannel;
  readonly desiredLength?: ProductContentDesiredLength;
  readonly benefitCount?: number;
  readonly featureCount?: number;
  readonly faqCount?: number;
  readonly ctaCount?: number;
  readonly includeUsageGuidance?: boolean;
  readonly includeObjectionHandling?: boolean;
  readonly includeTrustContent?: boolean;
  readonly templateId?: ContentTemplateId;
  readonly strictClaimSafety?: boolean;
}

export interface ProductFAQItem {
  readonly question: string;
  readonly answer: string;
}

export interface ShopifyReadyProductCopyPackage {
  readonly title: string;
  readonly subtitle: string;
  readonly descriptionHtml: string;
  readonly benefits: readonly string[];
  readonly features: readonly string[];
  readonly highlights: readonly string[];
  readonly callsToAction: readonly string[];
}

export interface ProductContentPackage {
  readonly productId: string;
  readonly channel: ContentChannel;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly title: Content;
  readonly subtitle: Content;
  readonly shortDescription: Content;
  readonly longDescription: Content;
  readonly benefits: readonly Content[];
  readonly features: readonly Content[];
  readonly highlights: readonly Content[];
  readonly problemStatement: Content;
  readonly solutionStatement: Content;
  readonly valueProposition: Content;
  readonly targetAudienceStatement: Content;
  readonly brandPositioningStatement: Content;
  readonly usageGuidance?: Content;
  readonly trustBuildingCopy?: Content;
  readonly objectionHandlingCopy?: Content;
  readonly faq: readonly ProductFAQItem[];
  readonly callsToAction: readonly Content[];
  readonly shopifyReady: ShopifyReadyProductCopyPackage;
  readonly contents: readonly Content[];
  readonly generatedAt: Date;
}

export interface ProductContentPackageSnapshot {
  readonly productId: string;
  readonly channel: ContentChannel;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly contents: readonly ContentSnapshot[];
  readonly faq: readonly ProductFAQItem[];
  readonly shopifyReady: ShopifyReadyProductCopyPackage;
  readonly generatedAt: Date;
}
