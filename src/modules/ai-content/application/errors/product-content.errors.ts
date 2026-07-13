import { AppError } from "../../../../shared/errors/app-error.js";

export class InvalidProductContentInputError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "PRODUCT_CONTENT_INVALID_INPUT",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidProductContentInputError";
  }
}

export class ProductContentGenerationError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "PRODUCT_CONTENT_GENERATION_FAILED",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "ProductContentGenerationError";
  }
}

export class UnsafeContentClaimError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "PRODUCT_CONTENT_UNSAFE_CLAIM",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "UnsafeContentClaimError";
  }
}

export class UnsupportedContentLanguageError extends AppError {
  public constructor(language: string) {
    super({
      message: `Unsupported product content language: ${language}.`,
      statusCode: 400,
      code: "PRODUCT_CONTENT_UNSUPPORTED_LANGUAGE",
      details: { language },
    });

    this.name = "UnsupportedContentLanguageError";
  }
}

export class UnsupportedProductContentChannelError extends AppError {
  public constructor(channel: string) {
    super({
      message: `Unsupported product content channel: ${channel}.`,
      statusCode: 400,
      code: "PRODUCT_CONTENT_UNSUPPORTED_CHANNEL",
      details: { channel },
    });

    this.name = "UnsupportedProductContentChannelError";
  }
}

export class MissingProductContentSourceError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "PRODUCT_CONTENT_MISSING_SOURCE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "MissingProductContentSourceError";
  }
}

export class InvalidSEOContentInputError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "SEO_CONTENT_INVALID_INPUT",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidSEOContentInputError";
  }
}

export class SEOContentGenerationError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "SEO_CONTENT_GENERATION_FAILED",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "SEOContentGenerationError";
  }
}

export class UnsupportedSearchIntentError extends AppError {
  public constructor(searchIntent: string) {
    super({
      message: `Unsupported search intent: ${searchIntent}.`,
      statusCode: 400,
      code: "SEO_CONTENT_UNSUPPORTED_SEARCH_INTENT",
      details: { searchIntent },
    });

    this.name = "UnsupportedSearchIntentError";
  }
}

export class UnsafeSEOKeywordError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "SEO_CONTENT_UNSAFE_KEYWORD",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "UnsafeSEOKeywordError";
  }
}

export class InvalidSEOMetadataError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "SEO_CONTENT_INVALID_METADATA",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidSEOMetadataError";
  }
}

export class UnsupportedSEOChannelError extends AppError {
  public constructor(channel: string) {
    super({
      message: `Unsupported SEO channel: ${channel}.`,
      statusCode: 400,
      code: "SEO_CONTENT_UNSUPPORTED_CHANNEL",
      details: { channel },
    });

    this.name = "UnsupportedSEOChannelError";
  }
}

export class UnsupportedSEOLanguageError extends AppError {
  public constructor(language: string) {
    super({
      message: `Unsupported SEO language: ${language}.`,
      statusCode: 400,
      code: "SEO_CONTENT_UNSUPPORTED_LANGUAGE",
      details: { language },
    });

    this.name = "UnsupportedSEOLanguageError";
  }
}

export class MissingSEOSourceError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "SEO_CONTENT_MISSING_SOURCE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "MissingSEOSourceError";
  }
}

export class InvalidSocialMediaContentInputError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "SOCIAL_CONTENT_INVALID_INPUT",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidSocialMediaContentInputError";
  }
}

export class SocialMediaContentGenerationError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "SOCIAL_CONTENT_GENERATION_FAILED",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "SocialMediaContentGenerationError";
  }
}

export class UnsupportedSocialPlatformError extends AppError {
  public constructor(platform: string) {
    super({
      message: `Unsupported social platform: ${platform}.`,
      statusCode: 400,
      code: "SOCIAL_CONTENT_UNSUPPORTED_PLATFORM",
      details: { platform },
    });

    this.name = "UnsupportedSocialPlatformError";
  }
}

export class UnsupportedSocialLanguageError extends AppError {
  public constructor(language: string) {
    super({
      message: `Unsupported social language: ${language}.`,
      statusCode: 400,
      code: "SOCIAL_CONTENT_UNSUPPORTED_LANGUAGE",
      details: { language },
    });

    this.name = "UnsupportedSocialLanguageError";
  }
}

export class UnsafeSocialContentError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "SOCIAL_CONTENT_UNSAFE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "UnsafeSocialContentError";
  }
}

export class UnsafeHashtagError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "SOCIAL_CONTENT_UNSAFE_HASHTAG",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "UnsafeHashtagError";
  }
}

export class SocialPlatformCompatibilityError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "SOCIAL_CONTENT_PLATFORM_COMPATIBILITY",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "SocialPlatformCompatibilityError";
  }
}

export class MissingSocialContentSourceError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "SOCIAL_CONTENT_MISSING_SOURCE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "MissingSocialContentSourceError";
  }
}

export class InvalidSocialObjectiveError extends AppError {
  public constructor(objective: string) {
    super({
      message: `Invalid social objective: ${objective}.`,
      statusCode: 400,
      code: "SOCIAL_CONTENT_INVALID_OBJECTIVE",
      details: { objective },
    });

    this.name = "InvalidSocialObjectiveError";
  }
}

export class InvalidSocialContentAngleError extends AppError {
  public constructor(contentAngle: string) {
    super({
      message: `Invalid social content angle: ${contentAngle}.`,
      statusCode: 400,
      code: "SOCIAL_CONTENT_INVALID_ANGLE",
      details: { contentAngle },
    });

    this.name = "InvalidSocialContentAngleError";
  }
}

export class InvalidVideoScriptInputError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "VIDEO_SCRIPT_INVALID_INPUT",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidVideoScriptInputError";
  }
}

export class VideoScriptGenerationError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "VIDEO_SCRIPT_GENERATION_FAILED",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "VideoScriptGenerationError";
  }
}

export class UnsupportedVideoPlatformError extends AppError {
  public constructor(platform: string) {
    super({
      message: `Unsupported video platform: ${platform}.`,
      statusCode: 400,
      code: "VIDEO_SCRIPT_UNSUPPORTED_PLATFORM",
      details: { platform },
    });

    this.name = "UnsupportedVideoPlatformError";
  }
}

export class UnsupportedVideoFormatError extends AppError {
  public constructor(format: string) {
    super({
      message: `Unsupported video format: ${format}.`,
      statusCode: 400,
      code: "VIDEO_SCRIPT_UNSUPPORTED_FORMAT",
      details: { format },
    });

    this.name = "UnsupportedVideoFormatError";
  }
}

export class UnsupportedVideoDurationError extends AppError {
  public constructor(duration: number, details?: Record<string, unknown>) {
    super({
      message: `Unsupported video duration: ${duration} seconds.`,
      statusCode: 400,
      code: "VIDEO_SCRIPT_UNSUPPORTED_DURATION",
      details: { duration, ...(details ?? {}) },
    });

    this.name = "UnsupportedVideoDurationError";
  }
}

export class UnsupportedVideoLanguageError extends AppError {
  public constructor(language: string) {
    super({
      message: `Unsupported video language: ${language}.`,
      statusCode: 400,
      code: "VIDEO_SCRIPT_UNSUPPORTED_LANGUAGE",
      details: { language },
    });

    this.name = "UnsupportedVideoLanguageError";
  }
}

export class InvalidSceneTimingError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "VIDEO_SCRIPT_INVALID_TIMING",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidSceneTimingError";
  }
}

export class UnsafeVideoContentError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "VIDEO_SCRIPT_UNSAFE_CONTENT",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "UnsafeVideoContentError";
  }
}

export class VideoPlatformCompatibilityError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "VIDEO_SCRIPT_PLATFORM_COMPATIBILITY",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "VideoPlatformCompatibilityError";
  }
}

export class MissingVideoContentSourceError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "VIDEO_SCRIPT_MISSING_SOURCE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "MissingVideoContentSourceError";
  }
}

export class InvalidEmailContentInputError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "EMAIL_CONTENT_INVALID_INPUT",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidEmailContentInputError";
  }
}

export class EmailContentGenerationError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "EMAIL_CONTENT_GENERATION_FAILED",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "EmailContentGenerationError";
  }
}

export class UnsupportedEmailCampaignTypeError extends AppError {
  public constructor(campaignType: string) {
    super({
      message: `Unsupported email campaign type: ${campaignType}.`,
      statusCode: 400,
      code: "EMAIL_CONTENT_UNSUPPORTED_CAMPAIGN_TYPE",
      details: { campaignType },
    });

    this.name = "UnsupportedEmailCampaignTypeError";
  }
}

export class UnsupportedEmailObjectiveError extends AppError {
  public constructor(objective: string) {
    super({
      message: `Unsupported email objective: ${objective}.`,
      statusCode: 400,
      code: "EMAIL_CONTENT_UNSUPPORTED_OBJECTIVE",
      details: { objective },
    });

    this.name = "UnsupportedEmailObjectiveError";
  }
}

export class UnsupportedEmailLanguageError extends AppError {
  public constructor(language: string) {
    super({
      message: `Unsupported email language: ${language}.`,
      statusCode: 400,
      code: "EMAIL_CONTENT_UNSUPPORTED_LANGUAGE",
      details: { language },
    });

    this.name = "UnsupportedEmailLanguageError";
  }
}

export class InvalidEmailSubjectError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "EMAIL_CONTENT_INVALID_SUBJECT",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidEmailSubjectError";
  }
}

export class InvalidEmailPreheaderError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "EMAIL_CONTENT_INVALID_PREHEADER",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidEmailPreheaderError";
  }
}

export class InvalidPersonalizationTokenError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "EMAIL_CONTENT_INVALID_PERSONALIZATION",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidPersonalizationTokenError";
  }
}

export class MissingEmailCampaignContextError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "EMAIL_CONTENT_MISSING_CONTEXT",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "MissingEmailCampaignContextError";
  }
}

export class InvalidEmailOfferContextError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "EMAIL_CONTENT_INVALID_OFFER",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidEmailOfferContextError";
  }
}

export class UnsafeEmailContentError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "EMAIL_CONTENT_UNSAFE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "UnsafeEmailContentError";
  }
}

export class EmailComplianceError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "EMAIL_CONTENT_COMPLIANCE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "EmailComplianceError";
  }
}

export class EmailSequenceValidationError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "EMAIL_CONTENT_SEQUENCE_INVALID",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "EmailSequenceValidationError";
  }
}

export class InvalidBlogContentInputError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "BLOG_CONTENT_INVALID_INPUT",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidBlogContentInputError";
  }
}

export class BlogContentGenerationError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "BLOG_CONTENT_GENERATION_FAILED",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "BlogContentGenerationError";
  }
}

export class UnsupportedBlogArticleTypeError extends AppError {
  public constructor(articleType: string) {
    super({
      message: `Unsupported blog article type: ${articleType}.`,
      statusCode: 400,
      code: "BLOG_CONTENT_UNSUPPORTED_ARTICLE_TYPE",
      details: { articleType },
    });

    this.name = "UnsupportedBlogArticleTypeError";
  }
}

export class UnsupportedBlogObjectiveError extends AppError {
  public constructor(objective: string) {
    super({
      message: `Unsupported blog objective: ${objective}.`,
      statusCode: 400,
      code: "BLOG_CONTENT_UNSUPPORTED_OBJECTIVE",
      details: { objective },
    });

    this.name = "UnsupportedBlogObjectiveError";
  }
}

export class UnsupportedBlogLanguageError extends AppError {
  public constructor(language: string) {
    super({
      message: `Unsupported blog language: ${language}.`,
      statusCode: 400,
      code: "BLOG_CONTENT_UNSUPPORTED_LANGUAGE",
      details: { language },
    });

    this.name = "UnsupportedBlogLanguageError";
  }
}

export class UnsupportedBlogChannelError extends AppError {
  public constructor(channel: string) {
    super({
      message: `Unsupported blog channel: ${channel}.`,
      statusCode: 400,
      code: "BLOG_CONTENT_UNSUPPORTED_CHANNEL",
      details: { channel },
    });

    this.name = "UnsupportedBlogChannelError";
  }
}

export class InvalidBlogLengthError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "BLOG_CONTENT_INVALID_LENGTH",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidBlogLengthError";
  }
}

export class InvalidBlogStructureError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "BLOG_CONTENT_INVALID_STRUCTURE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidBlogStructureError";
  }
}

export class InvalidBlogSEOError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "BLOG_CONTENT_INVALID_SEO",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidBlogSEOError";
  }
}

export class UnsafeBlogContentError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "BLOG_CONTENT_UNSAFE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "UnsafeBlogContentError";
  }
}

export class MissingBlogEvidenceError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "BLOG_CONTENT_MISSING_EVIDENCE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "MissingBlogEvidenceError";
  }
}

export class BlogReadabilityError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "BLOG_CONTENT_READABILITY",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "BlogReadabilityError";
  }
}

export class MissingBlogSourceError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "BLOG_CONTENT_MISSING_SOURCE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "MissingBlogSourceError";
  }
}

export class InvalidContentQualityInputError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "CONTENT_QUALITY_INVALID_INPUT",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidContentQualityInputError";
  }
}

export class UnsupportedContentScoringProfileError extends AppError {
  public constructor(profile: string) {
    super({
      message: `Unsupported content scoring profile: ${profile}.`,
      statusCode: 400,
      code: "CONTENT_QUALITY_UNSUPPORTED_PROFILE",
      details: { profile },
    });

    this.name = "UnsupportedContentScoringProfileError";
  }
}

export class InvalidContentScoringWeightsError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "CONTENT_QUALITY_INVALID_WEIGHTS",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidContentScoringWeightsError";
  }
}

export class UnsupportedScoringContentTypeError extends AppError {
  public constructor(contentType: string) {
    super({
      message: `Unsupported scoring content type: ${contentType}.`,
      statusCode: 400,
      code: "CONTENT_QUALITY_UNSUPPORTED_CONTENT_TYPE",
      details: { contentType },
    });

    this.name = "UnsupportedScoringContentTypeError";
  }
}

export class UnsupportedScoringChannelError extends AppError {
  public constructor(channel: string) {
    super({
      message: `Unsupported scoring channel: ${channel}.`,
      statusCode: 400,
      code: "CONTENT_QUALITY_UNSUPPORTED_CHANNEL",
      details: { channel },
    });

    this.name = "UnsupportedScoringChannelError";
  }
}

export class ContentQualityScoringError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "CONTENT_QUALITY_SCORING_FAILED",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "ContentQualityScoringError";
  }
}

export class InvalidDimensionScoreError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "CONTENT_QUALITY_INVALID_DIMENSION_SCORE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "InvalidDimensionScoreError";
  }
}

export class ContentCriticalIssueError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "CONTENT_QUALITY_CRITICAL_ISSUE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "ContentCriticalIssueError";
  }
}

export class ContentApprovalReadinessError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 422,
      code: "CONTENT_QUALITY_APPROVAL_READINESS",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "ContentApprovalReadinessError";
  }
}

export class MissingContentScoringSourceError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      statusCode: 400,
      code: "CONTENT_QUALITY_MISSING_SOURCE",
      ...(details === undefined ? {} : { details }),
    });

    this.name = "MissingContentScoringSourceError";
  }
}

export class InvalidContentLocalizationInputError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 400, code: "CONTENT_LOCALIZATION_INVALID_INPUT", ...(details === undefined ? {} : { details }) });
    this.name = "InvalidContentLocalizationInputError";
  }
}

export class UnsupportedSourceLocaleError extends AppError {
  public constructor(locale: string) {
    super({ message: `Unsupported source locale: ${locale}.`, statusCode: 400, code: "CONTENT_LOCALIZATION_UNSUPPORTED_SOURCE_LOCALE", details: { locale } });
    this.name = "UnsupportedSourceLocaleError";
  }
}

export class UnsupportedTargetLocaleError extends AppError {
  public constructor(locale: string) {
    super({ message: `Unsupported target locale: ${locale}.`, statusCode: 400, code: "CONTENT_LOCALIZATION_UNSUPPORTED_TARGET_LOCALE", details: { locale } });
    this.name = "UnsupportedTargetLocaleError";
  }
}

export class UnsupportedLocalePairError extends AppError {
  public constructor(sourceLocale: string, targetLocale: string) {
    super({
      message: `Unsupported localization pair: ${sourceLocale} to ${targetLocale}.`,
      statusCode: 400,
      code: "CONTENT_LOCALIZATION_UNSUPPORTED_LOCALE_PAIR",
      details: { sourceLocale, targetLocale },
    });
    this.name = "UnsupportedLocalePairError";
  }
}

export class ContentLocalizationError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 422, code: "CONTENT_LOCALIZATION_FAILED", ...(details === undefined ? {} : { details }) });
    this.name = "ContentLocalizationError";
  }
}

export class LocalizationPlaceholderMismatchError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 422, code: "CONTENT_LOCALIZATION_PLACEHOLDER_MISMATCH", ...(details === undefined ? {} : { details }) });
    this.name = "LocalizationPlaceholderMismatchError";
  }
}

export class LocalizationProtectedTermMismatchError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 422, code: "CONTENT_LOCALIZATION_PROTECTED_TERM_MISMATCH", ...(details === undefined ? {} : { details }) });
    this.name = "LocalizationProtectedTermMismatchError";
  }
}

export class LocalizationClaimPreservationError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 422, code: "CONTENT_LOCALIZATION_CLAIM_PRESERVATION", ...(details === undefined ? {} : { details }) });
    this.name = "LocalizationClaimPreservationError";
  }
}

export class LocalizationStructureMismatchError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 422, code: "CONTENT_LOCALIZATION_STRUCTURE_MISMATCH", ...(details === undefined ? {} : { details }) });
    this.name = "LocalizationStructureMismatchError";
  }
}

export class LocalizationSEOError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 422, code: "CONTENT_LOCALIZATION_SEO", ...(details === undefined ? {} : { details }) });
    this.name = "LocalizationSEOError";
  }
}

export class LocalizationTimingError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 422, code: "CONTENT_LOCALIZATION_TIMING", ...(details === undefined ? {} : { details }) });
    this.name = "LocalizationTimingError";
  }
}

export class LocalizationReviewRequiredError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 422, code: "CONTENT_LOCALIZATION_REVIEW_REQUIRED", ...(details === undefined ? {} : { details }) });
    this.name = "LocalizationReviewRequiredError";
  }
}

export class MissingLocalizationSourceError extends AppError {
  public constructor(message: string, details?: Record<string, unknown>) {
    super({ message, statusCode: 400, code: "CONTENT_LOCALIZATION_MISSING_SOURCE", ...(details === undefined ? {} : { details }) });
    this.name = "MissingLocalizationSourceError";
  }
}
