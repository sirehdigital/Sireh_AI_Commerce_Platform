import type {
  ContentQualityRecommendation,
  ContentQualityRuleEvaluation,
  ContentRevisionGuidance,
} from "../dto/content-quality-scoring.types.js";

export class ContentRecommendationFactory {
  public create(
    evaluations: readonly ContentQualityRuleEvaluation[],
    maximumCount: number,
  ): readonly ContentQualityRecommendation[] {
    const seen = new Set<string>();
    return evaluations
      .filter((evaluation) => evaluation.status !== "pass" && evaluation.recommendation !== undefined)
      .sort((a, b) => priority(b) - priority(a) || a.ruleId.localeCompare(b.ruleId))
      .map((evaluation, index) => ({
        priority: index + 1,
        dimension: evaluation.dimension,
        recommendation: evaluation.recommendation ?? "Review this content quality rule.",
        ruleId: evaluation.ruleId,
        blocking: evaluation.criticality === "critical" || evaluation.status === "fail",
      }))
      .filter((recommendation) => {
        const key = `${recommendation.dimension}:${recommendation.recommendation}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, maximumCount);
  }
}

export class ContentRevisionGuidanceFactory {
  public create(recommendations: readonly ContentQualityRecommendation[]): readonly ContentRevisionGuidance[] {
    return recommendations.map((recommendation) => ({
      priority: recommendation.priority,
      dimension: recommendation.dimension,
      problem: recommendation.ruleId,
      whyItMatters: `${recommendation.dimension} affects approval readiness for this content.`,
      suggestedAction: recommendation.recommendation,
      affectedContentSection: sectionFor(recommendation.ruleId),
      blocking: recommendation.blocking,
      requiresReevaluation: true,
    }));
  }
}

function priority(evaluation: ContentQualityRuleEvaluation): number {
  const criticality = { critical: 4, high: 3, medium: 2, low: 1 } as const;
  return criticality[evaluation.criticality] * 100 + (100 - evaluation.score);
}

function sectionFor(ruleId: string): string {
  if (ruleId.includes("headline") || ruleId.includes("subject")) {
    return "headline";
  }
  if (ruleId.includes("cta")) {
    return "cta";
  }
  if (ruleId.includes("seo") || ruleId.includes("keyword") || ruleId.includes("meta")) {
    return "seo";
  }
  return "body";
}
