import {
  CREATIVE_ANALYSIS_DIMENSIONS,
  type CreativeAnalysisDimension,
  type CreativeAnalysisResult,
  type CreativeDimensionAnalysis,
} from "../../domain/models/creative-analysis.model.js";
import type {
  CreativeRecommendation,
  CreativeRecommendationCategory,
  CreativeRecommendationPriority,
} from "../../domain/models/creative-recommendation.model.js";
import type { PlatformSuitabilityAssessment } from "../../domain/models/creative-platform-suitability.model.js";
import type { PolicyRiskFinding, PolicyRiskSeverity } from "../../domain/models/creative-policy-risk.model.js";

const DIMENSION_RECOMMENDATION_CODES: Readonly<Record<CreativeAnalysisDimension, string>> = Object.freeze({
  HOOK: "REC_IMPROVE_HOOK",
  HEADLINE: "REC_IMPROVE_HEADLINE",
  PRIMARY_TEXT: "REC_IMPROVE_PRIMARY_TEXT",
  CTA: "REC_IMPROVE_CTA",
  VISUAL_CONCEPT: "REC_IMPROVE_VISUAL_CONCEPT",
  BRAND_CONSISTENCY: "REC_IMPROVE_BRAND_CONSISTENCY",
});

const DIMENSION_RECOMMENDATION_CATEGORIES: Readonly<Record<CreativeAnalysisDimension, CreativeRecommendationCategory>> = Object.freeze({
  HOOK: "IMPROVE_HOOK",
  HEADLINE: "IMPROVE_HEADLINE",
  PRIMARY_TEXT: "IMPROVE_PRIMARY_TEXT",
  CTA: "IMPROVE_CTA",
  VISUAL_CONCEPT: "IMPROVE_VISUAL_CONCEPT",
  BRAND_CONSISTENCY: "IMPROVE_BRAND_CONSISTENCY",
});

const DIMENSION_ACTIONS: Readonly<Record<CreativeAnalysisDimension, string>> = Object.freeze({
  HOOK: "Review the hook and strengthen the opening promise, context, or tension before using the creative.",
  HEADLINE: "Review the headline for clearer scan value and stronger alignment with the supplied brief.",
  PRIMARY_TEXT: "Review the primary text for stronger supporting context and clearer creative rationale.",
  CTA: "Review the call to action so the next step is specific, direct, and aligned with the creative intent.",
  VISUAL_CONCEPT: "Review the visual concept for clearer production detail and platform-ready execution guidance.",
  BRAND_CONSISTENCY: "Review the brand context and strengthen explicit alignment between the creative and brand tone.",
});

const POLICY_PRIORITY: Readonly<Record<PolicyRiskSeverity, CreativeRecommendationPriority>> = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
});

export class CreativeRecommendationEngine {
  public recommend(analysis: CreativeAnalysisResult): readonly CreativeRecommendation[] {
    return dedupeRecommendations([
      ...this.dimensionRecommendations(analysis),
      ...this.platformRecommendations(analysis.platformSuitability ?? []),
      ...this.policyRecommendations(analysis.policyRisk?.findings ?? []),
      ...this.humanReviewRecommendations(analysis),
    ]);
  }

  private dimensionRecommendations(analysis: CreativeAnalysisResult): readonly CreativeRecommendation[] {
    return CREATIVE_ANALYSIS_DIMENSIONS.flatMap((dimension) => {
      const dimensionAnalysis = analysis.dimensions.find((entry) => entry.dimension === dimension);
      if (dimensionAnalysis === undefined || dimensionAnalysis.score >= 60) {
        return [];
      }

      return [this.buildDimensionRecommendation(dimensionAnalysis)];
    });
  }

  private buildDimensionRecommendation(dimension: CreativeDimensionAnalysis): CreativeRecommendation {
    const evidence = dimension.findings.filter((finding) => finding.type !== "STRENGTH").map((finding) => finding.code);

    return {
      code: DIMENSION_RECOMMENDATION_CODES[dimension.dimension],
      category: DIMENSION_RECOMMENDATION_CATEGORIES[dimension.dimension],
      priority: dimension.score < 40 ? "HIGH" : "MEDIUM",
      dimension: dimension.dimension,
      reason: `${dimension.dimension} score is ${dimension.score}, below the review threshold.`,
      recommendedAction: DIMENSION_ACTIONS[dimension.dimension],
      evidence,
      advisoryOnly: true,
    };
  }

  private platformRecommendations(assessments: readonly PlatformSuitabilityAssessment[]): readonly CreativeRecommendation[] {
    return assessments.flatMap((assessment) => {
      if (assessment.status === "SUITABLE") {
        return [];
      }

      return [
        {
          code: `REC_PLATFORM_ADAPTATION_${assessment.platform}`,
          category: "PLATFORM_ADAPTATION",
          priority: assessment.status === "NOT_RECOMMENDED" ? "HIGH" : "MEDIUM",
          platform: assessment.platform,
          reason: `${assessment.platform} suitability is ${assessment.status} with score ${assessment.score}.`,
          recommendedAction: "Review platform fit and adapt the creative structure before using it on this platform.",
          evidence: assessment.findings.map((finding) => finding.code),
          advisoryOnly: true,
        },
      ];
    });
  }

  private policyRecommendations(findings: readonly PolicyRiskFinding[]): readonly CreativeRecommendation[] {
    return findings
      .filter((finding) => finding.severity === "HIGH" || finding.severity === "CRITICAL")
      .map((finding) => ({
        code: `REC_POLICY_RISK_${finding.code}`,
        category: "POLICY_RISK_REVIEW",
        priority: POLICY_PRIORITY[finding.severity],
        riskCategory: finding.category,
        riskSeverity: finding.severity,
        reason: finding.message,
        recommendedAction: "Route this policy-sensitive finding for human review before any publishing or platform use.",
        evidence: [finding.code],
        advisoryOnly: true,
      }));
  }

  private humanReviewRecommendations(analysis: CreativeAnalysisResult): readonly CreativeRecommendation[] {
    if (analysis.policyRisk?.requiresHumanReview !== true) {
      return [];
    }

    return [
      {
        code: "REC_HUMAN_REVIEW_REQUIRED",
        category: "HUMAN_REVIEW_REQUIRED",
        priority: analysis.policyRisk.overallRisk === "CRITICAL" ? "CRITICAL" : "HIGH",
        riskSeverity: analysis.policyRisk.overallRisk,
        reason: "Policy risk assessment requires human review.",
        recommendedAction: "Hold this creative for manual governance review before downstream use.",
        evidence: analysis.policyRisk.findings.map((finding) => finding.code),
        advisoryOnly: true,
      },
    ];
  }
}

function dedupeRecommendations(recommendations: readonly CreativeRecommendation[]): readonly CreativeRecommendation[] {
  const byCode = new Map<string, CreativeRecommendation>();

  for (const recommendation of recommendations) {
    if (!byCode.has(recommendation.code)) {
      byCode.set(recommendation.code, recommendation);
    }
  }

  return [...byCode.values()];
}
