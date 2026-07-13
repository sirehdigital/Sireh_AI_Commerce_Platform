import type {
  SocialCaptionLength,
  SocialContentAngle,
  SocialHookStyle,
  SocialMediaContentGenerationOptions,
  SocialMediaContentGenerationOptionsInput,
  SocialObjective,
  SocialPlatform,
} from "../dto/social-media-content.types.js";
import {
  InvalidSocialContentAngleError,
  InvalidSocialObjectiveError,
  UnsupportedSocialLanguageError,
  UnsupportedSocialPlatformError,
} from "../errors/product-content.errors.js";

const SUPPORTED_PLATFORMS: readonly SocialPlatform[] = [
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "x",
  "youtube",
  "generic",
];
const SUPPORTED_OBJECTIVES: readonly SocialObjective[] = [
  "awareness",
  "engagement",
  "traffic",
  "conversion",
  "education",
  "product-launch",
  "retargeting",
  "community-building",
  "lead-generation",
  "brand-positioning",
];
const SUPPORTED_ANGLES: readonly SocialContentAngle[] = [
  "product-benefit",
  "problem-solution",
  "educational",
  "lifestyle",
  "demonstration",
  "before-after-concept",
  "social-proof-framework",
  "objection-handling",
  "feature-spotlight",
  "brand-story",
  "comparison",
  "faq",
  "seasonal",
  "launch",
  "limited-offer",
];
const SUPPORTED_HOOKS: readonly SocialHookStyle[] = [
  "question",
  "problem",
  "benefit",
  "curiosity",
  "educational",
  "direct",
  "lifestyle",
  "contrarian",
];
const SUPPORTED_LENGTHS: readonly SocialCaptionLength[] = ["short", "medium", "long"];

export class SocialMediaContentOptionsFactory {
  public create(input: SocialMediaContentGenerationOptionsInput = {}): SocialMediaContentGenerationOptions {
    const platform = input.platform ?? "instagram";
    const language = input.language ?? "en";
    const objective = input.objective ?? "engagement";
    const contentAngle = input.contentAngle ?? "product-benefit";
    const hookStyle = input.hookStyle ?? defaultHookStyle(objective);
    const captionLength = input.captionLength ?? defaultCaptionLength(platform);

    if (!SUPPORTED_PLATFORMS.includes(platform)) {
      throw new UnsupportedSocialPlatformError(platform);
    }

    if (language !== "en" && language !== "ms") {
      throw new UnsupportedSocialLanguageError(language);
    }

    if (!SUPPORTED_OBJECTIVES.includes(objective)) {
      throw new InvalidSocialObjectiveError(objective);
    }

    if (!SUPPORTED_ANGLES.includes(contentAngle)) {
      throw new InvalidSocialContentAngleError(contentAngle);
    }

    return {
      platform,
      language,
      tone: input.tone ?? (platform === "linkedin" ? "professional" : "friendly"),
      objective,
      captionLength: SUPPORTED_LENGTHS.includes(captionLength) ? captionLength : "medium",
      hashtagCount: clamp(input.hashtagCount ?? defaultHashtagCount(platform), 0, maxHashtags(platform)),
      ctaCount: clamp(input.ctaCount ?? 1, 1, 3),
      hookStyle: SUPPORTED_HOOKS.includes(hookStyle) ? hookStyle : "benefit",
      contentAngle,
      includeEmojis: input.includeEmojis ?? (platform === "instagram" || platform === "tiktok"),
      includeEngagementQuestion: input.includeEngagementQuestion ?? true,
      includeSavePrompt: input.includeSavePrompt ?? platform === "instagram",
      includeSharePrompt: input.includeSharePrompt ?? (platform === "facebook" || platform === "instagram"),
      includeCarouselContent: input.includeCarouselContent ?? platform === "instagram",
      carouselSlideLimit: clamp(input.carouselSlideLimit ?? 6, 3, 7),
      includeStoryContent: input.includeStoryContent ?? platform === "instagram",
      storyFrameLimit: clamp(input.storyFrameLimit ?? 5, 3, 6),
      includeVisualDirection: input.includeVisualDirection ?? true,
      strictClaimSafety: input.strictClaimSafety ?? true,
      strictPlatformCompliance: input.strictPlatformCompliance ?? true,
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
    };
  }
}

export function maxHashtags(platform: SocialPlatform): number {
  const limits: Record<SocialPlatform, number> = {
    facebook: 5,
    instagram: 12,
    tiktok: 6,
    linkedin: 3,
    x: 2,
    youtube: 5,
    generic: 5,
  };
  return limits[platform];
}

export function captionLimit(platform: SocialPlatform, length: SocialCaptionLength): number {
  const limits: Record<SocialPlatform, Record<SocialCaptionLength, number>> = {
    facebook: { short: 180, medium: 420, long: 900 },
    instagram: { short: 150, medium: 360, long: 700 },
    tiktok: { short: 110, medium: 220, long: 300 },
    linkedin: { short: 180, medium: 520, long: 900 },
    x: { short: 180, medium: 260, long: 280 },
    youtube: { short: 180, medium: 420, long: 700 },
    generic: { short: 180, medium: 420, long: 700 },
  };
  return limits[platform][length];
}

function defaultCaptionLength(platform: SocialPlatform): SocialCaptionLength {
  return platform === "x" || platform === "tiktok" ? "short" : platform === "facebook" || platform === "linkedin" ? "long" : "medium";
}

function defaultHashtagCount(platform: SocialPlatform): number {
  return platform === "instagram" ? 8 : platform === "tiktok" ? 5 : platform === "linkedin" || platform === "x" ? 2 : 3;
}

function defaultHookStyle(objective: SocialObjective): SocialHookStyle {
  if (objective === "education") {
    return "educational";
  }
  if (objective === "traffic" || objective === "conversion") {
    return "benefit";
  }
  return "question";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
