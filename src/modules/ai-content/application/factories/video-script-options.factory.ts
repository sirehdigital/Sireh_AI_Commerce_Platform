import type {
  VideoDurationSeconds,
  VideoFormat,
  VideoHookStyle,
  VideoObjective,
  VideoPlatform,
  VideoPresenterStyle,
  VideoScriptGenerationOptions,
  VideoScriptGenerationOptionsInput,
} from "../dto/video-script.types.js";
import {
  UnsupportedVideoDurationError,
  UnsupportedVideoFormatError,
  UnsupportedVideoLanguageError,
  UnsupportedVideoPlatformError,
} from "../errors/product-content.errors.js";

const PLATFORMS: readonly VideoPlatform[] = [
  "tiktok",
  "instagram-reels",
  "facebook-reels",
  "youtube-shorts",
  "youtube",
  "generic-video",
];
const FORMATS: readonly VideoFormat[] = [
  "short-form",
  "standard-product-video",
  "product-demonstration",
  "problem-solution",
  "educational",
  "feature-spotlight",
  "faq",
  "objection-handling",
  "launch",
  "brand-story",
  "testimonial-framework",
  "unboxing-framework",
  "comparison",
  "lifestyle",
  "tutorial",
];
const DURATIONS: readonly VideoDurationSeconds[] = [15, 30, 45, 60, 90, 120, 180, 300];
const SHORT_PLATFORMS: readonly VideoPlatform[] = ["tiktok", "instagram-reels", "facebook-reels", "youtube-shorts"];

export class VideoScriptOptionsFactory {
  public create(input: VideoScriptGenerationOptionsInput = {}): VideoScriptGenerationOptions {
    const platform = input.platform ?? "tiktok";
    const format = input.format ?? (platform === "youtube" ? "standard-product-video" : "short-form");
    const language = input.language ?? "en";
    const duration = input.targetDurationSeconds ?? defaultDuration(platform);

    if (!PLATFORMS.includes(platform)) {
      throw new UnsupportedVideoPlatformError(platform);
    }

    if (!FORMATS.includes(format)) {
      throw new UnsupportedVideoFormatError(format);
    }

    if (language !== "en" && language !== "ms") {
      throw new UnsupportedVideoLanguageError(language);
    }

    if (!DURATIONS.includes(duration) || !isPlatformDurationCompatible(platform, duration)) {
      throw new UnsupportedVideoDurationError(duration, { platform });
    }

    return {
      platform,
      format,
      language,
      tone: input.tone ?? (platform === "youtube" ? "educational" : "friendly"),
      objective: input.objective ?? defaultObjective(format),
      contentAngle: input.contentAngle ?? defaultAngle(format),
      targetDurationSeconds: duration,
      presenterStyle: input.presenterStyle ?? defaultPresenterStyle(platform),
      voiceoverEnabled: input.voiceoverEnabled ?? true,
      presenterDialogueEnabled: input.presenterDialogueEnabled ?? platform === "youtube",
      onScreenTextEnabled: input.onScreenTextEnabled ?? true,
      captionEnabled: input.captionEnabled ?? true,
      ctaEnabled: input.ctaEnabled ?? true,
      sceneLimit: clamp(input.sceneLimit ?? defaultSceneLimit(duration), 3, 12),
      hookStyle: input.hookStyle ?? defaultHookStyle(format),
      includeDemonstration: input.includeDemonstration ?? format === "product-demonstration",
      includeBRoll: input.includeBRoll ?? true,
      includeTransitions: input.includeTransitions ?? true,
      includeThumbnailSuggestion: input.includeThumbnailSuggestion ?? true,
      includeMusicOrMoodGuidance: input.includeMusicOrMoodGuidance ?? true,
      strictClaimSafety: input.strictClaimSafety ?? true,
      strictTiming: input.strictTiming ?? true,
      strictPlatformCompliance: input.strictPlatformCompliance ?? true,
      ...(input.templateId === undefined ? {} : { templateId: input.templateId }),
    };
  }
}

export function isPlatformDurationCompatible(platform: VideoPlatform, duration: VideoDurationSeconds): boolean {
  return SHORT_PLATFORMS.includes(platform) ? duration <= 90 : true;
}

export function wordsPerSceneLimit(durationSeconds: number): number {
  return Math.max(10, Math.floor((durationSeconds / 60) * 150));
}

function defaultDuration(platform: VideoPlatform): VideoDurationSeconds {
  return platform === "youtube" ? 180 : 30;
}

function defaultSceneLimit(duration: VideoDurationSeconds): number {
  if (duration <= 30) {
    return 5;
  }
  if (duration <= 90) {
    return 7;
  }
  return 10;
}

function defaultObjective(format: VideoFormat): VideoObjective {
  if (format === "educational" || format === "faq") {
    return "education";
  }
  if (format === "product-demonstration") {
    return "demonstration";
  }
  if (format === "launch") {
    return "product-launch";
  }
  return "engagement";
}

function defaultAngle(format: VideoFormat): VideoScriptGenerationOptions["contentAngle"] {
  if (format === "problem-solution") {
    return "problem-solution";
  }
  if (format === "feature-spotlight") {
    return "feature-spotlight";
  }
  if (format === "testimonial-framework") {
    return "testimonial-framework";
  }
  return "product-benefit";
}

function defaultHookStyle(format: VideoFormat): VideoHookStyle {
  if (format === "educational") {
    return "educational";
  }
  if (format === "product-demonstration") {
    return "demonstration";
  }
  if (format === "objection-handling") {
    return "objection-handling";
  }
  return "question";
}

function defaultPresenterStyle(platform: VideoPlatform): VideoPresenterStyle {
  return platform === "youtube" ? "mixed" : "voiceover-only";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
