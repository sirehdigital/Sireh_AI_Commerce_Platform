import type { CTA } from "../value-objects/cta.value-object.js";
import type { ContentLength } from "../value-objects/content-length.value-object.js";
import type { Headline } from "../value-objects/headline.value-object.js";
import type { MetaDescription } from "../value-objects/meta-description.value-object.js";
import type { MetaTitle } from "../value-objects/meta-title.value-object.js";
import type { QualityScore } from "../value-objects/quality-score.value-object.js";
import type { ReadingTime } from "../value-objects/reading-time.value-object.js";
import type { SEOKeyword } from "../value-objects/seo-keyword.value-object.js";
import type { Slug } from "../value-objects/slug.value-object.js";

export type ContentId = string;
export type ContentTemplateId = string;

export type ContentType =
  | "product-title"
  | "product-description"
  | "product-benefits"
  | "product-features"
  | "landing-page-copy"
  | "seo-title"
  | "seo-description"
  | "social-post"
  | "social-caption"
  | "video-script"
  | "email-subject"
  | "email-body"
  | "blog-article"
  | "cta"
  | "generic-content";

export type ContentStatus =
  | "draft"
  | "generated"
  | "reviewed"
  | "approved"
  | "published"
  | "rejected"
  | "archived";

export type ContentChannel =
  | "shopify"
  | "website"
  | "blog"
  | "email"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "linkedin"
  | "x"
  | "generic";

export type ContentLanguage = "en" | "ms" | (string & {});

export type ContentTone =
  | "professional"
  | "friendly"
  | "conversational"
  | "persuasive"
  | "educational"
  | "inspirational"
  | "luxury"
  | "urgent"
  | "playful"
  | "authoritative"
  | "neutral";

export type AwarenessLevel = "unaware" | "problem-aware" | "solution-aware" | "product-aware" | "most-aware";

export type PurchaseIntent = "low" | "medium" | "high";

export type ContentSearchIntent = "informational" | "commercial" | "transactional" | "navigational";

export interface ContentAudience {
  readonly targetMarket?: string;
  readonly segmentReference?: string;
  readonly personaReference?: string;
  readonly awarenessLevel?: AwarenessLevel;
  readonly purchaseIntent?: PurchaseIntent;
  readonly description?: string;
  readonly notes?: readonly string[];
}

export interface ContentSEO {
  readonly primaryKeyword?: SEOKeyword;
  readonly secondaryKeywords: readonly SEOKeyword[];
  readonly metaTitle?: MetaTitle;
  readonly metaDescription?: MetaDescription;
  readonly slug?: Slug;
  readonly searchIntent?: ContentSearchIntent;
  readonly canonicalReference?: string;
  readonly indexable: boolean;
}

export interface ContentScore {
  readonly overallQuality: QualityScore;
  readonly clarity?: QualityScore;
  readonly relevance?: QualityScore;
  readonly persuasiveness?: QualityScore;
  readonly readability?: QualityScore;
  readonly seoQuality?: QualityScore;
  readonly brandAlignment?: QualityScore;
  readonly channelSuitability?: QualityScore;
  readonly complianceRisk?: QualityScore;
  readonly evaluationNotes: readonly string[];
}

export interface ContentMetadata {
  readonly sourceProductId?: string;
  readonly sourceMarketingAnalysisId?: string;
  readonly campaignId?: string;
  readonly brandId?: string;
  readonly templateId?: ContentTemplateId;
  readonly correlationId?: string;
  readonly tags: readonly string[];
  readonly contentVersion: number;
  readonly createdBy?: string;
  readonly reviewedBy?: string;
  readonly publicationReference?: string;
  readonly custom: Readonly<Record<string, unknown>>;
}

export interface ContentSectionDefinition {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
  readonly maxLength?: number;
}

export interface ContentTemplateSnapshot {
  readonly id: ContentTemplateId;
  readonly name: string;
  readonly contentType: ContentType;
  readonly channel: ContentChannel;
  readonly sections: readonly ContentSectionDefinition[];
  readonly requiredVariables: readonly string[];
  readonly optionalVariables: readonly string[];
  readonly version: number;
  readonly active: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface ContentSnapshot {
  readonly id: ContentId;
  readonly type: ContentType;
  readonly status: ContentStatus;
  readonly channel: ContentChannel;
  readonly language: ContentLanguage;
  readonly tone: ContentTone;
  readonly audience?: ContentAudience;
  readonly headline: Headline;
  readonly body: string;
  readonly structuredContent: Readonly<Record<string, string>>;
  readonly cta?: CTA;
  readonly seo?: ContentSEO;
  readonly score?: ContentScore;
  readonly templateId?: ContentTemplateId;
  readonly metadata: ContentMetadata;
  readonly readingTime?: ReadingTime;
  readonly contentLength: ContentLength;
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ContentRepositoryFilter {
  readonly type?: ContentType;
  readonly channel?: ContentChannel;
  readonly status?: ContentStatus;
  readonly sourceProductId?: string;
  readonly campaignId?: string;
}

export interface ContentPageRequest {
  readonly limit: number;
  readonly cursor?: string;
}

export interface ContentPage<T> {
  readonly items: readonly T[];
  readonly nextCursor?: string;
}
