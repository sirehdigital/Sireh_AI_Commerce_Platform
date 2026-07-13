import type {
  Content,
  ContentChannel,
  ContentLanguage,
  ContentSearchIntent,
  ContentTemplateId,
  ContentTone,
  CTA,
} from "../../domain/index.js";
import type { EmailContentPackage } from "./email-content.types.js";
import type { ProductContentPackage } from "./product-content.types.js";
import type { SEOContentPackage } from "./seo-content.types.js";
import type { SocialMediaContentPackage } from "./social-media-content.types.js";
import type { VideoScriptPackage } from "./video-script.types.js";

export type BlogArticleType =
  | "educational-article"
  | "product-guide"
  | "buying-guide"
  | "how-to-article"
  | "faq-article"
  | "problem-solution-article"
  | "feature-spotlight"
  | "benefits-article"
  | "product-comparison-framework"
  | "brand-story"
  | "product-launch-article"
  | "list-article"
  | "myth-versus-fact-framework"
  | "beginner-guide"
  | "customer-objection-article"
  | "use-case-article"
  | "product-care-article"
  | "industry-insight-framework"
  | "seasonal-article"
  | "trend-article";

export type BlogObjective =
  | "awareness"
  | "education"
  | "seo-traffic"
  | "product-discovery"
  | "consideration"
  | "conversion-support"
  | "objection-handling"
  | "brand-authority"
  | "customer-support"
  | "retention"
  | "product-launch"
  | "relationship-building";

export type BlogArticleLength = "short" | "medium" | "long" | "comprehensive";
export type BlogChannel = Extract<ContentChannel, "blog" | "website" | "shopify" | "generic">;
export type BlogHeadingDepth = "h2" | "h3";

export interface BlogAudienceInput {
  readonly primaryAudience?: string;
  readonly customerSegment?: string;
  readonly personaReference?: string;
  readonly awarenessLevel?: string;
  readonly journeyStage?: string;
  readonly description?: string;
  readonly problems?: readonly string[];
  readonly motivations?: readonly string[];
  readonly objections?: readonly string[];
}

export interface BlogVerifiedFact {
  readonly fact: string;
  readonly sourceReference?: string;
}

export interface BlogSourceReference {
  readonly label: string;
  readonly referenceType: "product-documentation" | "brand-documentation" | "verified-research" | "approved-guideline";
}

export interface BlogCorrelationMetadata {
  readonly campaignId?: string;
  readonly correlationId?: string;
  readonly sourceMarketingAnalysisId?: string;
  readonly customerJourneyReference?: string;
  readonly templateId?: ContentTemplateId;
}

export interface BlogContentGenerationInput {
  readonly productId: string;
  readonly productTitle: string;
  readonly productSubtitle?: string;
  readonly brand?: string;
  readonly category?: string;
  readonly productType?: string;
  readonly productDescription?: string;
  readonly benefits?: readonly string[];
  readonly features?: readonly string[];
  readonly highlights?: readonly string[];
  readonly productRisks?: readonly string[];
  readonly usageGuidance?: readonly string[];
  readonly materialsOrIngredients?: readonly string[];
  readonly productContentPackage?: ProductContentPackage;
  readonly seoContentPackage?: SEOContentPackage;
  readonly socialMediaContentPackage?: SocialMediaContentPackage;
  readonly videoScriptPackage?: VideoScriptPackage;
  readonly emailContentPackage?: EmailContentPackage;
  readonly targetAudience?: BlogAudienceInput;
  readonly customerPersona?: string;
  readonly customerSegment?: string;
  readonly awarenessLevel?: string;
  readonly customerJourneyStage?: string;
  readonly marketingAngle?: string;
  readonly valueProposition?: string;
  readonly campaignObjective?: BlogObjective;
  readonly searchIntent?: ContentSearchIntent;
  readonly targetMarket?: string;
  readonly language?: ContentLanguage;
  readonly tone?: ContentTone;
  readonly verifiedResearchFacts?: readonly BlogVerifiedFact[];
  readonly sourceReferences?: readonly BlogSourceReference[];
  readonly seasonOrEvent?: string;
  readonly trendContext?: string;
  readonly correlationMetadata?: BlogCorrelationMetadata;
}

export interface BlogContentGenerationOptionsInput {
  readonly articleType?: BlogArticleType;
  readonly objective?: BlogObjective;
  readonly channel?: BlogChannel;
  readonly language?: ContentLanguage;
  readonly tone?: ContentTone;
  readonly articleLength?: BlogArticleLength;
  readonly targetWordCount?: number;
  readonly sectionCount?: number;
  readonly headingDepth?: BlogHeadingDepth;
  readonly faqCount?: number;
  readonly ctaCount?: number;
  readonly includeProductExamples?: boolean;
  readonly includeProductComparisonFramework?: boolean;
  readonly includeObjectionHandling?: boolean;
  readonly includeFAQ?: boolean;
  readonly includeInternalLinkGuidance?: boolean;
  readonly includeExternalSourcePlaceholders?: boolean;
  readonly includeImagePlacementGuidance?: boolean;
  readonly includeFeaturedImageConcept?: boolean;
  readonly includeSEOMetadata?: boolean;
  readonly includeStructuredSummary?: boolean;
  readonly strictClaimSafetyMode?: boolean;
  readonly strictEditorialEvidenceMode?: boolean;
  readonly strictSEOMode?: boolean;
  readonly strictReadabilityMode?: boolean;
  readonly templateId?: ContentTemplateId;
}

export interface BlogContentGenerationOptions {
  readonly articleType: BlogArticleType;
  readonly objective: BlogObjective;
  readonly channel: BlogChannel;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly articleLength: BlogArticleLength;
  readonly targetWordCount: number;
  readonly sectionCount: number;
  readonly headingDepth: BlogHeadingDepth;
  readonly faqCount: number;
  readonly ctaCount: number;
  readonly includeProductExamples: boolean;
  readonly includeProductComparisonFramework: boolean;
  readonly includeObjectionHandling: boolean;
  readonly includeFAQ: boolean;
  readonly includeInternalLinkGuidance: boolean;
  readonly includeExternalSourcePlaceholders: boolean;
  readonly includeImagePlacementGuidance: boolean;
  readonly includeFeaturedImageConcept: boolean;
  readonly includeSEOMetadata: boolean;
  readonly includeStructuredSummary: boolean;
  readonly strictClaimSafetyMode: boolean;
  readonly strictEditorialEvidenceMode: boolean;
  readonly strictSEOMode: boolean;
  readonly strictReadabilityMode: boolean;
  readonly templateId?: ContentTemplateId;
}

export interface BlogTitleOption {
  readonly style: string;
  readonly title: string;
}

export interface BlogOutlineItem {
  readonly order: number;
  readonly heading: string;
  readonly purpose: string;
  readonly targetWordAllocation: number;
  readonly primaryTopic: string;
  readonly supportingFacts: readonly string[];
  readonly productRelevance: string;
  readonly ctaMarker: boolean;
}

export interface BlogSection {
  readonly order: number;
  readonly heading: string;
  readonly purpose: string;
  readonly paragraphs: readonly string[];
  readonly bulletPoints: readonly string[];
  readonly productReferences: readonly string[];
  readonly keywordGuidance: readonly string[];
  readonly internalLinkAnchorSuggestion?: string;
  readonly imagePlacementSuggestion?: string;
  readonly complianceNote?: string;
  readonly sourceEvidenceRequired: boolean;
}

export interface BlogFAQItem {
  readonly question: string;
  readonly answer: string;
  readonly evidenceRequired: boolean;
}

export interface BlogLinkGuidance {
  readonly anchorText: string;
  readonly suggestedTarget: string;
  readonly guidance: string;
}

export interface BlogImageGuidance {
  readonly placement: string;
  readonly concept: string;
  readonly altText: string;
}

export interface BlogReadingMetrics {
  readonly estimatedWordCount: number;
  readonly estimatedReadingMinutes: number;
  readonly articleLength: BlogArticleLength;
  readonly targetRange: readonly [number, number];
}

export interface BlogValidationSummary {
  readonly warnings: readonly BlogWarning[];
  readonly complianceNotes: readonly string[];
  readonly readabilityNotes: readonly string[];
  readonly evidencePlaceholders: readonly string[];
}

export interface BlogWarning {
  readonly code: string;
  readonly message: string;
}

export interface BlogContentPackage {
  readonly productId: string;
  readonly articleType: BlogArticleType;
  readonly objective: BlogObjective;
  readonly targetAudience?: BlogAudienceInput;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly channel: BlogChannel;
  readonly searchIntent: ContentSearchIntent;
  readonly primaryKeyword: string;
  readonly secondaryKeywords: readonly string[];
  readonly titleOptions: readonly BlogTitleOption[];
  readonly recommendedTitle: string;
  readonly slug: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly articleSummary: string;
  readonly introduction: string;
  readonly outline: readonly BlogOutlineItem[];
  readonly sections: readonly BlogSection[];
  readonly subheadings: readonly string[];
  readonly productExamples: readonly string[];
  readonly benefitExplanations: readonly string[];
  readonly featureExplanations: readonly string[];
  readonly useCaseExplanations: readonly string[];
  readonly objectionHandlingSection?: BlogSection;
  readonly faqSection: readonly BlogFAQItem[];
  readonly conclusion: string;
  readonly primaryCTA: CTA;
  readonly secondaryCTA?: CTA;
  readonly internalLinkAnchorSuggestions: readonly BlogLinkGuidance[];
  readonly externalSourcePlaceholderGuidance: readonly string[];
  readonly imagePlacementSuggestions: readonly BlogImageGuidance[];
  readonly imageAltTextSuggestions: readonly string[];
  readonly featuredImageConcept?: string;
  readonly readingMetrics: BlogReadingMetrics;
  readonly wordCount: number;
  readonly editorialWarnings: readonly BlogWarning[];
  readonly complianceNotes: readonly string[];
  readonly validationSummary: BlogValidationSummary;
  readonly contents: readonly Content[];
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
  readonly generatedAt: Date;
}
