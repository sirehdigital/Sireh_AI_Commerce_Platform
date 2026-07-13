import type {
  Content,
  ContentChannel,
  ContentLanguage,
  ContentSearchIntent,
  ContentSEO,
  ContentTemplateId,
  MetaDescription,
  MetaTitle,
  SEOKeyword,
  Slug,
} from "../../domain/index.js";
import type { ProductContentPackage } from "./product-content.types.js";

export type SEOSearchIntent = ContentSearchIntent | "local" | "comparison";
export type SEOIndexabilityRecommendation = "index-follow" | "noindex-follow" | "noindex-nofollow";
export type SEOSlugStrategy = "primary-keyword" | "product-identity";

export interface SEOContentMarketingAngleInput {
  readonly title: string;
  readonly hook?: string;
  readonly coreBenefit?: string;
  readonly targetAudience?: string;
}

export interface SEOContentAudienceInput {
  readonly primaryAudience?: string;
  readonly targetMarket?: string;
  readonly description?: string;
  readonly customerProblems?: readonly string[];
  readonly purchaseMotivations?: readonly string[];
}

export interface SEOContentGenerationInput {
  readonly productId: string;
  readonly productTitle: string;
  readonly productSubtitle?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly productDescription?: string;
  readonly benefits?: readonly string[];
  readonly features?: readonly string[];
  readonly tags?: readonly string[];
  readonly targetMarkets?: readonly string[];
  readonly productKeywords?: readonly string[];
  readonly productRiskFlags?: readonly string[];
  readonly productContentPackage?: ProductContentPackage;
  readonly marketingAudience?: SEOContentAudienceInput;
  readonly customerPersona?: string;
  readonly marketingAngles?: readonly SEOContentMarketingAngleInput[];
  readonly valueProposition?: string;
  readonly searchIntentHints?: readonly SEOSearchIntent[];
  readonly preferredLanguage?: ContentLanguage;
  readonly targetChannel?: ContentChannel;
  readonly correlationId?: string;
  readonly campaignId?: string;
  readonly sourceMarketingAnalysisId?: string;
  readonly templateId?: ContentTemplateId;
}

export interface SEOContentGenerationOptions {
  readonly language: ContentLanguage;
  readonly channel: ContentChannel;
  readonly targetMarket?: string;
  readonly preferredPrimaryKeyword?: string;
  readonly maxSecondaryKeywords: number;
  readonly maxLongTailKeywords: number;
  readonly metaTitleMaxLength: number;
  readonly metaDescriptionMaxLength: number;
  readonly slugStrategy: SEOSlugStrategy;
  readonly searchIntent: SEOSearchIntent;
  readonly includeImageAltText: boolean;
  readonly includeInternalLinks: boolean;
  readonly includeCanonical: boolean;
  readonly strictKeywordSafety: boolean;
  readonly strictClaimSafety: boolean;
  readonly templateId?: ContentTemplateId;
}

export interface SEOContentGenerationOptionsInput {
  readonly language?: ContentLanguage;
  readonly channel?: ContentChannel;
  readonly targetMarket?: string;
  readonly preferredPrimaryKeyword?: string;
  readonly maxSecondaryKeywords?: number;
  readonly maxLongTailKeywords?: number;
  readonly metaTitleMaxLength?: number;
  readonly metaDescriptionMaxLength?: number;
  readonly slugStrategy?: SEOSlugStrategy;
  readonly searchIntent?: SEOSearchIntent;
  readonly includeImageAltText?: boolean;
  readonly includeInternalLinks?: boolean;
  readonly includeCanonical?: boolean;
  readonly strictKeywordSafety?: boolean;
  readonly strictClaimSafety?: boolean;
  readonly templateId?: ContentTemplateId;
}

export interface SEOKeywordSet {
  readonly primaryKeyword: SEOKeyword;
  readonly secondaryKeywords: readonly SEOKeyword[];
  readonly longTailKeywords: readonly SEOKeyword[];
  readonly semanticVariants: readonly SEOKeyword[];
}

export interface SEOImageAltTextSuggestion {
  readonly text: string;
  readonly context: string;
}

export interface SEOInternalLinkAnchorSuggestion {
  readonly anchorText: string;
  readonly context: string;
  readonly suggestedPath?: string;
}

export interface SEOStructuredDataHint {
  readonly type: "Product" | "Offer" | "Brand" | "FAQPage" | "BreadcrumbList";
  readonly reason: string;
}

export interface SEOKeywordPlacementGuidance {
  readonly location: string;
  readonly guidance: string;
}

export interface SEOReadinessCheck {
  readonly passed: boolean;
  readonly checks: readonly string[];
  readonly warnings: readonly string[];
}

export interface SEOContentPackage {
  readonly productId: string;
  readonly language: ContentLanguage;
  readonly channel: ContentChannel;
  readonly targetMarket?: string;
  readonly keywords: SEOKeywordSet;
  readonly searchIntent: SEOSearchIntent;
  readonly seoProductTitle: string;
  readonly metaTitle: MetaTitle;
  readonly metaDescription: MetaDescription;
  readonly slug: Slug;
  readonly h1: string;
  readonly h2Headings: readonly string[];
  readonly seoSummary: string;
  readonly imageAltTextSuggestions: readonly SEOImageAltTextSuggestion[];
  readonly internalLinkAnchors: readonly SEOInternalLinkAnchorSuggestion[];
  readonly canonicalPath?: string;
  readonly indexability: SEOIndexabilityRecommendation;
  readonly structuredDataHints: readonly SEOStructuredDataHint[];
  readonly keywordPlacementGuidance: readonly SEOKeywordPlacementGuidance[];
  readonly warnings: readonly string[];
  readonly readiness: SEOReadinessCheck;
  readonly contentSEO: ContentSEO;
  readonly contents: readonly Content[];
  readonly generatedAt: Date;
}
