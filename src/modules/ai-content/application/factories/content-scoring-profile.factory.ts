import type { ContentQualityDimension, ContentScoringProfile } from "../dto/content-quality-scoring.types.js";
import {
  InvalidContentScoringWeightsError,
  UnsupportedContentScoringProfileError,
} from "../errors/product-content.errors.js";

export const CONTENT_QUALITY_DIMENSIONS: readonly ContentQualityDimension[] = [
  "clarity",
  "relevance",
  "persuasiveness",
  "readability",
  "seoQuality",
  "brandAlignment",
  "audienceAlignment",
  "channelSuitability",
  "structuralQuality",
  "ctaQuality",
  "claimSafety",
  "complianceReadiness",
  "toneConsistency",
  "languageConsistency",
  "factualGrounding",
  "originalityHeuristic",
  "actionability",
];

const PROFILES: readonly ContentScoringProfile[] = [
  "balanced",
  "conversion-focused",
  "seo-focused",
  "brand-focused",
  "safety-focused",
  "readability-focused",
  "social-engagement-focused",
  "email-conversion-focused",
  "video-performance-readiness",
  "editorial-quality-focused",
];

const BASE_WEIGHT = 1;

export class ContentScoringProfileFactory {
  public create(
    profile: ContentScoringProfile,
    customWeights: Partial<Record<ContentQualityDimension, number>> = {},
    strictSafetyMode = true,
  ): Readonly<Record<ContentQualityDimension, number>> {
    if (!PROFILES.includes(profile)) {
      throw new UnsupportedContentScoringProfileError(profile);
    }

    const weighted = applyProfile(defaultWeights(), profile);
    const merged = normalizeWeights({ ...weighted, ...customWeights }, strictSafetyMode);

    return merged;
  }
}

function defaultWeights(): Record<ContentQualityDimension, number> {
  return Object.fromEntries(CONTENT_QUALITY_DIMENSIONS.map((dimension) => [dimension, BASE_WEIGHT])) as Record<
    ContentQualityDimension,
    number
  >;
}

function applyProfile(
  weights: Record<ContentQualityDimension, number>,
  profile: ContentScoringProfile,
): Record<ContentQualityDimension, number> {
  const next = { ...weights };
  const boost = (dimensions: readonly ContentQualityDimension[]) => {
    dimensions.forEach((dimension) => {
      next[dimension] += 1;
    });
  };

  if (profile === "conversion-focused") {
    boost(["persuasiveness", "ctaQuality", "actionability", "relevance"]);
  }
  if (profile === "seo-focused") {
    boost(["seoQuality", "relevance", "structuralQuality", "readability"]);
  }
  if (profile === "brand-focused") {
    boost(["brandAlignment", "toneConsistency", "audienceAlignment", "factualGrounding"]);
  }
  if (profile === "safety-focused") {
    boost(["claimSafety", "complianceReadiness", "factualGrounding"]);
  }
  if (profile === "readability-focused") {
    boost(["readability", "clarity", "structuralQuality", "languageConsistency"]);
  }
  if (profile === "social-engagement-focused") {
    boost(["persuasiveness", "channelSuitability", "ctaQuality", "originalityHeuristic"]);
  }
  if (profile === "email-conversion-focused") {
    boost(["ctaQuality", "persuasiveness", "complianceReadiness", "clarity"]);
  }
  if (profile === "video-performance-readiness") {
    boost(["structuralQuality", "channelSuitability", "actionability", "clarity"]);
  }
  if (profile === "editorial-quality-focused") {
    boost(["readability", "factualGrounding", "seoQuality", "structuralQuality"]);
  }

  return next;
}

function normalizeWeights(
  weights: Record<ContentQualityDimension, number>,
  strictSafetyMode: boolean,
): Readonly<Record<ContentQualityDimension, number>> {
  const invalid = Object.entries(weights).filter(([, value]) => !Number.isFinite(value) || value < 0);
  if (invalid.length > 0) {
    throw new InvalidContentScoringWeightsError("Content scoring weights must be finite non-negative numbers.", {
      invalid,
    });
  }

  if (strictSafetyMode && (weights.claimSafety === 0 || weights.complianceReadiness === 0)) {
    throw new InvalidContentScoringWeightsError("Strict safety mode requires claim safety and compliance weights.");
  }

  const total = CONTENT_QUALITY_DIMENSIONS.reduce((sum, dimension) => sum + weights[dimension], 0);
  if (total <= 0) {
    throw new InvalidContentScoringWeightsError("At least one scoring dimension must have a positive weight.");
  }

  return Object.fromEntries(
    CONTENT_QUALITY_DIMENSIONS.map((dimension) => [dimension, roundWeight(weights[dimension] / total)]),
  ) as Readonly<Record<ContentQualityDimension, number>>;
}

function roundWeight(value: number): number {
  return Math.round(value * 10000) / 10000;
}
