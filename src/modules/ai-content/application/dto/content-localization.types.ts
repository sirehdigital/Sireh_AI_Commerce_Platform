import type {
  Content,
  ContentAudience,
  ContentChannel,
  ContentLanguage,
  ContentSEO,
  ContentTone,
  ContentType,
  CTA,
} from "../../domain/index.js";
import type { BlogContentPackage } from "./blog-content.types.js";
import type { EmailContentPackage } from "./email-content.types.js";
import type { ProductContentPackage } from "./product-content.types.js";
import type { SEOContentPackage } from "./seo-content.types.js";
import type { SocialMediaContentPackage } from "./social-media-content.types.js";
import type { VideoScriptPackage } from "./video-script.types.js";

export type SupportedLocale = "en" | "en-US" | "en-GB" | "en-AU" | "en-CA" | "ms" | "ms-MY";
export type LocalizationMode = "translate" | "adapt" | "translate-and-adapt" | "validate-only";
export type LocalizationReadiness =
  | "not-localizable"
  | "review-required"
  | "localized-with-warnings"
  | "ready-for-review"
  | "ready-for-approval";
export type ReviewRequiredSeverity = "low" | "medium" | "high" | "critical";

export interface LocaleProfile {
  readonly locale: SupportedLocale;
  readonly language: ContentLanguage;
  readonly region: string;
  readonly spellingVariants: Readonly<Record<string, string>>;
  readonly commerceTerms: Readonly<Record<string, string>>;
  readonly ctaPhrases: Readonly<Record<string, string>>;
  readonly seoFillerWords: readonly string[];
  readonly formalityGuidance: string;
  readonly dateFormatGuidance: string;
  readonly numberFormatGuidance: string;
  readonly currencyFormatGuidance: string;
}

export interface ContentLocalizationInput {
  readonly sourceContentId: string;
  readonly sourceContent?: Content;
  readonly sourceLanguage: ContentLanguage;
  readonly sourceLocale?: SupportedLocale;
  readonly targetLanguage: ContentLanguage;
  readonly targetLocale: SupportedLocale;
  readonly contentType: ContentType;
  readonly channel: ContentChannel;
  readonly tone: ContentTone;
  readonly audience?: ContentAudience;
  readonly headline: string;
  readonly body: string;
  readonly structuredContent: Readonly<Record<string, string>>;
  readonly cta?: CTA;
  readonly seo?: ContentSEO;
  readonly productContentPackage?: ProductContentPackage;
  readonly seoContentPackage?: SEOContentPackage;
  readonly socialMediaContentPackage?: SocialMediaContentPackage;
  readonly videoScriptPackage?: VideoScriptPackage;
  readonly emailContentPackage?: EmailContentPackage;
  readonly blogContentPackage?: BlogContentPackage;
  readonly productFacts: readonly string[];
  readonly brandTerminology: readonly string[];
  readonly protectedTerms: readonly string[];
  readonly productNames: readonly string[];
  readonly brandNames: readonly string[];
  readonly personalizationTokens: readonly string[];
  readonly verifiedClaims: readonly string[];
  readonly regulatoryNotes: readonly string[];
  readonly campaignMetadata: Readonly<Record<string, unknown>>;
  readonly correlationMetadata: Readonly<Record<string, unknown>>;
}

export interface ContentLocalizationOptionsInput {
  readonly sourceLocale?: SupportedLocale;
  readonly targetLocale?: SupportedLocale;
  readonly localizationMode?: LocalizationMode;
  readonly preserveBrandNames?: boolean;
  readonly preserveProductNames?: boolean;
  readonly preserveProtectedTerminology?: boolean;
  readonly preserveUrls?: boolean;
  readonly preservePlaceholders?: boolean;
  readonly preservePersonalizationTokens?: boolean;
  readonly preserveSkuOrProductIdentifiers?: boolean;
  readonly preserveCampaignReferences?: boolean;
  readonly adaptSpelling?: boolean;
  readonly adaptDateFormatGuidance?: boolean;
  readonly adaptNumberFormatGuidance?: boolean;
  readonly adaptCurrencyReferences?: boolean;
  readonly adaptCTA?: boolean;
  readonly adaptSEOKeywords?: boolean;
  readonly adaptSlug?: boolean;
  readonly adaptTone?: boolean;
  readonly adaptChannelConventions?: boolean;
  readonly includeLocalizationNotes?: boolean;
  readonly includeReviewRequiredFlags?: boolean;
  readonly strictClaimPreservationMode?: boolean;
  readonly strictPlaceholderPreservationMode?: boolean;
  readonly strictSEOPreservationMode?: boolean;
  readonly strictStructuralPreservationMode?: boolean;
}

export interface ContentLocalizationOptions {
  readonly sourceLocale: SupportedLocale;
  readonly targetLocale: SupportedLocale;
  readonly localizationMode: LocalizationMode;
  readonly preserveBrandNames: boolean;
  readonly preserveProductNames: boolean;
  readonly preserveProtectedTerminology: boolean;
  readonly preserveUrls: boolean;
  readonly preservePlaceholders: boolean;
  readonly preservePersonalizationTokens: boolean;
  readonly preserveSkuOrProductIdentifiers: boolean;
  readonly preserveCampaignReferences: boolean;
  readonly adaptSpelling: boolean;
  readonly adaptDateFormatGuidance: boolean;
  readonly adaptNumberFormatGuidance: boolean;
  readonly adaptCurrencyReferences: boolean;
  readonly adaptCTA: boolean;
  readonly adaptSEOKeywords: boolean;
  readonly adaptSlug: boolean;
  readonly adaptTone: boolean;
  readonly adaptChannelConventions: boolean;
  readonly includeLocalizationNotes: boolean;
  readonly includeReviewRequiredFlags: boolean;
  readonly strictClaimPreservationMode: boolean;
  readonly strictPlaceholderPreservationMode: boolean;
  readonly strictSEOPreservationMode: boolean;
  readonly strictStructuralPreservationMode: boolean;
}

export interface LocalizationReviewRequiredItem {
  readonly section: string;
  readonly reason: string;
  readonly severity: ReviewRequiredSeverity;
  readonly suggestedReviewerType: string;
  readonly blocking: boolean;
  readonly sourceTextReference: string;
  readonly targetTextReference?: string;
}

export interface LocalizationValidationResult {
  readonly passed: boolean;
  readonly languageConsistent: boolean;
  readonly localeConsistent: boolean;
  readonly placeholdersPreserved: boolean;
  readonly protectedTermsPreserved: boolean;
  readonly claimsPreserved: boolean;
  readonly structurePreserved: boolean;
  readonly seoPreserved: boolean;
  readonly ctaIntentPreserved: boolean;
  readonly tonePreserved: boolean;
  readonly channelCompatible: boolean;
  readonly warnings: readonly string[];
  readonly reviewRequiredItems: readonly LocalizationReviewRequiredItem[];
}

export interface LocalizedContentPackage {
  readonly sourceLanguage: ContentLanguage;
  readonly sourceLocale: SupportedLocale;
  readonly targetLanguage: ContentLanguage;
  readonly targetLocale: SupportedLocale;
  readonly localizationMode: LocalizationMode;
  readonly localizedHeadline: string;
  readonly localizedBody: string;
  readonly localizedStructuredContent: Readonly<Record<string, string>>;
  readonly localizedCTA?: CTA;
  readonly localizedSEO?: ContentSEO;
  readonly localizedSlug?: string;
  readonly localizedHeadings: readonly string[];
  readonly localizedCaptions: readonly string[];
  readonly localizedSubjectLines: readonly string[];
  readonly localizedPreheaders: readonly string[];
  readonly localizedScriptScenes: readonly string[];
  readonly localizedEmailSections: readonly string[];
  readonly localizedBlogSections: readonly string[];
  readonly preservedTerms: readonly string[];
  readonly preservedPlaceholders: readonly string[];
  readonly changedTerms: readonly string[];
  readonly regionalAdaptations: readonly string[];
  readonly warnings: readonly string[];
  readonly reviewRequiredItems: readonly LocalizationReviewRequiredItem[];
  readonly claimPreservationResult: LocalizationValidationResult;
  readonly structuralPreservationResult: LocalizationValidationResult;
  readonly seoPreservationResult: LocalizationValidationResult;
  readonly validationResult: LocalizationValidationResult;
  readonly readiness: LocalizationReadiness;
  readonly contents: readonly Content[];
  readonly sourceMetadata: Readonly<Record<string, unknown>>;
  readonly correlationMetadata: Readonly<Record<string, unknown>>;
  readonly localizationVersion: "SACP Content Localization Rule Engine v1";
  readonly localizedAt: Date;
}
