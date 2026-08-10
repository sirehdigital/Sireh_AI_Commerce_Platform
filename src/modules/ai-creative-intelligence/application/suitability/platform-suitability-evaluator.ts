import type { CreativeAnalysisResult } from "../../domain/models/creative-analysis.model.js";
import { CREATIVE_PLATFORMS, type CreativePlatform } from "../../domain/models/creative-intelligence.model.js";
import {
  type PlatformSuitabilityAssessment,
  type PlatformSuitabilityFinding,
  type PlatformSuitabilityStatus,
  type PlatformSuitabilityWeights,
} from "../../domain/models/creative-platform-suitability.model.js";

export const PLATFORM_SUITABILITY_WEIGHTS: Readonly<Record<CreativePlatform, PlatformSuitabilityWeights>> = Object.freeze({
  FACEBOOK: Object.freeze({
    HOOK: 20,
    HEADLINE: 15,
    PRIMARY_TEXT: 25,
    CTA: 20,
    VISUAL_CONCEPT: 15,
    BRAND_CONSISTENCY: 5,
  }),
  INSTAGRAM: Object.freeze({
    HOOK: 20,
    HEADLINE: 5,
    PRIMARY_TEXT: 10,
    CTA: 10,
    VISUAL_CONCEPT: 35,
    BRAND_CONSISTENCY: 20,
  }),
  THREADS: Object.freeze({
    HOOK: 25,
    HEADLINE: 20,
    PRIMARY_TEXT: 35,
    CTA: 10,
    VISUAL_CONCEPT: 5,
    BRAND_CONSISTENCY: 5,
  }),
  TIKTOK: Object.freeze({
    HOOK: 30,
    HEADLINE: 5,
    PRIMARY_TEXT: 10,
    CTA: 20,
    VISUAL_CONCEPT: 30,
    BRAND_CONSISTENCY: 5,
  }),
  SHOPIFY: Object.freeze({
    HOOK: 5,
    HEADLINE: 25,
    PRIMARY_TEXT: 25,
    CTA: 20,
    VISUAL_CONCEPT: 5,
    BRAND_CONSISTENCY: 20,
  }),
  EMAIL: Object.freeze({
    HOOK: 5,
    HEADLINE: 30,
    PRIMARY_TEXT: 25,
    CTA: 25,
    VISUAL_CONCEPT: 0,
    BRAND_CONSISTENCY: 15,
  }),
  OTHER: Object.freeze({
    HOOK: 15,
    HEADLINE: 15,
    PRIMARY_TEXT: 20,
    CTA: 15,
    VISUAL_CONCEPT: 20,
    BRAND_CONSISTENCY: 15,
  }),
});

export const PLATFORM_SUITABILITY_THRESHOLDS = Object.freeze({
  suitable: 80,
  needsReview: 60,
});

export class PlatformSuitabilityEvaluator {
  public evaluate(analysis: CreativeAnalysisResult): readonly PlatformSuitabilityAssessment[] {
    return CREATIVE_PLATFORMS.map((platform) => this.evaluatePlatform(platform, analysis));
  }

  private evaluatePlatform(platform: CreativePlatform, analysis: CreativeAnalysisResult): PlatformSuitabilityAssessment {
    const weights = PLATFORM_SUITABILITY_WEIGHTS[platform];
    const score = clampScore(
      Math.round(
        Object.entries(weights).reduce((sum, [dimension, weight]) => sum + analysis.dimensionScores[dimension as keyof typeof weights] * weight, 0) / 100,
      ),
    );

    return {
      platform,
      score,
      status: this.toStatus(score),
      findings: this.buildFindings(platform, analysis),
    };
  }

  private toStatus(score: number): PlatformSuitabilityStatus {
    if (score >= PLATFORM_SUITABILITY_THRESHOLDS.suitable) {
      return "SUITABLE";
    }

    if (score >= PLATFORM_SUITABILITY_THRESHOLDS.needsReview) {
      return "NEEDS_REVIEW";
    }

    return "NOT_RECOMMENDED";
  }

  private buildFindings(platform: CreativePlatform, analysis: CreativeAnalysisResult): readonly PlatformSuitabilityFinding[] {
    const weakDimensions = analysis.dimensions.filter((dimension) => dimension.score < PLATFORM_SUITABILITY_THRESHOLDS.needsReview);
    const strongDimensions = analysis.dimensions.filter((dimension) => dimension.score >= PLATFORM_SUITABILITY_THRESHOLDS.suitable);
    const findings: PlatformSuitabilityFinding[] = [];

    if (strongDimensions.length > 0) {
      findings.push({
        platform,
        code: `${platform}_STRUCTURAL_STRENGTHS_PRESENT`,
        message: "Creative has structural strengths relevant to platform readiness.",
        evidence: strongDimensions.flatMap((dimension) => dimension.findings).filter((finding) => finding.type === "STRENGTH"),
      });
    }

    if (weakDimensions.length > 0) {
      findings.push({
        platform,
        code: `${platform}_REVIEW_WEAK_DIMENSIONS`,
        message: "Creative has weak dimensions that should be reviewed before platform use.",
        evidence: weakDimensions.flatMap((dimension) => dimension.findings).filter((finding) => finding.type !== "STRENGTH"),
      });
    }

    return findings;
  }
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}
